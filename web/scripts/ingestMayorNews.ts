/**
 * scripts/ingestMayorNews.ts — CityPulse
 *
 * Scrapes https://www.sf.gov/news-from-the-office-of-the-mayor,
 * fetches each article body, tags with Claude Haiku, and upserts
 * to the mayor_news Supabase table.
 *
 * Usage:
 *   npx tsx scripts/ingestMayorNews.ts [--limit 50] [--dry-run]
 *
 * Required env vars (in .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
 *   ANTHROPIC_API_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env manually ────────────────────────────────────────────────────────

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

const LIST_URL = 'https://www.sf.gov/news-from-the-office-of-the-mayor';

// Polite delays — SF.gov is a government site
const FETCH_DELAY_MS  = 600;   // Between article page fetches
const CLAUDE_DELAY_MS = 1500;  // Between Claude Haiku calls

const args    = process.argv.slice(2);
const LIMIT   = parseInt(args[args.indexOf('--limit') + 1] ?? '50', 10) || 50;
const DRY_RUN = args.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required env vars. Check VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.');
  process.exit(1);
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

interface PressRelease {
  title: string;
  date:  string; // YYYY-MM-DD
  url:   string;
}

interface TaggedRelease {
  ai_summary: string;
  districts:  string[];
  topics:     string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g,    ' ')
    .trim();
}

/** "February 25, 2026:" → "2026-02-25" */
function parseDate(raw: string): string | null {
  const clean = raw.replace(/:\s*$/, '').trim();
  const d = new Date(clean);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── List page scraper ─────────────────────────────────────────────────────────

async function fetchPressReleaseList(): Promise<PressRelease[]> {
  console.log(`Fetching list page: ${LIST_URL}`);
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error(`List page returned ${res.status}`);
  const html = await res.text();

  const items: PressRelease[] = [];

  // Each item: <p class="..." data-block-key="..."><b>Month DD, YYYY: </b><a href="url">Title</a></p>
  const itemRegex = /<p\b[^>]*data-block-key="[^"]+"><b>(.*?)<\/b>\s*<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(html)) !== null) {
    const dateRaw = stripHtml(match[1]);
    const urlRaw  = match[2];
    const title   = stripHtml(match[3]);

    const date = parseDate(dateRaw);
    if (!date || !title || !urlRaw) continue;

    const url = urlRaw.startsWith('http') ? urlRaw : `https://www.sf.gov${urlRaw}`;
    items.push({ title, date, url });
  }

  // Newest first
  items.sort((a, b) => b.date.localeCompare(a.date));
  console.log(`Found ${items.length} press releases.`);
  return items;
}

// ── Article body fetcher ──────────────────────────────────────────────────────

async function fetchArticleBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const html = await res.text();

    // Extract all <p data-block-key="..."> elements (class may appear before data-block-key)
    const paragraphs: string[] = [];
    const pRegex = /<p\b[^>]*data-block-key="[^"]+"[^>]*>[\s\S]*?<\/p>/gi;
    let match: RegExpExecArray | null;

    while ((match = pRegex.exec(html)) !== null) {
      const text = stripHtml(match[0]);
      if (text.length < 40) continue;
      // Skip list-page-style date entries embedded in the article page
      if (/^\w+ \d{1,2}, \d{4}:\s/.test(text)) continue;
      paragraphs.push(text);
    }

    if (paragraphs.length === 0) return null;
    // Cap at 3000 chars — enough for a 2-sentence summary
    return paragraphs.join('\n\n').slice(0, 3000);
  } catch {
    return null;
  }
}

// ── Claude tagging ────────────────────────────────────────────────────────────

const TAG_SYSTEM = `You are a news categorization tool for CityPulse, an SF urban intelligence platform. Return ONLY valid JSON — no markdown, no prose, no code fences.`;

async function tagWithClaude(pr: PressRelease, body: string): Promise<TaggedRelease | null> {
  const prompt = `Press release title: ${pr.title}

Press release body:
${body}

1. Write a 2-sentence summary. Be specific — cite names, numbers, locations, and policy details.
2. Which SF Supervisor Districts are primarily affected? Use district numbers as strings: "1"–"11". Include "citywide" if it affects all of San Francisco. Return [] if unclear.
3. Tag with 1–3 topics from ONLY this list: housing, safety, transit, business, budget, parks, infrastructure, other.

Return ONLY this JSON:
{"ai_summary":"...","districts":[],"topics":[]}`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     TAG_SYSTEM,
      messages:   [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== 'text') return null;

    const raw = block.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(raw) as TaggedRelease;
  } catch (err) {
    console.error('  Claude error:', err);
    return null;
  }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getExistingUrls(): Promise<Set<string>> {
  const { data } = await supabase
    .from('mayor_news')
    .select('url')
    .not('url', 'is', null);
  return new Set((data ?? []).map((r: { url: string }) => r.url));
}

async function upsert(
  pr:     PressRelease,
  body:   string | null,
  tagged: TaggedRelease,
): Promise<void> {
  const { error } = await supabase.from('mayor_news').upsert(
    {
      title:      pr.title,
      date:       pr.date,
      summary:    body ? body.slice(0, 500) : null,
      ai_summary: tagged.ai_summary,
      url:        pr.url,
      districts:  tagged.districts,
      topics:     tagged.topics,
    },
    { onConflict: 'title,date' },
  );
  if (error) console.error('  Supabase upsert error:', error.message);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[DRY RUN] No data will be written.\n');

  const allItems  = await fetchPressReleaseList();
  const existing  = await getExistingUrls();

  const toProcess = allItems
    .filter(item => !existing.has(item.url))
    .slice(0, LIMIT);

  console.log(
    `${toProcess.length} new items to process ` +
    `(${existing.size} already in DB, limit=${LIMIT})\n`,
  );

  let saved = 0, failed = 0;

  for (const pr of toProcess) {
    process.stdout.write(`[${pr.date}] ${pr.title.slice(0, 65).padEnd(65)} — `);

    // Fetch article body
    const body = await fetchArticleBody(pr.url);
    if (!body) {
      process.stdout.write('fetch failed\n');
      failed++;
      await sleep(FETCH_DELAY_MS);
      continue;
    }
    process.stdout.write(`${String(Math.round(body.length / 100) / 10).padStart(4)}KB — tagging… `);
    await sleep(FETCH_DELAY_MS);

    // Tag with Claude Haiku
    const tagged = await tagWithClaude(pr, body);
    if (!tagged) {
      process.stdout.write('tagging failed\n');
      failed++;
      await sleep(CLAUDE_DELAY_MS);
      continue;
    }

    if (DRY_RUN) {
      process.stdout.write(
        `[dry-run] districts=[${tagged.districts.join(',')}] topics=[${tagged.topics.join(',')}]\n`,
      );
    } else {
      await upsert(pr, body, tagged);
      process.stdout.write(
        `saved  topics=[${tagged.topics.join(',')}]  districts=[${tagged.districts.join(',') || 'none'}]\n`,
      );
      saved++;
    }

    await sleep(CLAUDE_DELAY_MS);
  }

  console.log(`\nDone. Saved: ${saved} | Failed: ${failed} | Already in DB: ${existing.size}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
