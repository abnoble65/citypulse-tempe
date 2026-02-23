/**
 * SF Planning Commission Public Comment Sentiment Ingestion
 *
 * 1. Fetches the SF Planning Commission clip list from Granicus (SFGovTV)
 * 2. Matches each clip to a hearing row in Supabase by date
 * 3. Downloads the VTT caption transcript for that clip
 * 4. Extracts the public comment section and sends it to Claude for sentiment analysis
 * 5. Upserts the result into the public_sentiment table
 *
 * Usage:
 *   npx tsx scripts/ingestSentiment.ts
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

const GRANICUS_BASE    = 'https://sanfrancisco.granicus.com';
const GRANICUS_VIEW_ID = 20; // SF Planning Commission

// VTT transcripts are much smaller than PDFs — 10s between clips is enough
const RATE_LIMIT_MS = 10_000;

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required env vars. Check VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, VITE_ANTHROPIC_API_KEY.');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

interface GranicusClip {
  clip_id: string;
  dateStr: string; // YYYY-MM-DD
  title:   string;
}

interface SentimentResult {
  speakers:        number;
  for_project:     number;
  against_project: number;
  neutral:         number;
  top_themes:      string[];
  notable_quotes:  string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.status === 429) return true;
    if (typeof e.message === 'string' && e.message.includes('rate_limit')) return true;
  }
  return false;
}

// ── Granicus clip list ────────────────────────────────────────────────────────

/**
 * Fetch all Planning Commission clips from the Granicus ViewPublisher page.
 * Parses clip_id and meeting date from the HTML table rows.
 */
async function fetchGranicusClips(): Promise<GranicusClip[]> {
  const url = `${GRANICUS_BASE}/ViewPublisher.php?view_id=${GRANICUS_VIEW_ID}`;
  console.log(`Fetching Granicus clip list: ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Granicus ViewPublisher returned ${res.status}`);
  const html = await res.text();

  const clips: GranicusClip[] = [];
  const seen  = new Set<string>();

  // Each meeting is a <tr class="listingRow"> (or similar).
  // MediaPlayer/TranscriptViewer links embed clip_id as a query param.
  const rowRegex = /<tr[^>]*class="[^"]*listingRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    const clipIdMatch = rowHtml.match(/clip_id=(\d+)/i);
    if (!clipIdMatch) continue;
    const clip_id = clipIdMatch[1];
    if (seen.has(clip_id)) continue;
    seen.add(clip_id);

    const dateStr = parseGranicusDate(rowHtml);
    if (!dateStr) continue;

    const titleMatch = rowHtml.match(/<td[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
      : `Planning Commission ${dateStr}`;

    clips.push({ clip_id, dateStr, title });
  }

  // Sort newest → oldest
  clips.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  console.log(`Found ${clips.length} clips.`);
  return clips;
}

/**
 * Parse a Granicus date string (from a table cell's inner HTML) to YYYY-MM-DD.
 * Handles "MM/DD/YYYY" and "Month DD, YYYY" formats.
 */
function parseGranicusDate(cellHtml: string): string | null {
  // MM/DD/YYYY
  const slashMatch = cellHtml.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // "Month DD, YYYY"
  const MONTHS: Record<string, string> = {
    january:'01', february:'02', march:'03', april:'04',
    may:'05', june:'06', july:'07', august:'08',
    september:'09', october:'10', november:'11', december:'12',
  };
  const longMatch = cellHtml.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (longMatch) {
    const [, monthName, dd, yyyy] = longMatch;
    const mm = MONTHS[monthName.toLowerCase()];
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }

  return null;
}

// ── VTT transcript fetch ──────────────────────────────────────────────────────

/**
 * Download the VTT caption transcript for a Granicus clip.
 *
 * Tries two approaches in order:
 *   1. Direct VTT via TranscriptViewer format parameter
 *   2. Parse the TranscriptViewer HTML for a .vtt download link
 */
