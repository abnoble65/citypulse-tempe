/**
 * services/briefing.ts — CityPulse web
 *
 * Calls the Anthropic API directly from the browser using the key exposed
 * via VITE_ANTHROPIC_API_KEY in web/.env.
 */

import Anthropic from '@anthropic-ai/sdk';
import { aggregateDistrictData, aggregateCitywideData, type DistrictData } from './aggregator';
import { supabase } from './supabase';
import type { DistrictConfig } from '../districts';

interface ShadowProject {
  address: string | null;
  project_description: string | null;
  shadow_details: string | null;
}

export type { DistrictData };

export interface Signal {
  title: string;
  body: string;
  severity: 'low' | 'medium' | 'high';
  concern: string;
}

export interface OutlookEvent {
  title: string;
  timeframe: string;
  detail: string;
  impact: string;
  priority: 'low' | 'medium' | 'high';
}

export interface OutlookRisk {
  icon: string;
  title: string;
  detail: string;
  priority: 'low' | 'medium' | 'high';
}

export interface OutlookEngagement {
  title: string;
  detail: string;
}

export interface PublicConcern {
  headline: string;
  severity: 'watch' | 'alert' | 'critical';
  evidence: string;
  affects: string;
  action: string;
}

export interface OutlookData {
  events: OutlookEvent[];
  risks: OutlookRisk[];
  engagement: OutlookEngagement[];
}

/** Strip non-essential fields before serialising DistrictData to an AI prompt.
 *  Removes map_permits (geocoded list, ~15K tokens), by_district (citywide index,
 *  ~300K tokens), and citywide_prompt_summary (handled separately). */
function forPrompt(data: DistrictData): Omit<DistrictData, 'map_permits' | 'by_district' | 'citywide_prompt_summary'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { map_permits: _, by_district: __, citywide_prompt_summary: ___, ...rest } = data;
  return rest;
}

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

// ── Mayor's Office cross-reference ────────────────────────────────────────────
// Fetches the 2 most recent mayor_news items relevant to the district and
// injects them into AI prompts as a short context block. Cached per district.

const _mayorCache = new Map<string, string>(); // districtNumber → context string

async function getMayorNewsContext(districtNumber: string): Promise<string> {
  if (_mayorCache.has(districtNumber)) return _mayorCache.get(districtNumber)!;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data } = await supabase
      .from('mayor_news')
      .select('title, date, topics, districts')
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false })
      .limit(20);

    if (!data || data.length === 0) {
      _mayorCache.set(districtNumber, '');
      return '';
    }

    const relevant = data.filter((item: { districts: string[] | null }) => {
      if (districtNumber === '0') return true;
      const dists: string[] = item.districts ?? [];
      return dists.length === 0 || dists.includes(districtNumber) || dists.includes('citywide');
    }).slice(0, 2);

    if (relevant.length === 0) {
      _mayorCache.set(districtNumber, '');
      return '';
    }

    const lines = relevant.map((item: { date: string; title: string; topics: string[] | null }) =>
      `- ${item.date}: "${item.title}" (topics: ${(item.topics ?? []).join(', ') || 'general'})`
    );
    const ctx = `\nRECENT MAYOR'S OFFICE ANNOUNCEMENTS (mention if relevant, max 2 references):\n${lines.join('\n')}\n`;
    _mayorCache.set(districtNumber, ctx);
    return ctx;
  } catch {
    // Table may not exist yet — silently skip
    _mayorCache.set(districtNumber, '');
    return '';
  }
}

// ── Board of Supervisors cross-reference ──────────────────────────────────────
// Fetches the 2 most recent bos_items relevant to the district from the last
// 60 days and injects them into AI prompts. Cached per district.

const _bosCache = new Map<string, string>(); // districtNumber → context string

async function getBosContext(districtNumber: string): Promise<string> {
  if (_bosCache.has(districtNumber)) return _bosCache.get(districtNumber)!;

  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Fetch recent meeting IDs
    const { data: meetings } = await supabase
      .from('bos_meetings')
      .select('id')
      .gte('meeting_date', sixtyDaysAgo);

    const meetingIds = (meetings ?? []).map((m: { id: number }) => m.id);
    if (meetingIds.length === 0) { _bosCache.set(districtNumber, ''); return ''; }

    // Fetch items for those meetings
    const { data: items } = await supabase
      .from('bos_items')
      .select('file_number, title, action_taken, districts, topics')
      .in('meeting_id', meetingIds)
      .limit(40);

    if (!items || items.length === 0) { _bosCache.set(districtNumber, ''); return ''; }

    const relevant = (items as { file_number: string; title: string; action_taken: string | null; districts: string[] | null; topics: string[] | null }[])
      .filter(item => {
        if (districtNumber === '0') return true;
        const dists = item.districts ?? [];
        return dists.length === 0 || dists.includes(districtNumber) || dists.includes('citywide');
      })
      .slice(0, 2);

    if (relevant.length === 0) { _bosCache.set(districtNumber, ''); return ''; }

    const lines = relevant.map(item =>
      `- File ${item.file_number}: "${item.title}" — ${item.action_taken ?? 'pending'} (topics: ${(item.topics ?? []).join(', ') || 'general'})`
    );
    const ctx = `\nRECENT BOARD OF SUPERVISORS ACTIONS (mention if relevant, max 2 references):\n${lines.join('\n')}\n`;
    _bosCache.set(districtNumber, ctx);
    return ctx;
  } catch {
    // Table may not exist yet — silently skip
    _bosCache.set(districtNumber, '');
    return '';
  }
}

