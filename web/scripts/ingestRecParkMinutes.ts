/**
 * scripts/ingestRecParkMinutes.ts — CityPulse
 *
 * Scrapes the SF Recreation & Parks Commission clip list from Granicus
 * (https://sanfrancisco.granicus.com/ViewPublisher.php?view_id=91),
 * downloads caption/transcript text for each meeting, sends to Claude Haiku
 * to extract agenda items, and inserts to recpark_meetings / recpark_items.
 *
 * Usage:
 *   npx tsx scripts/ingestRecParkMinutes.ts [--limit 14] [--dry-run]
 *
 * Required env vars (in .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
 *   VITE_ANTHROPIC_API_KEY
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
const ANTHROPIC_KEY = process.env.VITE_ANTHROPIC_API_KEY!;

const GRANICUS_BASE  = 'https://sanfrancisco.granicus.com';
const CLIP_LIST_URL  = `${GRANICUS_BASE}/ViewPublisher.php?view_id=91`;

const FETCH_DELAY_MS  = 800;
const CLAUDE_DELAY_MS = 2500;
const FETCH_RETRIES   = 2;

const args    = process.argv.slice(2);
const LIMIT   = parseInt(args[args.indexOf('--limit') + 1] ?? '14', 10) || 14;
const DRY_RUN = args.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required env vars.');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

interface GranicusClip {
  clip_id:     string;
  date:        Date;
  date_str:    string;  // YYYY-MM-DD
  caption_url: string | null;
  agenda_url:  string | null;
}

interface RecParkItem {
  item_letter: string | null;
  title:       string;
  description: string;
  action:      string | null;
  vote_result: string | null;
  locations:   string[];
  topics:      string[];
}

interface ExtractedMeeting {
  meeting_type: string;
  items:        RecParkItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse Granicus date strings: "02/19/26" → Date, "02/19/2026" → Date */
function parseGranicusDate(raw: string): Date | null {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let year = parseInt(m[3]);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  return new Date(year, parseInt(m[1]) - 1, parseInt(m[2]));
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Granicus clip list parser ─────────────────────────────────────────────────

async function fetchClipList(): Promise<GranicusClip[]> {
  console.log(`Fetching clip list: ${CLIP_LIST_URL}`);
  const res = await fetch(CLIP_LIST_URL);
  if (!res.ok) throw new Error(`Clip list returned ${res.status}`);
  const html = await res.text();

  const clips: GranicusClip[] = [];

  // Each table row contains a date cell and links with clip_id params.
  // Split into rows and extract per-row data.
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];

    // Must have a clip_id reference
    const clipMatch = row.match(/clip_id=(\d+)/);
    if (!clipMatch) continue;
    const clip_id = clipMatch[1];

    // Extract date — Granicus uses MM/DD/YY or MM/DD/YYYY
    const dateMatch = row.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (!dateMatch) continue;
    const date = parseGranicusDate(dateMatch[1]);
    if (!date) continue;

    // Only process 2025+ meetings
    if (date.getFullYear() < 2025) continue;

    // Extract caption link if present
    const captionMatch = row.match(/href="([^"]*CCaptionViewer[^"]*)"/i)
      ?? row.match(/href="([^"]*[Cc]aption[^"]*\.php[^"]*)"/i);
    const caption_url = captionMatch
      ? (captionMatch[1].startsWith('http') ? captionMatch[1] : `${GRANICUS_BASE}/${captionMatch[1].replace(/^\//, '')}`)
      : null;

    // Extract agenda link if present
    const agendaMatch = row.match(/href="([^"]*AgendaViewer[^"]*)"/i)
      ?? row.match(/href="([^"]*Agenda[^"]*\.pdf[^"]*)"/i);
    const agenda_url = agendaMatch
      ? (agendaMatch[1].startsWith('http') ? agendaMatch[1] : `${GRANICUS_BASE}/${agendaMatch[1].replace(/^\//, '')}`)
      : null;

    clips.push({ clip_id, date, date_str: toISODate(date), caption_url, agenda_url });
  }

  // Sort newest first, dedupe by clip_id
  const seen = new Set<string>();
  const unique = clips.filter(c => { if (seen.has(c.clip_id)) return false; seen.add(c.clip_id); return true; });
  unique.sort((a, b) => b.date.getTime() - a.date.getTime());

  console.log(`Found ${unique.length} Rec & Parks Commission meetings from 2025+.`);
  return unique;
}

