/**
 * SF Planning Commission Minutes Ingestion Script
 *
 * 1. Fetches the hearing archive index at https://sfplanning.org/cpc-hearing-archives
 * 2. Parses every Minutes PDF link from the HTML
 * 3. Processes each PDF in descending date order: fetches, extracts via Claude,
 *    and upserts structured data into Supabase.
 *
 * Usage:
 *   npx tsx scripts/ingestMinutes.ts
 *
 * Required environment variables (in .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
 *   VITE_ANTHROPIC_API_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env manually (no dotenv dependency assumed) ─────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.VITE_SUPABASE_SERVICE_KEY!;
const ANTHROPIC_KEY = process.env.VITE_ANTHROPIC_API_KEY!;
const RATE_LIMIT_MS = 120_000; // large PDFs hit 30k tokens/min limit; 120s gives buffer
const ARCHIVE_INDEX = 'https://sfplanning.org/cpc-hearing-archives';

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required environment variables. Check VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, VITE_ANTHROPIC_API_KEY.');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

interface HearingLink {
  dateStr: string; // YYYY-MM-DD
  url:     string;
}

interface ExtractedProject {
  case_number?:         string;
  address?:             string;
  district?:            string;
  project_description?: string;
  action?:              string;
  motion_number?:       string;
  votes?: Array<{
    commissioner_name: string;
    vote: string;
  }>;
  comments?: Array<{
    commissioner_name: string;
    comment_text: string;
  }>;
  shadow_flag?: boolean;
  shadow_details?: string;
}

interface ExtractedMinutes {
  projects: ExtractedProject[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse YYYYMMDD string from a PDF filename into a YYYY-MM-DD date string. */
function parseDateFromUrl(url: string): string | null {
  const match = url.match(/\/(\d{4})(\d{2})(\d{2})_(?:cpc|cal)_min\.pdf/i);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// ── Archive index fetch ───────────────────────────────────────────────────────

/** Fetch the archive index page and return all minutes PDF links, newest first. */
async function fetchAllMinutesUrls(): Promise<HearingLink[]> {
  console.log(`Fetching archive index: ${ARCHIVE_INDEX}`);
  const res = await fetch(ARCHIVE_INDEX);
  if (!res.ok) throw new Error(`Failed to fetch archive index: ${res.status} ${res.statusText}`);

  const html = await res.text();

  // Match all hrefs pointing to minutes PDFs on the sfgov archive server.
  // Handles both _cpc_min.pdf and _cal_min.pdf variants.
  const linkRegex = /href=["'](https?:\/\/citypln-m-extnl\.sfgov\.org[^"']*?(?:cpc|cal)_min\.pdf)["']/gi;
  const seen = new Set<string>();
  const links: HearingLink[] = [];

  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);

    const dateStr = parseDateFromUrl(url);
    if (!dateStr) continue;

    links.push({ dateStr, url });
  }

  // Sort newest → oldest
  links.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  console.log(`Found ${links.length} minutes PDFs in archive index.`);
  return links;
}

// ── PDF fetch ─────────────────────────────────────────────────────────────────