// Fetches the 2 most recent recpark_items from the last 60 days and injects
// them into AI prompts. Cached per district.

const _parksCache = new Map<string, string>(); // districtNumber → context string

async function getParksContext(districtNumber: string): Promise<string> {
  if (_parksCache.has(districtNumber)) return _parksCache.get(districtNumber)!;

  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: meetings } = await supabase
      .from('recpark_meetings')
      .select('id')
      .gte('meeting_date', sixtyDaysAgo);

    const meetingIds = (meetings ?? []).map((m: { id: number }) => m.id);
    if (meetingIds.length === 0) { _parksCache.set(districtNumber, ''); return ''; }

    const { data: items } = await supabase
      .from('recpark_items')
      .select('item_letter, title, action, locations, topics')
      .in('meeting_id', meetingIds)
      .limit(30);

    if (!items || items.length === 0) { _parksCache.set(districtNumber, ''); return ''; }

    const relevant = (items as { item_letter: string | null; title: string; action: string | null; locations: string[] | null; topics: string[] | null }[])
      .filter(item => item.title && item.title.length > 5)
      .slice(0, 2);

    if (relevant.length === 0) { _parksCache.set(districtNumber, ''); return ''; }

    const lines = relevant.map(item =>
      `- "${item.title}" — ${item.action ?? 'discussed'} (parks: ${(item.locations ?? []).join(', ') || 'citywide'})`
    );
    const ctx = `\nRECENT REC & PARKS COMMISSION ACTIONS (mention if relevant, max 2 references):\n${lines.join('\n')}\n`;
    _parksCache.set(districtNumber, ctx);
    return ctx;
  } catch {
    // Table may not exist yet — silently skip
    _parksCache.set(districtNumber, '');
    return '';
  }
}

// ── Public sentiment cross-reference ──────────────────────────────────────────
// Aggregates public comment data from recent Planning Commission hearings and
// injects a speaker-count / theme / quote summary into AI prompts.
// Cached per district number (sentiment is not reliably zip-filterable without
// geocoding; neighborhood views fall back to district-level data).

const _sentimentCache = new Map<string, string>(); // districtNumber → context string

type SentimentRow = {
  speakers:        number;
  for_project:     number;
  against_project: number;
  neutral:         number;
  top_themes:      string[] | null;
  notable_quotes:  string[] | null;
};

async function getSentimentContext(districtNumber: string): Promise<string> {
  console.log('[sentiment] getSentimentContext called', districtNumber);
  if (_sentimentCache.has(districtNumber)) return _sentimentCache.get(districtNumber)!;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('projects')
      .select(`
        hearing:hearing_id(
          public_sentiment(
            speakers, for_project, against_project, neutral,
            top_themes, notable_quotes
          )
        )
      `)
      .not('hearing_id', 'is', null)
      .order('id', { ascending: false })
      .limit(districtNumber === '0' ? 60 : 30);

    if (districtNumber !== '0') {
      query = query.eq('district', districtNumber);
    }

    const { data } = await query;
    console.log('[sentiment] query returned rows:', data?.length ?? 0);
    if (!data || data.length === 0) {
      console.log('[sentiment] no sentiment rows found');
      _sentimentCache.set(districtNumber, ''); return '';
    }

    // Flatten all sentiment records (one per hearing)
    const sentiments: SentimentRow[] = [];
    for (const row of data as Array<{ hearing: { public_sentiment: SentimentRow[] } | null }>) {
      const sent = row.hearing?.public_sentiment?.[0];
      if (sent) sentiments.push(sent);
    }
    if (sentiments.length === 0) {
      console.log('[sentiment] no sentiment rows found');
      _sentimentCache.set(districtNumber, ''); return '';
    }

    const totalSpeakers = sentiments.reduce((s, r) => s + (r.speakers ?? 0), 0);
    const totalFor      = sentiments.reduce((s, r) => s + (r.for_project ?? 0), 0);
    const totalAgainst  = sentiments.reduce((s, r) => s + (r.against_project ?? 0), 0);
    const totalNeutral  = sentiments.reduce((s, r) => s + (r.neutral ?? 0), 0);
    const totalVoiced   = totalFor + totalAgainst + totalNeutral || 1;

    const pctFor     = Math.round((totalFor     / totalVoiced) * 100);
    const pctAgainst = Math.round((totalAgainst / totalVoiced) * 100);
    const pctNeutral = Math.round((totalNeutral / totalVoiced) * 100);

    // Theme frequency count → top 5
    const themeCounts = new Map<string, number>();
    for (const row of sentiments) {
      for (const t of row.top_themes ?? []) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }
    }
    const topThemes = [...themeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    // Pick up to 3 notable quotes
    const quotes = sentiments.flatMap(r => r.notable_quotes ?? []).filter(Boolean).slice(0, 3);

    const scope = districtNumber === '0' ? 'across all SF districts' : `in District ${districtNumber}`;
    const ctx = `
PUBLIC COMMENT SUMMARY (from recent Planning Commission hearings ${scope}):
Across ${sentiments.length} recent hearing${sentiments.length !== 1 ? 's' : ''}, ${totalSpeakers} speakers gave public comment. ${pctFor}% supported projects, ${pctAgainst}% opposed, ${pctNeutral}% were neutral.
Most common themes raised: ${topThemes.length > 0 ? topThemes.join(', ') : 'none recorded'}.${quotes.length > 0 ? `\nNotable quotes: ${quotes.map(q => `"${q}"`).join(' | ')}` : ''}

Use this sentiment data to add resident voice to your analysis. Reference specific themes or opposition patterns where relevant.
`;

    _sentimentCache.set(districtNumber, ctx);
    console.log('[sentiment] returning context length:', ctx.length);
    console.log('[sentiment] context:', ctx);
    return ctx;
  } catch (error) {
    console.log('[sentiment] error:', error instanceof Error ? error.message : String(error));
    // Table may not exist yet — silently skip
    _sentimentCache.set(districtNumber, '');
    return '';
  }
}

