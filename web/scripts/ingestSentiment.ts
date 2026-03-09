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
 *   ANTHROPIC_API_KEY
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
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const GRANICUS_BASE    = 'https://sanfrancisco.granicus.com';
const GRANICUS_VIEW_ID = 20; // SF Planning Commission

// VTT transcripts are much smaller than PDFs — 10s between clips is enough
const RATE_LIMIT_MS = 10_000;

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required env vars. Check VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.');
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
 * Rows use class "odd"/"even"; dates are MM/DD/YY (2-digit year);
 * clip_id appears in MediaPlayer/TranscriptViewer href query params.
 */
async function fetchGranicusClips(): Promise<GranicusClip[]> {
  const url = `${GRANICUS_BASE}/ViewPublisher.php?view_id=${GRANICUS_VIEW_ID}`;
  console.log(`Fetching Granicus clip list: ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Granicus ViewPublisher returned ${res.status}`);
  const html = await res.text();

  const clips: GranicusClip[] = [];
  const seen  = new Set<string>();

  // Rows are <tr class="odd" ...> or <tr class="even" ...>
  const rowRegex = /<tr\s+class="(?:odd|even)"[^>]*>([\s\S]*?)<\/tr>/gi;
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

    clips.push({ clip_id, dateStr, title: `Planning Commission ${dateStr}` });
  }

  // Sort newest → oldest
  clips.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  console.log(`Found ${clips.length} clips.`);
  return clips;
}

/**
 * Parse a Granicus date to YYYY-MM-DD.
 * Handles MM/DD/YY (2-digit year, e.g. "02/12/26") and MM/DD/YYYY.
 * Falls back to the hidden unix timestamp span if present.
 */
function parseGranicusDate(cellHtml: string): string | null {
  // Prefer the hidden unix timestamp: <span style="display:none;">1770883200</span>MM/DD/YY
  const tsMatch = cellHtml.match(/<span[^>]*style="display:none;"[^>]*>(\d{9,10})<\/span>/i);
  if (tsMatch) {
    const ts = parseInt(tsMatch[1], 10) * 1000;
    const d  = new Date(ts);
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // MM/DD/YY or MM/DD/YYYY
  const slashMatch = cellHtml.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashMatch) {
    const [, mm, dd, yy] = slashMatch;
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return null;
}

// ── VTT transcript fetch ──────────────────────────────────────────────────────

/**
 * Download the caption transcript for a Granicus clip.
 *
 * Granicus TranscriptViewer returns an HTML page where the transcript text
 * is rendered directly in the body with <br> line breaks — not a VTT file.
 * We fetch the HTML and strip all tags to get plain text.
 */
async function fetchTranscript(clipId: string): Promise<string | null> {
  const url = `${GRANICUS_BASE}/TranscriptViewer.php?view_id=${GRANICUS_VIEW_ID}&clip_id=${clipId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const html = await res.text();

    // The transcript text starts after the closing </table> of the header block.
    // Strip HTML tags and collapse whitespace to get clean plain text.
    const afterHeader = html.replace(/[\s\S]*?<\/table>/i, '');
    const plainText = afterHeader
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return plainText.length > 100 ? plainText : null;
  } catch {
    return null;
  }
}

// ── Public comment extraction ─────────────────────────────────────────────────

/**
 * Extract public comment content from a full hearing transcript.
 *
 * Planning Commission hearings span many hours with multiple agenda items,
 * each having its own public comment period. Rather than trying to parse
 * the window boundaries exactly, we:
 *   1. Collect all >> speaker lines (Granicus marks turns with >>)
 *   2. Include surrounding lines for context
 *   3. Skip lines that are clearly staff/commissioner boilerplate
 *   4. Return up to 12k chars for Claude to analyze
 *
 * Claude's prompt instructs it to ignore procedural/continuance testimony
 * and focus on development project positions.
 */
function extractPublicCommentSection(transcript: string): string {
  const lines = transcript.split('\n').map(l => l.trim()).filter(Boolean);

  // Lines that are routine boilerplate (not speaker testimony)
  const BOILERPLATE_RE = /EACH SPEAKER WILL BE ALLOWED|THREE MINUTES|CHIME INDICATING|SPEAK CLEARLY|SILENCE ANY MOBILE|COMMISSION DOES NOT TOLERATE|PLEASE STATE YOUR NAME|WHEN YOU'RE ALLOTTED|TIMER ON THE PODIUM|LINE UP ON THE SCREEN/i;

  // Collect speaker turns (lines starting with >>) and their following context lines
  const speakerBlocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('>>') || line.startsWith('> >')) {
      if (BOILERPLATE_RE.test(line)) continue;
      // Grab this line plus up to 8 continuation lines
      const block: string[] = [line];
      for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
        const next = lines[j];
        if (next.startsWith('>>') || /PUBLIC\s+COMMENT\s+(?:IS\s+)?CLOSED/i.test(next)) break;
        if (!BOILERPLATE_RE.test(next)) block.push(next);
      }
      speakerBlocks.push(block.join(' '));
    }
  }

  if (speakerBlocks.length === 0) {
    // No >> markers found — return middle section of transcript
    const mid = Math.floor(transcript.length / 3);
    return transcript.slice(mid, mid + 12_000);
  }

  // Cap at 12k chars
  let combined = speakerBlocks.join('\n');
  if (combined.length > 12_000) combined = combined.slice(0, 12_000);
  return combined;
}

// ── Claude sentiment analysis ─────────────────────────────────────────────────

const SENTIMENT_SYSTEM = `You are an expert at analyzing public comment testimony from San Francisco Planning Commission hearings.
You will receive speaker turns extracted from a full Planning Commission hearing transcript.
The hearing typically covers multiple agenda items (development projects, conditional use authorizations, appeals, etc.).

Your task: identify all members of the public who testified about development projects or land use items,
and classify their collective positions.

Return ONLY a valid JSON object with this exact structure:
{
  "speakers": <total distinct public speakers on development/land-use items as integer>,
  "for_project": <count who spoke in support of the relevant project(s) as integer>,
  "against_project": <count who spoke in opposition as integer>,
  "neutral": <count with mixed, unclear, or question-only positions as integer>,
  "top_themes": [<up to 5 recurring themes or concerns raised, as short concrete phrases>],
  "notable_quotes": [<up to 3 verbatim excerpts that best capture the range of opinion, under 200 chars each>]
}

Rules:
- Only count members of the public — not commissioners, staff, or the project sponsor presenting their own project.
- Exclude speakers on purely procedural/continuance items unless they express a substantive position.
- If a speaker's position is ambiguous, count as neutral.
- If no public speakers are identifiable, return all zeros and empty arrays.
- Themes should be concrete (e.g. "shadow impact on St. Mary's Square", "noise from construction", "insufficient affordable housing").
- Quotes must be verbatim text from the transcript.
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
  // Use RPC to bypass the PostgREST schema cache (avoids "column not found" errors
  // that occur after ALTER TABLE until the cache is manually reloaded).
  const { error } = await supabase.rpc('upsert_sentiment', {
    p_hearing_id:      hearingId,
    p_clip_id:         clipId,
    p_speakers:        result.speakers,
    p_for_project:     result.for_project,
    p_against_project: result.against_project,
    p_neutral:         result.neutral,
    p_top_themes:      result.top_themes,
    p_notable_quotes:  result.notable_quotes,
    p_source:          'sfgovtv_captions',
  });

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