// ── Caption / transcript fetcher ──────────────────────────────────────────────

async function fetchTranscriptText(clip: GranicusClip): Promise<string | null> {
  // Try caption URLs in priority order
  const candidates = [
    clip.caption_url,
    `${GRANICUS_BASE}/CCaptionViewer.php?clip_id=${clip.clip_id}`,
    `${GRANICUS_BASE}/TranscriptViewer.php?clip_id=${clip.clip_id}`,
  ].filter(Boolean) as string[];

  // Dedupe
  const urls = [...new Set(candidates)];

  for (const url of urls) {
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) break;  // try next URL
        const html = await res.text();
        const text = stripHtml(html);
        if (text.length > 300) {
          // Cap at 60KB — covers most of a 2-hour commission meeting transcript
          return text.slice(0, 60000);
        }
        break;  // too short, try next URL
      } catch {
        if (attempt < FETCH_RETRIES) await sleep(3000);
      }
    }
  }

  return null;
}

// ── Claude extraction ─────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a legislative data extractor for CityPulse, an SF urban intelligence platform. Return ONLY valid JSON — no markdown, no prose, no code fences.`;

async function extractMeeting(
  text:    string,
  dateStr: string,
): Promise<ExtractedMeeting | null> {
  const prompt = `This is transcript/caption text from a SF Recreation and Park Commission meeting on ${dateStr}.

Extract ALL substantive agenda items discussed at this meeting. Skip administrative procedural items like: roll call, public comment periods, approval of prior minutes, adjournment.

For each item return:
- item_letter: the agenda letter (e.g. "A", "B", "C") if visible, or null
- title: specific 1-sentence title, max 100 chars — name the park/facility and what's proposed
- description: 2-sentence summary. Be specific — cite park names, dollar amounts, program names, what was approved.
- action: one of: "APPROVED", "APPROVED AS AMENDED", "CONTINUED", "REJECTED", "WITHDRAWN", "RECEIVED AND FILED", "TABLED", "NOTED AND FILED", or null if unclear
- vote_result: e.g. "Unanimous", "5-1", "7-0" or null
- locations: array of SF park/facility names mentioned (e.g. ["Golden Gate Park", "Dolores Park", "Coit Tower"])
- topics: 1-3 from ONLY: "capital improvements", "events", "policy", "maintenance", "community programs", "budget"

Also determine:
- meeting_type: usually "Full Commission" — note if Special Meeting or Committee

Return ONLY this JSON:
{
  "meeting_type": "Full Commission",
  "items": [
    {
      "item_letter": "A",
      "title": "...",
      "description": "...",
      "action": "...",
      "vote_result": "...",
      "locations": [],
      "topics": []
    }
  ]
}

TRANSCRIPT TEXT:
${text}`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 6144,
      system:     EXTRACT_SYSTEM,
      messages:   [{ role: 'user', content: prompt }],
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

/** Extract complete items even from truncated JSON output. */
function repairExtractedJson(raw: string): ExtractedMeeting | null {
  try {
    const parsed = JSON.parse(raw) as ExtractedMeeting;
    if (Array.isArray(parsed.items)) return parsed;
  } catch { /* fall through */ }

  const mtMatch = raw.match(/"meeting_type"\s*:\s*"([^"]+)"/);
  const meeting_type = mtMatch ? mtMatch[1] : 'Full Commission';

  const arrayStart = raw.indexOf('"items"');
  if (arrayStart === -1) return null;
  const bracketOpen = raw.indexOf('[', arrayStart);
  if (bracketOpen === -1) return null;

  const items: RecParkItem[] = [];
  let depth = 0, itemStart = -1;

  for (let i = bracketOpen + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') { if (depth === 0) itemStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && itemStart !== -1) {
        try {
          const item = JSON.parse(raw.slice(itemStart, i + 1)) as RecParkItem;
          if (item.title) items.push(item);
        } catch { /* skip */ }
        itemStart = -1;
      }
    } else if (ch === ']' && depth === 0) break;
  }

  return items.length ? { meeting_type, items } : null;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getExistingDates(): Promise<Set<string>> {
  const { data } = await supabase
    .from('recpark_meetings')
    .select('meeting_date, meeting_type');
  return new Set((data ?? []).map((r: { meeting_date: string; meeting_type: string }) =>
    `${r.meeting_date}|${r.meeting_type}`,
  ));
}