// ── Gov-page AI headlines ─────────────────────────────────────────────────────
// One Haiku call per page; cached in sessionStorage with 1-hour TTL.

export async function generateGovHeadlines(
  items: Array<{ title: string }>,
  cacheKey: string,
): Promise<string[]> {
  if (items.length === 0) return [];

  // Check sessionStorage (1-hour TTL)
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as { ts: number; headlines: string[] };
      if (Date.now() - cached.ts < 3_600_000) return cached.headlines;
    }
  } catch { /* sessionStorage unavailable */ }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `For each of the following San Francisco government actions, write one plain-language headline a resident would understand (max 80 chars each). Return as a JSON array of strings only.\n\n${JSON.stringify(items.map(i => i.title))}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  let headlines: string[] = [];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    headlines = JSON.parse(match?.[0] ?? '[]') as string[];
  } catch { headlines = []; }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), headlines }));
  } catch { /* ignore */ }

  return headlines;
}

// ── Session-level AI content caches ───────────────────────────────────────────
// Keyed by "districtNumber:zip" (neighborhood-filtered) or "districtNumber:all".
// Switching between previously-visited combos is instant — no Claude call needed.
const _briefingCache = new Map<string, string>();
const _signalsCache  = new Map<string, { signals: Signal[]; generatedAt: string | null }>();
const _outlookCache  = new Map<string, { outlook: OutlookData; generatedAt: string | null }>();
const _concernsCache = new Map<string, { concerns: PublicConcern[]; generatedAt: string | null }>();

// ── Supabase signal_cache helpers ─────────────────────────────────────────────
// 24-hour TTL: stale signals are silently replaced on next generation.
const SIGNALS_DB_TTL_MS = 24 * 60 * 60 * 1000;

async function readSignalsFromDB(
  cacheKey: string,
): Promise<{ signals: Signal[]; generatedAt: string } | null> {
  try {
    const { data, error } = await supabase
      .from('signal_cache')
      .select('signals, generated_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    const age = Date.now() - new Date(data.generated_at as string).getTime();
    if (age > SIGNALS_DB_TTL_MS) return null; // expired — regenerate

    return {
      signals: data.signals as Signal[],
      generatedAt: data.generated_at as string,
    };
  } catch {
    return null; // table may not exist yet — fail silently
  }
}

async function writeSignalsToDB(
  cacheKey: string,
  signals: Signal[],
): Promise<string | null> {
  try {
    const generatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('signal_cache')
      .upsert(
        { cache_key: cacheKey, signals, generated_at: generatedAt },
        { onConflict: 'cache_key' },
      );
    if (error) return null;
    return generatedAt;
  } catch {
    return null;
  }
}

// ── Supabase outlook_cache helpers ────────────────────────────────────────────
// 24-hour TTL: stale outlook is silently replaced on next generation.
const OUTLOOK_DB_TTL_MS = 24 * 60 * 60 * 1000;

async function readOutlookFromDB(
  cacheKey: string,
): Promise<{ outlook: OutlookData; generatedAt: string } | null> {
  try {
    const { data, error } = await supabase
      .from('outlook_cache')
      .select('outlook, generated_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    const age = Date.now() - new Date(data.generated_at as string).getTime();
    if (age > OUTLOOK_DB_TTL_MS) return null;
    return { outlook: data.outlook as OutlookData, generatedAt: data.generated_at as string };
  } catch {
    return null;
  }
}

async function writeOutlookToDB(
  cacheKey: string,
  outlook: OutlookData,
): Promise<string | null> {
  try {
    const generatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('outlook_cache')
      .upsert(
        { cache_key: cacheKey, outlook, generated_at: generatedAt },
        { onConflict: 'cache_key' },
      );
    if (error) return null;
    return generatedAt;
  } catch {
    return null;
  }
}

// ── Supabase concerns_cache helpers ───────────────────────────────────────────
const CONCERNS_DB_TTL_MS = 24 * 60 * 60 * 1000;

async function readConcernsFromDB(
  cacheKey: string,
): Promise<{ concerns: PublicConcern[]; generatedAt: string } | null> {
  try {
    const { data, error } = await supabase
      .from('concerns_cache')
      .select('concerns, generated_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    const age = Date.now() - new Date(data.generated_at as string).getTime();
    if (age > CONCERNS_DB_TTL_MS) return null;
    return { concerns: data.concerns as PublicConcern[], generatedAt: data.generated_at as string };
  } catch {
    return null;
  }
}

async function writeConcernsToDB(
  cacheKey: string,
  concerns: PublicConcern[],
): Promise<string | null> {
  try {
    const generatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('concerns_cache')
      .upsert(
        { cache_key: cacheKey, concerns, generated_at: generatedAt },
        { onConflict: 'cache_key' },
      );
    if (error) return null;
    return generatedAt;
  } catch {
    return null;
  }
}

function contentCacheKey(
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): string {
  return `${district.number}:${focus?.zip ?? 'all'}`;
}

/** Synchronous cache read — use in lazy useState initialisers to skip loading flash. */
export function getCachedSignals(
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): { signals: Signal[]; generatedAt: string | null } | null {
  return _signalsCache.get(contentCacheKey(district, focus)) ?? null;
}

/** Synchronous cache read — use in lazy useState initialisers to skip loading flash. */
export function getCachedOutlook(
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): { outlook: OutlookData; generatedAt: string | null } | null {
  return _outlookCache.get(contentCacheKey(district, focus)) ?? null;
}

/** Synchronous cache read for public concerns — use to skip loading flash. */
export function getCachedConcerns(
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): { concerns: PublicConcern[]; generatedAt: string | null } | null {
  return _concernsCache.get(contentCacheKey(district, focus)) ?? null;
}

const SYSTEM_PROMPT = `You are CityPulse, an urban intelligence analyst specializing in San Francisco's built environment. Your role is to synthesize permit activity, development pipeline data, and zoning context into clear, narrative-driven briefings for urban planners, developers, and municipal clients. Always produce exactly four sections with these exact headings: THE BRIEFING, THE SIGNAL, THE ZONING CONTEXT, THE OUTLOOK. Total length 450-600 words. Write in confident prose, no bullet points. Use specific numbers from the data.`;

