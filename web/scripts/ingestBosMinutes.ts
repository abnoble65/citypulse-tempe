/**
 * scripts/ingestBosMinutes.ts — CityPulse
 *
 * Probes all SF Board of Supervisors meeting Tuesdays from Jan 2025 to today,
 * downloads available minutes PDFs from sfbos.org, sends each to Claude Haiku
 * for item extraction, and upserts to bos_meetings / bos_items in Supabase.
 *
 * Usage:
 *   npx tsx scripts/ingestBosMinutes.ts [--limit 30] [--dry-run]
 *
 * Required env vars (in .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
 *   ANTHROPIC_API_KEY
 *
 * PDF URL pattern: https://sfbos.org/sites/default/files/bag[MMDDYY]_minutes.pdf
 * Board meets on Tuesdays — ~20–22 sessions per half-year.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env ─────────────────────────────────────────────────────────────────

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
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['\"]|['\"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.VITE_SUPABASE_SERVICE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const PDF_BASE = 'https://sfbos.org/sites/default/files';

const PROBE_DELAY_MS  = 400;   // Between HEAD probes (polite to sfbos.org)
const FETCH_DELAY_MS  = 1200;  // After PDF download
const CLAUDE_DELAY_MS = 3000;  // Between Claude calls
const FETCH_RETRIES   = 2;     // Retry PDF download on timeout

const args    = process.argv.slice(2);
const LIMIT   = parseInt(args[args.indexOf('--limit') + 1] ?? '30', 10) || 30;
const DRY_RUN = args.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required env vars. Check VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

interface BosItem {
  file_number:  string;
  title:        string;
  description:  string;
  action_taken: string;
  vote_result:  string;
  sponsors:     string[];
  districts:    string[];
  topics:       string[];
}

interface ExtractedMeeting {
  meeting_type: string;
  items:        BosItem[];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** All Tuesdays between start and end inclusive. */
function getTuesdays(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  // Advance to first Tuesday (day 2)
  while (cur.getDay() !== 2) cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

/** Date → bag[MMDDYY]_minutes.pdf */
function toPdfFilename(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `bag${mm}${dd}${yy}_minutes.pdf`;
}

/** Date → YYYY-MM-DD */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── PDF discovery ─────────────────────────────────────────────────────────────

async function probePdf(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status === 200;
  } catch { return false; }
}

// ── Claude extraction ─────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a legislative data extractor for CityPulse, an SF urban intelligence platform. Return ONLY valid JSON — no markdown, no prose, no code fences.`;

