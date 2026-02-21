/**
 * SF Planning Commission Minutes Ingestion Script
 *
 * Walks backward from today to 1998-01-01, fetches each PDF from the SF Planning
 * Commission archive, extracts structured data via Claude, and upserts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/ingestMinutes.ts
 *
 * Required environment variables (can be placed in a .env file):
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

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY     = process.env.VITE_SUPABASE_SERVICE_KEY!;
const ANTHROPIC_KEY    = process.env.VITE_ANTHROPIC_API_KEY!;
const RATE_LIMIT_MS    = 2000;
const START_DATE       = new Date('2026-02-21');
const END_DATE         = new Date('1998-01-01');
const BASE_URL         = 'https://citypln-m-extnl.sfgov.org/Commissions/Agenda_or_Minutes';

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required environment variables. Check VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, VITE_ANTHROPIC_API_KEY.');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

interface ExtractedMinutes {
  projects: ExtractedProject[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToFilename(date: Date): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}${m}${d}_cpc_min.pdf`;
}

function pdfUrl(date: Date): string {
  return `${BASE_URL}/${dateToFilename(date)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns every Thursday between START_DATE and END_DATE in descending order.
 *  Planning Commission meetings are typically on Thursdays. */
function allThursdays(): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(START_DATE);
  // Advance/rewind to nearest Thursday
  while (cursor.getDay() !== 4) cursor.setDate(cursor.getDate() - 1);
  while (cursor >= END_DATE) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 7);
  }
  return dates;
}

// ── PDF fetch ─────────────────────────────────────────────────────────────────

async function fetchPdfText(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null; // PDF not found for this date — skip silently

  const buffer = await res.arrayBuffer();
  const bytes   = new Uint8Array(buffer);

  // Extract raw ASCII text from PDF byte stream (basic heuristic — good enough
  // for structured minutes which are plain-text PDFs from the city archive).
  const raw = Buffer.from(bytes).toString('latin1');
  const textChunks: string[] = [];
  const btRegex = /BT([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;
  while ((match = btRegex.exec(raw)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tj: RegExpExecArray | null;
    while ((tj = tjRegex.exec(block)) !== null) {
      textChunks.push(tj[1]);
    }
  }

  const text = textChunks.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 100 ? text : null;
}

// ── Claude extraction ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at parsing San Francisco Planning Commission meeting minutes.
Extract all planning cases/projects from the provided minutes text and return a single JSON object.

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
      ]
    }
  ]
}

Rules:
- Include every agenda item that has a case number, address, or project description.
- Normalise vote values to: aye, nay, absent, recused, abstain.
- Keep comment_text concise but preserve meaning.
- If a field is not present in the minutes, use null.
- Return ONLY the JSON object — no markdown, no explanation.`;

async function extractWithClaude(text: string): Promise<ExtractedMinutes | null> {
  const truncated = text.slice(0, 80_000); // Stay within context limits

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract all projects from these Planning Commission minutes:\n\n${truncated}` }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return null;

    return JSON.parse(content.text) as ExtractedMinutes;
  } catch (err) {
    console.error('  Claude extraction error:', err);
    return null;
  }
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertHearing(date: Date, url: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('hearings')
    .upsert(
      { hearing_date: date.toISOString().slice(0, 10), pdf_url: url, processed_at: new Date().toISOString() },
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
        case_number:         project.case_number  ?? null,
        address:             project.address       ?? null,
        district:            project.district      ?? null,
        project_description: project.project_description ?? null,
        action:              project.action        ?? null,
        motion_number:       project.motion_number ?? null,
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

// ── Already-processed check ───────────────────────────────────────────────────

async function alreadyProcessed(date: Date): Promise<boolean> {
  const { data } = await supabase
    .from('hearings')
    .select('id')
    .eq('hearing_date', date.toISOString().slice(0, 10))
    .maybeSingle();
  return data !== null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dates = allThursdays();
  console.log(`Starting ingestion: ${dates.length} candidate Thursdays from ${START_DATE.toDateString()} back to ${END_DATE.toDateString()}`);

  let processed = 0;
  let skipped   = 0;
  let notFound  = 0;

  for (const date of dates) {
    const url = pdfUrl(date);
    const dateStr = date.toISOString().slice(0, 10);

    // Skip if already in DB
    if (await alreadyProcessed(date)) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${dateStr}] Fetching PDF… `);
    const text = await fetchPdfText(url);

    if (!text) {
      process.stdout.write('not found\n');
      notFound++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    process.stdout.write(`${text.length} chars — extracting… `);
    const extracted = await extractWithClaude(text);

    if (!extracted) {
      process.stdout.write('extraction failed\n');
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const hearingId = await upsertHearing(date, url);
    if (hearingId) {
      await insertProjects(hearingId, extracted.projects);
      process.stdout.write(`saved ${extracted.projects.length} project(s)\n`);
      processed++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone. Processed: ${processed} | Already in DB: ${skipped} | Not found: ${notFound}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