function signalsSystemPrompt(districtLabel: string): string {
  return `You are an urban planning analyst for San Francisco ${districtLabel}. Analyze permit and development data and identify key signals and trends. Always return valid JSON only — no markdown, no prose, no code fences.`;
}

function outlookSystemPrompt(districtLabel: string): string {
  return `You are an urban planning analyst for San Francisco ${districtLabel}. Analyze permit and development data and produce a forward-looking outlook. Always return valid JSON only — no markdown, no prose, no code fences.`;
}

export interface BriefingSections {
  briefing: string;
  signal: string;
  zoningContext: string;
  outlook: string;
}

function cleanSection(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '---' && !line.trimStart().startsWith('##'))
    .join('\n')
    .trim();
}

export function parseBriefingSections(text: string): BriefingSections {
  const headings = ['THE BRIEFING', 'THE SIGNAL', 'THE ZONING CONTEXT', 'THE OUTLOOK'];
  const keys: (keyof BriefingSections)[] = ['briefing', 'signal', 'zoningContext', 'outlook'];
  const result: BriefingSections = { briefing: '', signal: '', zoningContext: '', outlook: '' };

  for (let i = 0; i < headings.length; i++) {
    const startIdx = text.indexOf(headings[i]);
    if (startIdx === -1) continue;

    const contentStart = startIdx + headings[i].length;
    const nextIdx =
      i < headings.length - 1 ? text.indexOf(headings[i + 1], contentStart) : -1;
    const contentEnd = nextIdx === -1 ? text.length : nextIdx;

    result[keys[i]] = cleanSection(text.slice(contentStart, contentEnd));
  }

  return result;
}

export async function generateBriefing(district: DistrictConfig): Promise<{ text: string; data: DistrictData }> {
  const t0 = performance.now();
  const data = district.number === '0'
    ? await aggregateCitywideData()
    : await aggregateDistrictData(district);
  const text = await generateBriefingFromData(data, district);
  console.log(`[briefing] full generate (data + text): ${(performance.now() - t0).toFixed(0)}ms`);
  return { text, data };
}

/**
 * Generate a briefing from already-fetched DistrictData.
 * If `focus` is provided, filters permit data to that zip and instructs
 * Claude to write specifically about that neighborhood.
 */