async function fetchTranscript(clipId: string): Promise<string | null> {
  // Attempt 1: direct VTT download
  const directUrl = `${GRANICUS_BASE}/TranscriptViewer.php?clip_id=${clipId}&view_id=${GRANICUS_VIEW_ID}&format=vtt`;
  try {
    const directRes = await fetch(directUrl, { redirect: 'follow' });
    if (directRes.ok) {
      const text = await directRes.text();
      if (text.startsWith('WEBVTT') || text.includes('-->')) return text;
    }
  } catch { /* fall through */ }

  // Attempt 2: parse viewer HTML for a .vtt href
  const viewerUrl = `${GRANICUS_BASE}/TranscriptViewer.php?clip_id=${clipId}&view_id=${GRANICUS_VIEW_ID}`;
  try {
    const viewerRes = await fetch(viewerUrl);
    if (!viewerRes.ok) return null;
    const html = await viewerRes.text();

    const vttMatch = html.match(/href=["']([^"']*\.vtt[^"']*)["']/i);
    if (vttMatch) {
      const vttUrl = vttMatch[1].startsWith('http')
        ? vttMatch[1]
        : `${GRANICUS_BASE}/${vttMatch[1].replace(/^\//, '')}`;
      const vttRes = await fetch(vttUrl);
      if (vttRes.ok) return vttRes.text();
    }
  } catch { /* fall through */ }

  return null;
}

// ── Public comment extraction ─────────────────────────────────────────────────

/**
 * Strip VTT metadata and slice out the public comment portion of a transcript.
 *
 * Planning Commission hearings follow a predictable agenda: staff presentation,
 * project sponsor presentation, then "PUBLIC COMMENT". We extract from the
 * public comment header until commissioners resume substantive dialogue.
 *
 * Falls back to returning the full stripped transcript if no section marker found.
 */
function extractPublicCommentSection(vtt: string): string {
  const lines = vtt.split('\n');
  const cueLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^WEBVTT/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;               // cue sequence number
    if (/^\d{2}:\d{2}/.test(trimmed)) continue;        // timestamp
    if (/^NOTE\b/.test(trimmed)) continue;
    cueLines.push(trimmed);
  }

  const fullText = cueLines.join(' ');

  const pcStart = fullText.search(/public\s+comment/i);
  if (pcStart === -1) return fullText; // no marker — return all, Claude will find it

  // End when commissioner/chair dialogue resumes after at least 100 chars of public comment
  const afterPc = fullText.slice(pcStart + 100);
  const endRelative = afterPc.search(
    /\b(?:CHAIR|PRESIDENT|VICE\s+PRESIDENT|COMMISSIONER)\s+\w+\s*:/i
  );
  const endIdx = endRelative !== -1
    ? pcStart + 100 + endRelative
    : Math.min(pcStart + 15_000, fullText.length); // cap at ~15k chars

  return fullText.slice(pcStart, endIdx);
}

// ── Claude sentiment analysis ─────────────────────────────────────────────────

const SENTIMENT_SYSTEM = `You are an expert at analyzing public comment testimony from San Francisco Planning Commission hearings.
You will receive the transcript text of the public comment portion of a Planning Commission hearing.
Count the distinct public speakers and classify each speaker's position on the primary development project.

Return ONLY a valid JSON object with this exact structure:
{
  "speakers": <total distinct public speakers as integer>,
  "for_project": <count who spoke in support as integer>,
  "against_project": <count who spoke in opposition as integer>,
  "neutral": <count with mixed, unclear, or question-only positions as integer>,
  "top_themes": [<up to 5 recurring themes or concerns, as short concrete phrases>],
  "notable_quotes": [<up to 3 verbatim quotes capturing the range of opinion, under 200 chars each>]
}

Rules:
- Count only members of the public — not commissioners, staff, or the project sponsor.
- If a speaker's position is ambiguous, count them as neutral.
- Themes should be specific (e.g. "shadow impact on St. Mary's Square", "construction noise", "insufficient BMR percentage").
- Quotes must be genuine verbatim excerpts from the transcript, not paraphrases.
- for_project + against_project + neutral must equal speakers.
- Return ONLY the JSON — no markdown fences, no explanation.`;