async function extractMeeting(
  pdfBuffer: ArrayBuffer,
  dateStr:   string,
): Promise<ExtractedMeeting | null> {
  const base64 = Buffer.from(pdfBuffer).toString('base64');

  const prompt = `This is the SF Board of Supervisors meeting minutes PDF for ${dateStr}.

Extract ALL legislative items (ordinances, resolutions, motions).
Skip purely procedural items: Roll Call, Pledge of Allegiance, Communications, Approval of Minutes, Agenda Changes, Public Comment periods, Adjournment.

For each substantive item return:
- file_number: the FILE NO. (e.g. "240872")
- title: specific 1-sentence title, max 100 chars — include key details (address, amount, program name)
- description: 2-sentence summary. Be specific — cite dollar amounts, addresses, program names, who benefits.
- action_taken: one of: "ADOPTED", "PASSED ON FIRST READING", "CONTINUED", "REFERRED TO COMMITTEE", "TABLED", "REJECTED", "HEARD AND FILED", "PASSED ON FIRST READING AS AMENDED", "ADOPTED AS AMENDED", "FAILED"
- vote_result: e.g. "Ayes: 11" or "Ayes: 9, Noes: 2" or "Ayes: 8, Noes: 3, Absent: 0"
- sponsors: array of supervisor last names who co-sponsored (e.g. ["Mandelman", "Chan"])
- districts: SF Supervisor Districts 1–11 as strings primarily affected; include "citywide" if city-wide; [] if unclear
- topics: 1–3 tags from ONLY: housing, safety, transit, business, budget, parks, infrastructure, other

Also extract for the whole meeting:
- meeting_type: exactly as written in the PDF header — typically "Regular Meeting", "Special Meeting", or "Committee of the Whole"

Return ONLY this JSON (no other text, no markdown, no code fences):
{
  "meeting_type": "Regular Meeting",
  "items": [
    {
      "file_number": "...",
      "title": "...",
      "description": "...",
      "action_taken": "...",
      "vote_result": "...",
      "sponsors": [],
      "districts": [],
      "topics": []
    }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system:     EXTRACT_SYSTEM,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as any,
          { type: 'text', text: prompt },
        ],
      }],
    });

    const block = message.content[0];
    if (block.type !== 'text') return null;

    const raw = block.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return repairExtractedJson(raw);
  } catch (err) {
    console.error('  Claude error:', err);
    return null;
  }
}

/**
 * Parse Claude's JSON response, tolerating truncated output (Haiku hits its
 * 8192-token limit mid-JSON on large meetings). Extracts all COMPLETE items
 * even if the last item was cut off.
 */
function repairExtractedJson(raw: string): ExtractedMeeting | null {
  // 1. Try clean parse first
  try {
    const parsed = JSON.parse(raw) as ExtractedMeeting;
    if (Array.isArray(parsed.items)) return parsed;
  } catch { /* fall through to repair */ }

  // 2. Extract meeting_type from the raw string
  const mtMatch = raw.match(/"meeting_type"\s*:\s*"([^"]+)"/);
  const meeting_type = mtMatch ? mtMatch[1] : 'Regular Meeting';

  // 3. Find the items array and extract complete items using brace-depth tracking.
  //    A "complete item" is a top-level {...} object within the items array.
  const arrayStart = raw.indexOf('"items"');
  if (arrayStart === -1) return null;
  const bracketOpen = raw.indexOf('[', arrayStart);
  if (bracketOpen === -1) return null;

  const items: BosItem[] = [];
  let depth     = 0;
  let itemStart = -1;

  for (let i = bracketOpen + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') {
      if (depth === 0) itemStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && itemStart !== -1) {
        const itemStr = raw.slice(itemStart, i + 1);
        try {
          const item = JSON.parse(itemStr) as BosItem;
          if (item.file_number && item.title) items.push(item);
        } catch { /* skip malformed item */ }
        itemStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break; // end of items array
    }
  }

  if (items.length === 0) return null;
  return { meeting_type, items };
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getExistingDates(): Promise<Set<string>> {
  const { data } = await supabase.from('bos_meetings').select('meeting_date');
  return new Set((data ?? []).map((r: { meeting_date: string }) => r.meeting_date));
}

async function insertMeeting(
  meeting_date: string,
  meeting_type: string,
  pdf_url:      string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('bos_meetings')
    .insert({ meeting_date, meeting_type, pdf_url, processed_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) { console.error('  Meeting insert error:', error.message); return null; }
  return (data as { id: number } | null)?.id ?? null;
}

async function insertItems(meeting_id: number, items: BosItem[]): Promise<void> {
  // Batch insert all items for a meeting in one request
  const rows = items.map(item => ({
    meeting_id,
    file_number: item.file_number,
    title:       item.title,
    description: item.description,
    action:      item.action_taken,
    vote_result: item.vote_result,
    districts:   item.districts,
    topics:      item.topics,
    ai_summary:  item.description,
  }));
  const { error } = await supabase.from('bos_items').insert(rows);
  if (error) console.error(`  Items insert error:`, error.message);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[DRY RUN] No data will be written.\n');

  // Probe all Tuesdays from Jan 7 2025 to today
  const start    = new Date('2025-01-07');
  const end      = new Date();
  const tuesdays = getTuesdays(start, end);

  process.stdout.write(`Probing ${tuesdays.length} Tuesday dates for available PDFs: `);

  const available: Array<{ date: Date; url: string }> = [];
  for (const d of tuesdays) {
    const url    = `${PDF_BASE}/${toPdfFilename(d)}`;
    const exists = await probePdf(url);
    if (exists) available.push({ date: d, url });
    process.stdout.write(exists ? '●' : '·');
    await sleep(PROBE_DELAY_MS);
  }
  console.log(`\n\nFound ${available.length} available PDFs out of ${tuesdays.length} Tuesdays probed.\n`);

  const existing  = await getExistingDates();
  const newItems  = available.filter(a => !existing.has(toISODate(a.date)));
  // Dry run caps at 2 PDFs to show a sample without over-spending on Claude
  const toProcess = DRY_RUN ? newItems.slice(0, 2) : newItems.slice(0, LIMIT);

  console.log(
    `${toProcess.length} meetings to process ` +
    `(${existing.size} already in DB, ${DRY_RUN ? 'dry-run cap=2' : `limit=${LIMIT}`})\n`,
  );

  let saved = 0, failed = 0;

  for (const { date, url } of toProcess) {
    const dateStr = toISODate(date);
    process.stdout.write(`[${dateStr}] Downloading… `);

    let pdfBuffer: ArrayBuffer | null = null;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          process.stdout.write(`HTTP ${res.status} — skipped\n`);
          failed++;
          break;
        }
        pdfBuffer = await res.arrayBuffer();
        break;
      } catch (err) {
        if (attempt < FETCH_RETRIES) {
          process.stdout.write(`(timeout, retry ${attempt})… `);
          await sleep(5000);
        } else {
          process.stdout.write(`fetch failed after ${FETCH_RETRIES} attempts\n`);
          failed++;
        }
      }
    }
    if (!pdfBuffer) { await sleep(FETCH_DELAY_MS); continue; }
    const kb = Math.round(pdfBuffer.byteLength / 1024);
    process.stdout.write(`${kb}KB — extracting… `);
    await sleep(FETCH_DELAY_MS);

    const extracted = await extractMeeting(pdfBuffer, dateStr);
    if (!extracted || !Array.isArray(extracted.items)) {
      process.stdout.write('extraction failed\n');
      failed++;
      await sleep(CLAUDE_DELAY_MS);
      continue;
    }

    const { meeting_type, items } = extracted;

    if (DRY_RUN) {
      process.stdout.write(`OK\n`);
      console.log(`  Meeting type: "${meeting_type}"  |  Items extracted: ${items.length}`);
      const sample = items.slice(0, 3);
      for (const item of sample) {
        console.log(`\n  [${item.file_number}] ${item.title.slice(0, 85)}`);
        console.log(`    Action: ${item.action_taken}  |  Vote: ${item.vote_result}`);
        console.log(`    Topics: [${item.topics.join(', ')}]  Districts: [${item.districts.join(', ') || 'none'}]`);
        if (item.description) {
          console.log(`    Summary: ${item.description.slice(0, 150)}…`);
        }
      }
      if (items.length > 3) console.log(`\n  … and ${items.length - 3} more items`);
      console.log('');
    } else {
      const meetingId = await insertMeeting(dateStr, meeting_type, url);
      if (!meetingId) {
        process.stdout.write('meeting save failed\n');
        failed++;
      } else {
        await insertItems(meetingId, items);
        process.stdout.write(`saved — ${items.length} items  (${meeting_type})\n`);
        saved++;
      }
    }

    await sleep(CLAUDE_DELAY_MS);
  }

  console.log(`\nDone. Saved: ${saved} | Failed: ${failed} | Already in DB: ${existing.size}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