export async function generateBriefingFromData(
  data: DistrictData,
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): Promise<string> {
  const key = contentCacheKey(district, focus);
  const cached = _briefingCache.get(key);
  if (cached) { console.log(`[briefing] cache hit ${key}`); return cached; }

  // Fetch mayor news + BOS + Parks context in parallel with data prep (non-blocking)
  const mayorCtxPromise  = getMayorNewsContext(district.number);
  const bosCtxPromise    = getBosContext(district.number);
  const parksCtxPromise  = getParksContext(district.number);

  let briefingData: DistrictData = data;

  if (focus) {
    const zipSummary = data.permit_summary.by_zip?.[focus.zip];
    briefingData = {
      ...data,
      permit_summary: {
        total:                  zipSummary?.total                  ?? 0,
        by_type:                zipSummary?.by_type                ?? {},
        by_status:              zipSummary?.by_status              ?? {},
        cost_by_type:           zipSummary?.cost_by_type           ?? {},
        total_estimated_cost_usd: zipSummary?.total_estimated_cost_usd ?? 0,
        notable_permits:        [],
        by_zip:                 {},
      },
    };
  }

  const [mayorCtx, bosCtx, parksCtx] = await Promise.all([mayorCtxPromise, bosCtxPromise, parksCtxPromise]);
  const crossRefs = mayorCtx + bosCtx + parksCtx;

  const userContent = district.number === '0'
    ? `${JSON.stringify(data.citywide_prompt_summary ?? [], null, 2)}${crossRefs}\n\nFOCUS: Identify the 5 most significant developments across all SF districts. For each finding, tag the district and neighborhood. Focus on what has city-wide implications — displacement pressure, housing supply, major construction, and policy risk.`
    : focus
      ? `${JSON.stringify(forPrompt(briefingData), null, 2)}${crossRefs}\n\nFOCUS: Write this briefing specifically for the ${focus.name} neighborhood (zip ${focus.zip}). Reference ${focus.name} by name throughout. Pipeline and zoning data above reflect all of ${district.label} — note this where relevant.`
      : `${JSON.stringify(forPrompt(briefingData), null, 2)}${crossRefs}`;

  const t0 = performance.now();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  console.log(`[briefing] claude-sonnet-4-6: ${(performance.now() - t0).toFixed(0)}ms`);

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response block type: ${block.type}`);
  _briefingCache.set(key, block.text);
  return block.text;
}

/**
 * Generate structured signals from already-fetched DistrictData.
 * If `focus` is provided, scopes the analysis to that zip's permit data.
 *
 * Returns signals plus `generatedAt` — an ISO timestamp from the Supabase
 * cache row (if loaded from DB) or the moment generation completed.
 */
export async function generateSignals(
  data: DistrictData,
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): Promise<{ signals: Signal[]; generatedAt: string | null }> {
  const key = contentCacheKey(district, focus);

  // 1 — In-memory cache (instant, no async)
  const memCached = _signalsCache.get(key);
  if (memCached) { console.log(`[signals] memory cache hit ${key}`); return memCached; }

  // 2 — Supabase DB cache (survives page refresh; 24-hour TTL)
  const dbCached = await readSignalsFromDB(key);
  if (dbCached) {
    console.log(`[signals] DB cache hit ${key}`);
    _signalsCache.set(key, dbCached);
    return dbCached;
  }

  // 3 — Generate via Claude
  console.log(`[signals] generating fresh for key: ${key}`);
  let analysisData = data;

  if (focus) {
    const zipSummary = data.permit_summary.by_zip?.[focus.zip];
    analysisData = {
      ...data,
      permit_summary: {
        total:                    zipSummary?.total                    ?? 0,
        by_type:                  zipSummary?.by_type                  ?? {},
        by_status:                zipSummary?.by_status                ?? {},
        cost_by_type:             zipSummary?.cost_by_type             ?? {},
        total_estimated_cost_usd: zipSummary?.total_estimated_cost_usd ?? 0,
        notable_permits:          [],
        by_zip:                   {},
      },
    };
  }

  const locationLabel = focus ? focus.name : district.label;

  const isCitywide = district.number === '0' && !focus;
  const citywideTask = isCitywide
    ? `TASK: Identify the top 5 city-wide trends across all SF districts. Flag which districts are most affected by each trend. Compare patterns between districts — e.g., which areas have rising evictions vs rising permit values. Each signal must include a "districts_affected" note in its body.`
    : null;

  const promptData = isCitywide
    ? data.citywide_prompt_summary ?? []
    : forPrompt(analysisData);

  const [mayorCtx, bosCtx, parksCtx] = await Promise.all([
    getMayorNewsContext(district.number),
    getBosContext(district.number),
    getParksContext(district.number),
  ]);
  let sentimentCtx = '';
  try {
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('sentiment timeout')), 5000),
    );
    sentimentCtx = await Promise.race([getSentimentContext(district.number), timeout]);
  } catch (e) {
    console.warn('[sentiment] failed or timed out, continuing without:', e);
  }
  const crossRefs = mayorCtx + bosCtx + parksCtx + sentimentCtx;
  console.log('[signals] sentiment in prompt:', crossRefs.includes('Public Comment') ? 'YES' : 'NO');

  try {
  const userContent = `${JSON.stringify(promptData, null, 2)}${crossRefs}

TASK: ${citywideTask ?? `Identify 3–5 key signals or trends for ${locationLabel} based on the data above. Generate as many signals as the data supports — never pad with generic observations if the data is thin.`}

IMPORTANT EDITORIAL RULES:
- Always include at least one positive development or trend if the data supports it. Look for: new affordable housing projects, declining violation rates, community investment, approved developments that add housing stock.
- Lead with facts, not alarm. Present data and let residents draw conclusions.
- Avoid advocacy language: do not use 'crisis', 'severe', 'accelerating', 'exacerbating'. Use neutral descriptors.
- When adjacent addresses have large permits (like 758 and 772 Pacific Ave), identify them as likely one project and describe the combined scope.
- Balance every concern with context. If evictions are elevated, also note if they've declined from peak.
- Severity ratings should be based on data magnitude, not emotional framing.
- Be balanced and factual — present optimistic signals first, then challenges
- Cite specific numbers from the data (counts, dollar amounts, percentages)
- No political opinions; describe what the data shows
- If two or more high-value permits (estimated_cost_usd > $1M) are at addresses that share a street number block (e.g., 750 and 758 Pacific), note they may represent a single merged development and estimate the combined value

For each signal return an object with these exact keys:
- "title": short headline, max 10 words
- "body": 2–3 sentences explaining what the data shows, citing specific numbers
- "severity": exactly one of "low", "medium", or "high"
- "concern": 1 sentence on why this matters to residents

Focus on: unusual permit volume or cost spikes, clustering of similar project types, potential displacement risk (pay close attention to eviction data — Ellis Act and owner move-in notices are strong indicators of involuntary tenant displacement), affordability impact, infrastructure strain, and property value trends (use assessment_summary.yoy_change_pct and the split between residential vs commercial assessed values to flag gentrification pressure or investment shifts). Also examine affordable_housing_summary: flag if affordable_ratio is below 0.20 (market-rate development dominating), if Construction-phase affordable units are low relative to total pipeline, or if deep affordable (≤50% AMI) units are a small share of ami_distribution. If eviction_summary shows elevated totals or a rising monthly trend, flag this as a signal.

Return ONLY a JSON object in this exact shape (no other text):
{"signals": [{"title":"...","body":"...","severity":"...","concern":"..."}]}`;

  const t0 = performance.now();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: signalsSystemPrompt(district.label),
    messages: [{ role: 'user', content: userContent }],
  });
  console.log(`[signals] claude-haiku: ${(performance.now() - t0).toFixed(0)}ms`);

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);

  const parsed = repairAndParseJSON<{ signals: Signal[] }>(block.text);

  // 4 — Persist to Supabase DB (fire-and-forget; failure is non-fatal)
  const generatedAt = await writeSignalsToDB(key, parsed.signals);

  const result = { signals: parsed.signals, generatedAt };
  _signalsCache.set(key, result);
  return result;
  } catch (error) {
    console.error('[signals] FAILED:', error);
    throw error;
  }
}

/**
 * Repair and parse a potentially malformed JSON string from an LLM response.
 * Steps: strip markdown fences → try parse → extract first {/[ block → remove
 * trailing commas → try parse → close unclosed braces → final parse.
 */
function repairAndParseJSON<T>(raw: string): T {
  // 1. Strip markdown code fences
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. Try direct parse
  try { return JSON.parse(text) as T; } catch { /* continue to repair */ }

  // 3. Extract the first JSON object or array
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  let start = -1;
  if (objStart !== -1 && arrStart !== -1) start = Math.min(objStart, arrStart);
  else start = objStart !== -1 ? objStart : arrStart;

  const objEnd = text.lastIndexOf('}');
  const arrEnd = text.lastIndexOf(']');
  const end = Math.max(objEnd, arrEnd);

  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  // 4. Remove trailing commas before } or ]
  text = text.replace(/,(\s*[}\]])/g, '$1');

  // 5. Try parse after cleanup
  try { return JSON.parse(text) as T; } catch { /* continue to close */ }

  // 6. Try to close unclosed braces/brackets (handles truncated responses)
  const stack: string[] = [];
  for (const ch of text) {
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  text = text.replace(/,(\s*[}\]])/g, '$1');
  while (stack.length) text += stack.pop();

  return JSON.parse(text) as T;
}

/**
 * Generate a structured forward-looking outlook from already-fetched DistrictData.
 * If `focus` is provided, scopes the analysis to that zip's permit data.
 */
export async function generateOutlook(
  data: DistrictData,
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): Promise<{ outlook: OutlookData; generatedAt: string | null }> {
  const key = contentCacheKey(district, focus);

  // 1 — In-memory cache (instant, no async)
  const memCached = _outlookCache.get(key);
  if (memCached) { console.log(`[outlook] memory cache hit ${key}`); return memCached; }

  // 2 — Supabase DB cache (survives page refresh; 24-hour TTL)
  const dbCached = await readOutlookFromDB(key);
  if (dbCached) {
    console.log(`[outlook] DB cache hit ${key}`);
    _outlookCache.set(key, dbCached);
    return dbCached;
  }

  // 3 — Generate via Claude
  // Fetch shadow-flagged projects from Supabase in parallel with data prep.
  // Always district-wide — shadow impact is a D3-level concern regardless of
  // neighborhood filter, and project addresses rarely contain zip codes.
  console.log('[generateOutlook] STEP 1: starting Supabase shadow query');

  const shadowPromise = supabase
    .from('projects')
    .select('address, project_description, shadow_details', { count: 'exact' })
    .eq('shadow_flag', true)
    .not('shadow_details', 'is', null)
    .not('address', 'is', null)
    .limit(8)
    .then(({ data: rows, count, error }) => {
      if (error) {
        console.warn('[generateOutlook] STEP 1 FAILED — shadow query error:', error.message, error);
        return { projects: [] as ShadowProject[], total: 0 };
      }
      console.log(`[generateOutlook] STEP 1 OK — shadow rows returned: ${rows?.length ?? 0}, total count: ${count}`);
      return { projects: (rows ?? []) as ShadowProject[], total: count ?? 0 };
    });

  let analysisData = data;
  if (focus) {
    const zipSummary = data.permit_summary.by_zip?.[focus.zip];
    analysisData = {
      ...data,
      permit_summary: {
        total:                    zipSummary?.total                    ?? 0,
        by_type:                  zipSummary?.by_type                  ?? {},
        by_status:                zipSummary?.by_status                ?? {},
        cost_by_type:             zipSummary?.cost_by_type             ?? {},
        total_estimated_cost_usd: zipSummary?.total_estimated_cost_usd ?? 0,
        notable_permits:          [],
        by_zip:                   {},
      },
    };
  }

  const { projects: shadowProjects, total: shadowTotal } = await shadowPromise;
  const locationLabel = focus ? focus.name : district.label;

  const shadowBlock = shadowTotal > 0
    ? `\nSHADOW-FLAGGED PROJECTS — DISTRICT 3 (${shadowTotal} projects flagged for Section 295 shadow-impact review; ${shadowProjects.length} shown below):
${shadowProjects.map(p => `- ${p.address}: ${p.shadow_details ?? p.project_description ?? '(no detail)'}`).join('\n')}\n`
    : '';

  const isCitywide = district.number === '0' && !focus;
  const citywideOutlookTask = isCitywide
    ? `TASK: Generate a forward-looking outlook for all of San Francisco based on the data above. Identify the biggest risks and opportunities across all districts. Highlight where multiple districts face similar challenges. Flag the displacement trifecta (rising assessed values + elevated evictions + low affordable ratio) wherever it appears across districts.`
    : null;

  const promptData = isCitywide
    ? data.citywide_prompt_summary ?? []
    : forPrompt(analysisData);

  const [mayorCtx, bosCtx, parksCtx] = await Promise.all([
    getMayorNewsContext(district.number),
    getBosContext(district.number),
    getParksContext(district.number),
  ]);
  let sentimentCtxOutlook = '';
  try {
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('sentiment timeout')), 5000),
    );
    sentimentCtxOutlook = await Promise.race([getSentimentContext(district.number), timeout]);
  } catch (e) {
    console.warn('[sentiment] failed or timed out, continuing without:', e);
  }
  const crossRefs = mayorCtx + bosCtx + parksCtx + sentimentCtxOutlook;

  const userContent = `${JSON.stringify(promptData, null, 2)}
${shadowBlock}${crossRefs}
${citywideOutlookTask ?? `TASK: Generate a forward-looking outlook for ${locationLabel} based on the data above.`}

Return ONLY a JSON object in this exact shape (no other text):
{
  "events": [exactly 3 items],
  "risks": [exactly 3 items],
  "engagement": [exactly 2 items]
}

For each event use these exact keys:
- "title": name of the upcoming decision, hearing, or milestone (8–12 words)
- "timeframe": estimated timing, e.g. "Next 30–60 days", "Q2 2026", "3–6 months"
- "detail": 1–2 sentences on what is happening, referencing specific project types or pipeline counts
- "impact": 1 sentence on what this means for residents
- "priority": exactly one of "low", "medium", "high"

For each risk use these exact keys:
- "icon": a single relevant emoji (e.g. 📉 🏗️ 🏘️ 🚇 💰 ⚠️ ☀️ 🏛️)
- "title": short risk name (4–6 words)
- "detail": 1–2 sentences on why this is a concern, referencing permit patterns, pipeline data, or shadow-flagged addresses where relevant
- "priority": exactly one of "low", "medium", "high"

For each engagement item use these exact keys:
- "title": specific opportunity name (6–10 words)
- "detail": 1 sentence on how residents can participate

IMPORTANT EDITORIAL RULES:
- Always include at least one positive development or opportunity if the data supports it. Look for: new affordable housing projects, declining violation rates, community investment, approved developments that add housing stock.
- Lead with facts, not alarm. Present data and let residents draw conclusions.
- Avoid advocacy language: do not use 'crisis', 'severe', 'accelerating', 'exacerbating'. Use neutral descriptors.
- When adjacent addresses have large permits (like 758 and 772 Pacific Ave), identify them as likely one project and describe the combined scope.
- Balance every risk with context. If evictions are elevated, also note if they've declined from peak.
- Priority ratings should be based on data magnitude, not emotional framing.

IMPORTANT: Include one risk about shadow impact (☀️ icon) and, if eviction_summary.total > 0, one displacement risk (🏘️ icon) citing eviction counts and types. If assessment_summary.yoy_change_pct is notable (> 5% or < −2%), mention property value trajectory in a risk or event. If the data shows the displacement trifecta — rising assessed values AND elevated evictions AND a low affordable_housing_summary.affordable_ratio or few active construction-phase affordable units — flag this as a critical combined risk (🚨 icon) citing all three signals together.`;

  console.log(`[generateOutlook] STEP 2: calling Claude Haiku — prompt length: ${userContent.length} chars`);

  const t0outlook = performance.now();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: outlookSystemPrompt(district.label),
    messages: [{ role: 'user', content: userContent }],
  });

  console.log(`[generateOutlook] STEP 3: Claude responded in ${(performance.now() - t0outlook).toFixed(0)}ms — stop_reason: ${message.stop_reason}, content blocks: ${message.content.length}`);

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);

  console.log(`[generateOutlook] STEP 4: raw response (first 500 chars):\n${block.text.slice(0, 500)}`);

  const parsed = repairAndParseJSON<OutlookData>(block.text);
  console.log(`[generateOutlook] STEP 5 OK — events: ${parsed.events?.length}, risks: ${parsed.risks?.length}, engagement: ${parsed.engagement?.length}`);

  // 4 — Persist to Supabase DB (fire-and-forget; failure is non-fatal)
  const generatedAt = await writeOutlookToDB(key, parsed);

  const result = { outlook: parsed, generatedAt };
  _outlookCache.set(key, result);
  return result;
}

function concernsSystemPrompt(districtLabel: string): string {
  return `You are an urban planning analyst for San Francisco ${districtLabel}. Analyze permit and development data and identify key public concerns for residents. Always return valid JSON only — no markdown, no prose, no code fences.`;
}

/**
 * Generate structured public concerns from already-fetched DistrictData.
 * If `focus` is provided, scopes the analysis to that zip's permit data.
 */
export async function generatePublicConcerns(
  data: DistrictData,
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): Promise<{ concerns: PublicConcern[]; generatedAt: string | null }> {
  const key = contentCacheKey(district, focus);

  // 1 — In-memory cache (instant, no async)
  const memCached = _concernsCache.get(key);
  if (memCached) { console.log(`[concerns] memory cache hit ${key}`); return memCached; }

  // 2 — Supabase DB cache (survives page refresh; 24-hour TTL)
  const dbCached = await readConcernsFromDB(key);
  if (dbCached) {
    console.log(`[concerns] DB cache hit ${key}`);
    _concernsCache.set(key, dbCached);
    return dbCached;
  }

  // 3 — Generate via Claude
  let analysisData = data;
  if (focus) {
    const zipSummary = data.permit_summary.by_zip?.[focus.zip];
    analysisData = {
      ...data,
      permit_summary: {
        total:                    zipSummary?.total                    ?? 0,
        by_type:                  zipSummary?.by_type                  ?? {},
        by_status:                zipSummary?.by_status                ?? {},
        cost_by_type:             zipSummary?.cost_by_type             ?? {},
        total_estimated_cost_usd: zipSummary?.total_estimated_cost_usd ?? 0,
        notable_permits:          [],
        by_zip:                   {},
      },
    };
  }

  const locationLabel = focus ? focus.name : district.label;
  const isCitywide = district.number === '0' && !focus;
  const promptData = isCitywide ? data.citywide_prompt_summary ?? [] : forPrompt(analysisData);

  let sentimentCtx = '';
  try {
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('sentiment timeout')), 5000),
    );
    sentimentCtx = await Promise.race([getSentimentContext(district.number), timeout]);
  } catch (e) {
    console.warn('[sentiment] failed or timed out, continuing without:', e);
  }

  const userContent = `${JSON.stringify(promptData, null, 2)}${sentimentCtx}

TASK: Based on the data above, identify 3–5 public concerns residents of ${locationLabel} should be aware of. Generate as many concerns as the data supports — never pad with generic items.

IMPORTANT EDITORIAL RULES:
- Always include at least one positive development or trend if the data supports it. Look for: new affordable housing projects, declining violation rates, community investment, approved developments that add housing stock.
- Lead with facts, not alarm. Present data and let residents draw conclusions.
- Avoid advocacy language: do not use 'crisis', 'severe', 'accelerating', 'exacerbating'. Use neutral descriptors.
- When adjacent addresses have large permits (like 758 and 772 Pacific Ave), identify them as likely one project and describe the combined scope.
- Balance every concern with context. If evictions are elevated, also note if they've declined from peak.
- Severity ratings should be based on data magnitude, not emotional framing.
- Be balanced and factual — cite specific numbers (counts, dollar amounts, percentages)
- No political opinions; describe what the data shows
- Focus on resident impact: housing costs, displacement risk, construction disruption, affordability, infrastructure

Severity guide:
- "critical": immediate or significant displacement/affordability risk backed by strong data signals
- "alert": notable trend that warrants monitoring and possible action
- "watch": early-stage signal worth tracking but not yet urgent

For each concern return an object with these exact keys:
- "headline": short plain-language headline a resident would understand (max 12 words)
- "severity": exactly one of "watch", "alert", or "critical"
- "evidence": 1–2 sentences citing specific data points from the permit or eviction data
- "affects": 1 sentence on which residents or neighborhoods are most impacted
- "action": 1 sentence on what residents can do (attend a hearing, file a comment, contact their Supervisor, monitor permits)

Return ONLY a JSON object in this exact shape (no other text):
{"concerns": [{"headline":"...","severity":"...","evidence":"...","affects":"...","action":"..."}]}`;

  const t0 = performance.now();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: concernsSystemPrompt(district.label),
    messages: [{ role: 'user', content: userContent }],
  });
  console.log(`[concerns] claude-haiku: ${(performance.now() - t0).toFixed(0)}ms`);

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);

  const parsed = repairAndParseJSON<{ concerns: PublicConcern[] }>(block.text);

  // 4 — Persist to Supabase DB (fire-and-forget; failure is non-fatal)
  const generatedAt = await writeConcernsToDB(key, parsed.concerns);

  const result = { concerns: parsed.concerns, generatedAt };
  _concernsCache.set(key, result);
  return result;
}