const MAX_RETRIES = 3;

async function analyzeWithClaude(transcript: string): Promise<SentimentResult | null> {
  const publicSection = extractPublicCommentSection(transcript);

  if (publicSection.length < 100) {
    console.log('  No substantive public comment section found.');
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001', // haiku sufficient for structured extraction
        max_tokens: 1024,
        system:     SENTIMENT_SYSTEM,
        messages: [{
          role:    'user',
          content: `Public comment transcript:\n\n${publicSection}`,
        }],
      });

      const content = message.content[0];
      if (content.type !== 'text') return null;

      const raw = content.text
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      return JSON.parse(raw) as SentimentResult;
    } catch (err) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        const backoff = 30_000 * Math.pow(2, attempt);
        process.stdout.write(`rate limited, retrying in ${backoff / 1000}s… `);
        await sleep(backoff);
        continue;
      }
      console.error('  Claude error:', err);
      return null;
    }
  }
  return null;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

/** Look up a hearing row by date. Returns the UUID or null if not ingested yet. */
async function findHearingId(dateStr: string): Promise<string | null> {
  const { data } = await supabase
    .from('hearings')
    .select('id')
    .eq('hearing_date', dateStr)
    .maybeSingle();
  return data?.id ?? null;
}

/** True if a public_sentiment row already exists for this hearing. */
async function alreadyProcessed(hearingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('public_sentiment')
    .select('id')
    .eq('hearing_id', hearingId)
    .maybeSingle();
  return data !== null;
}

async function upsertSentiment(
  hearingId: string,
  clipId:    string,
  result:    SentimentResult,
): Promise<void> {
  const { error } = await supabase
    .from('public_sentiment')
    .upsert(
      {
        hearing_id:      hearingId,
        clip_id:         clipId,
        speakers:        result.speakers,
        for_project:     result.for_project,
        against_project: result.against_project,
        neutral:         result.neutral,
        top_themes:      result.top_themes,
        notable_quotes:  result.notable_quotes,
        source:          'sfgovtv_captions',
        processed_at:    new Date().toISOString(),
      },
      { onConflict: 'hearing_id' },
    );

  if (error) console.error('  Supabase upsert error:', error.message);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const clips = await fetchGranicusClips();

  let processed = 0;
  let skipped   = 0;
  let noMatch   = 0;
  let failed    = 0;

  for (const clip of clips) {
    process.stdout.write(`[${clip.dateStr}] clip_id=${clip.clip_id} — `);

    // Match to a hearing row in Supabase
    const hearingId = await findHearingId(clip.dateStr);
    if (!hearingId) {
      process.stdout.write('no hearing in DB, skipping\n');
      noMatch++;
      continue;
    }

    // Skip if already processed
    if (await alreadyProcessed(hearingId)) {
      process.stdout.write('already processed\n');
      skipped++;
      continue;
    }

    // Download VTT transcript
    process.stdout.write('fetching transcript… ');
    const transcript = await fetchTranscript(clip.clip_id);
    if (!transcript) {
      process.stdout.write('no transcript available\n');
      failed++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    process.stdout.write(`${Math.round(transcript.length / 1024)}KB — analyzing… `);

    // Analyze public comment sentiment with Claude
    const result = await analyzeWithClaude(transcript);
    if (!result) {
      process.stdout.write('analysis failed\n');
      failed++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    await upsertSentiment(hearingId, clip.clip_id, result);
    process.stdout.write(
      `saved (${result.speakers} speakers, ${result.for_project}↑ ${result.against_project}↓ ${result.neutral}~)\n`
    );
    processed++;

    await sleep(RATE_LIMIT_MS);
  }

  console.log(
    `\nDone. Processed: ${processed} | Already in DB: ${skipped} | No hearing match: ${noMatch} | Failed: ${failed}`
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