async function insertMeeting(
  meeting_date: string,
  meeting_type: string,
  pdf_url:      string | null,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('recpark_meetings')
    .upsert(
      { meeting_date, meeting_type, pdf_url, processed_at: new Date().toISOString() },
      { onConflict: 'meeting_date,meeting_type' },
    )
    .select('id')
    .single();
  if (error) { console.error('  Meeting upsert error:', error.message); return null; }
  return (data as { id: number } | null)?.id ?? null;
}

async function insertItems(meeting_id: number, items: RecParkItem[]): Promise<void> {
  const rows = items.map(item => ({
    meeting_id,
    item_letter: item.item_letter ?? null,
    title:       item.title,
    description: item.description,
    action:      item.action ?? null,
    vote_result: item.vote_result ?? null,
    locations:   item.locations ?? [],
    topics:      item.topics ?? [],
    ai_summary:  item.description,
  }));
  const { error } = await supabase.from('recpark_items').insert(rows);
  if (error) console.error('  Items insert error:', error.message);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[DRY RUN] No data will be written.\n');

  const clips = await fetchClipList();

  const existing   = await getExistingDates();
  const newClips   = clips.filter(c => !existing.has(`${c.date_str}|Full Commission`));
  const toProcess  = DRY_RUN ? newClips.slice(0, 2) : newClips.slice(0, LIMIT);

  console.log(
    `${toProcess.length} meetings to process ` +
    `(${existing.size} already in DB, ${DRY_RUN ? 'dry-run cap=2' : `limit=${LIMIT}`})\n`,
  );

  let saved = 0, failed = 0;

  for (const clip of toProcess) {
    process.stdout.write(`[${clip.date_str}] clip_id=${clip.clip_id} — fetching transcript… `);

    let text: string | null = null;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      text = await fetchTranscriptText(clip);
      if (text) break;
      if (attempt < FETCH_RETRIES) {
        process.stdout.write(`(retry ${attempt})… `);
        await sleep(4000);
      }
    }

    if (!text) {
      process.stdout.write('no transcript available\n');
      failed++;
      await sleep(FETCH_DELAY_MS);
      continue;
    }

    process.stdout.write(`${Math.round(text.length / 100) / 10}KB — extracting… `);
    await sleep(FETCH_DELAY_MS);

    const extracted = await extractMeeting(text, clip.date_str);
    if (!extracted || !Array.isArray(extracted.items) || extracted.items.length === 0) {
      process.stdout.write('extraction failed\n');
      failed++;
      await sleep(CLAUDE_DELAY_MS);
      continue;
    }

    const { meeting_type, items } = extracted;

    if (DRY_RUN) {
      process.stdout.write(`OK\n`);
      console.log(`  Meeting type: "${meeting_type}"  |  Items: ${items.length}`);
      const sample = items.slice(0, 3);
      for (const item of sample) {
        console.log(`\n  [${item.item_letter ?? '?'}] ${item.title.slice(0, 85)}`);
        console.log(`    Action: ${item.action ?? 'unknown'}  |  Vote: ${item.vote_result ?? 'unknown'}`);
        console.log(`    Topics: [${item.topics.join(', ')}]  Locations: [${item.locations.join(', ') || 'none'}]`);
        if (item.description) console.log(`    ${item.description.slice(0, 140)}…`);
      }
      if (items.length > 3) console.log(`\n  … and ${items.length - 3} more items`);
      console.log('');
    } else {
      const meetingId = await insertMeeting(clip.date_str, meeting_type, clip.agenda_url);
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

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
