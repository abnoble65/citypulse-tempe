/**
 * Force-reprocess a single hearing date.
 * Usage: npx tsx scripts/reprocessDate.ts 2025-06-26
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.VITE_SUPABASE_SERVICE_KEY!;
const ANTHROPIC_KEY = process.env.VITE_ANTHROPIC_API_KEY!;
const ARCHIVE_INDEX = 'https://sfplanning.org/cpc-hearing-archives';

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const targetDate = process.argv[2];
if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error('Usage: npx tsx scripts/reprocessDate.ts YYYY-MM-DD');
  process.exit(1);
}

function parseDateFromUrl(url: string): string | null {
  const m = url.match(/\/(\d{4})(\d{2})(\d{2})_(?:cpc|cal)_min\.pdf/i);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

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
- Keep comment_text concise (max 2 sentences per comment).
- If a field is not present in the minutes, use null.
- If a project mentions any of: "shadow", "Section 295", "shadow findings", "Recreation and Park", "open space impact", or "net new shadow", set shadow_flag to true and populate shadow_details. Otherwise shadow_flag=false, shadow_details=null.
- Return ONLY the JSON object — no markdown, no explanation.`;

async function main() {
  // Find URL for this date
  console.log(`Fetching archive index to find URL for ${targetDate}…`);
  const res = await fetch(ARCHIVE_INDEX);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const linkRegex = /href=["'](https?:\/\/citypln-m-extnl\.sfgov\.org[^"']*?(?:cpc|cal)_min\.pdf)["']/gi;
  let targetUrl: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const dateStr = parseDateFromUrl(m[1]);
    if (dateStr === targetDate) { targetUrl = m[1]; break; }
  }

  if (!targetUrl) {
    console.error(`No PDF found on sfplanning.org for ${targetDate}`);
    process.exit(1);
  }
  console.log(`Found: ${targetUrl}`);

  // Delete existing hearing row (cascade deletes projects)
  const { error: delErr } = await supabase.from('hearings').delete().eq('hearing_date', targetDate);
  if (delErr) console.warn('Delete warning (may not exist):', delErr.message);

  // Fetch PDF
  process.stdout.write(`Fetching PDF… `);
  const pdfRes = await fetch(targetUrl);
  if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
  const buf = await pdfRes.arrayBuffer();
  const pdfBase64 = Buffer.from(buf).toString('base64');
  console.log(`${Math.round(buf.byteLength / 1024)}KB`);

  // Extract with Claude
  process.stdout.write(`Extracting with Claude (max_tokens=16384)… `);
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: 'Extract all projects from these Planning Commission minutes.' },
      ],
    }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Non-text response');

  const raw = block.text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  console.log(`got ${block.text.length} chars, stop_reason=${message.stop_reason}`);

  const extracted = JSON.parse(raw) as { projects: unknown[] };
  console.log(`Parsed ${extracted.projects.length} projects.`);

  // Upsert hearing
  const { data: hearingRow, error: hErr } = await supabase
    .from('hearings')
    .upsert({ hearing_date: targetDate, pdf_url: targetUrl, processed_at: new Date().toISOString() }, { onConflict: 'hearing_date' })
    .select('id').single();
  if (hErr || !hearingRow) throw new Error(`Hearing upsert failed: ${hErr?.message}`);
  const hearingId = hearingRow.id as string;

  // Insert projects
  let saved = 0;
  for (const p of extracted.projects as Record<string, unknown>[]) {
    const { data: projRow, error: pErr } = await supabase.from('projects').insert({
      hearing_id: hearingId,
      case_number:         p.case_number         ?? null,
      address:             p.address             ?? null,
      district:            p.district            ?? null,
      project_description: p.project_description ?? null,
      action:              p.action              ?? null,
      motion_number:       p.motion_number       ?? null,
      shadow_flag:         p.shadow_flag         ?? false,
      shadow_details:      p.shadow_details      ?? null,
    }).select('id').single();
    if (pErr || !projRow) { console.error('  project error:', pErr?.message); continue; }

    const pid = projRow.id as string;
    const votes = p.votes as Array<{ commissioner_name: string; vote: string }> | undefined;
    const comments = p.comments as Array<{ commissioner_name: string; comment_text: string }> | undefined;

    if (votes?.length) {
      await supabase.from('votes').insert(votes.map(v => ({ project_id: pid, commissioner_name: v.commissioner_name, vote: v.vote })));
    }
    if (comments?.length) {
      await supabase.from('commissioner_comments').insert(comments.map(c => ({ project_id: pid, commissioner_name: c.commissioner_name, comment_text: c.comment_text })));
    }
    saved++;
  }

  console.log(`\nSaved hearing ${targetDate} with ${saved} projects.`);

  // Final counts
  const { count: totalHearings } = await supabase.from('hearings').select('*', { count: 'exact', head: true });
  const { count: totalProjects } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  console.log(`DB totals — hearings: ${totalHearings}, projects: ${totalProjects}`);
}

main().catch(err => { console.error(err); process.exit(1); });