async function fetchPdfBase64(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// ── Claude extraction (native PDF support) ────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at parsing San Francisco Planning Commission meeting minutes.
Extract all planning cases/projects from the provided PDF and return a single JSON object.

Return ONLY valid JSON with this exact structure:
{
  "projects": [
    {
      "case_number": "string or null",
      "address": "string or null",
      "district": "string or null",
      "project_description": "string or null",
      "action": "string or null — e.g. Approved, Continued, Disapproved, Withdrawn",
      "motion_number": "string or null",
      "votes": [
        { "commissioner_name": "string", "vote": "aye|nay|absent|recused|abstain" }
      ],
      "comments": [
        { "commissioner_name": "string", "comment_text": "string" }
      ],
      "shadow_flag": "boolean",
      "shadow_details": "string or null"
    }
  ]
}

Rules:
- Include every agenda item that has a case number, address, or project description.
- Normalise vote values to: aye, nay, absent, recused, abstain.
- Keep comment_text concise but preserve meaning.
- If a field is not present in the minutes, use null.
- If a project mentions any of: "shadow", "Section 295", "shadow findings", "Recreation and Park", "open space impact", or "net new shadow", set shadow_flag to true. For flagged projects, populate shadow_details with: which open spaces are named, whether shadow findings were adopted or denied, and any conditions attached. For non-flagged projects, set shadow_flag to false and shadow_details to null.
- Return ONLY the JSON object — no markdown, no explanation.`;

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 60_000; // 60 seconds

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.status === 429) return true;
    if (typeof e.message === 'string' && e.message.includes('rate_limit')) return true;
    const inner = e.error as Record<string, unknown> | undefined;
    if (inner && typeof inner === 'object') {
      const nested = inner.error as Record<string, unknown> | undefined;
      if (nested?.type === 'rate_limit_error') return true;
    }
  }
  return false;
}

async function extractWithClaude(pdfBase64: string): Promise<ExtractedMinutes | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: 'Extract all projects from these Planning Commission minutes.',
            },
          ],
        }],
      });

      const content = message.content[0];
      if (content.type !== 'text') return null;

      const raw = content.text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      return JSON.parse(raw) as ExtractedMinutes;
    } catch (err) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        process.stdout.write(`rate limited, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})… `);
        await sleep(backoff);
        continue;
      }
      console.error('  Claude extraction error:', err);
      return null;
    }
  }
  return null;
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertHearing(dateStr: string, url: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('hearings')
    .upsert(
      { hearing_date: dateStr, pdf_url: url, processed_at: new Date().toISOString() },
      { onConflict: 'hearing_date' }
    )
    .select('id')
    .single();

  if (error) { console.error('  Supabase hearings upsert error:', error.message); return null; }
  return data.id as string;
}

async function insertProjects(hearingId: string, projects: ExtractedProject[]): Promise<void> {
  for (const project of projects) {
    const { data: projectRow, error: projErr } = await supabase
      .from('projects')
      .insert({
        hearing_id:          hearingId,
        case_number:         project.case_number          ?? null,
        address:             project.address              ?? null,
        district:            project.district             ?? null,
        project_description: project.project_description ?? null,
        action:              project.action               ?? null,
        motion_number:       project.motion_number        ?? null,
        shadow_flag:         project.shadow_flag          ?? false,
        shadow_details:      project.shadow_details       ?? null,
      })
      .select('id')
      .single();

    if (projErr || !projectRow) {
      console.error('  Project insert error:', projErr?.message);
      continue;
    }

    const projectId = projectRow.id as string;

    if (project.votes?.length) {
      const { error: votesErr } = await supabase.from('votes').insert(
        project.votes.map((v) => ({ project_id: projectId, commissioner_name: v.commissioner_name, vote: v.vote }))
      );
      if (votesErr) console.error('  Votes insert error:', votesErr.message);
    }

    if (project.comments?.length) {
      const { error: commentsErr } = await supabase.from('commissioner_comments').insert(
        project.comments.map((c) => ({ project_id: projectId, commissioner_name: c.commissioner_name, comment_text: c.comment_text }))
      );
      if (commentsErr) console.error('  Comments insert error:', commentsErr.message);
    }
  }
}

async function alreadyProcessed(dateStr: string): Promise<boolean> {
  const { data } = await supabase
    .from('hearings')
    .select('id')
    .eq('hearing_date', dateStr)
    .maybeSingle();
  return data !== null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Dates where the hearing row exists in DB but project inserts failed (shadow_details
// schema error). These are force-deleted and reprocessed on each run.
const FORCE_REPROCESS = new Set([
  '2025-06-26', // large PDF, JSON truncation mid-stream
  '2024-06-06',
  '2022-09-08',
]);

async function main() {
  const hearings = await fetchAllMinutesUrls();

  let processed = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const { dateStr, url } of hearings) {
    const force = FORCE_REPROCESS.has(dateStr);

    if (!force && await alreadyProcessed(dateStr)) {
      skipped++;
      continue;
    }

    // Delete stale hearing row (and cascaded projects) before reprocessing
    if (force) {
      await supabase.from('hearings').delete().eq('hearing_date', dateStr);
    }

    process.stdout.write(`[${dateStr}] Fetching PDF… `);
    const pdfBase64 = await fetchPdfBase64(url);

    if (!pdfBase64) {
      process.stdout.write('not found\n');
      failed++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    process.stdout.write(`${Math.round(pdfBase64.length * 0.75 / 1024)}KB — extracting… `);
    const extracted = await extractWithClaude(pdfBase64);

    if (!extracted) {
      process.stdout.write('extraction failed\n');
      failed++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const hearingId = await upsertHearing(dateStr, url);
    if (hearingId) {
      await insertProjects(hearingId, extracted.projects);
      process.stdout.write(`saved ${extracted.projects.length} project(s)\n`);
      processed++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone. Processed: ${processed} | Already in DB: ${skipped} | Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
