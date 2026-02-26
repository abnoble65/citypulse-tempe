/**
 * services/briefing.ts — CityPulse web
 *
 * Calls the Anthropic API directly from the browser using the key exposed
 * via VITE_ANTHROPIC_API_KEY in web/.env.
 */

import Anthropic from '@anthropic-ai/sdk';
import { aggregateDistrictData, type DistrictData } from './aggregator';
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

export interface OutlookData {
  events: OutlookEvent[];
  risks: OutlookRisk[];
  engagement: OutlookEngagement[];
}

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

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
  const data = await aggregateDistrictData(district);
  const text = await generateBriefingFromData(data, district);
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

  const userContent = focus
    ? `${JSON.stringify(briefingData, null, 2)}\n\nFOCUS: Write this briefing specifically for the ${focus.name} neighborhood (zip ${focus.zip}). Reference ${focus.name} by name throughout. Pipeline and zoning data above reflect all of ${district.label} — note this where relevant.`
    : JSON.stringify(briefingData, null, 2);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response block type: ${block.type}`);
  return block.text;
}

/**
 * Generate structured signals from already-fetched DistrictData.
 * If `focus` is provided, scopes the analysis to that zip's permit data.
 */
export async function generateSignals(
  data: DistrictData,
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): Promise<Signal[]> {
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

  const userContent = `${JSON.stringify(analysisData, null, 2)}

TASK: Identify 3–5 key signals or trends for ${locationLabel} based on the data above.

For each signal return an object with these exact keys:
- "title": short title, 5–8 words
- "body": 2–3 sentences explaining what the data shows, citing specific numbers
- "severity": exactly one of "low", "medium", or "high"
- "concern": 1–2 sentences on why residents should care

Focus on: unusual permit volume, clustering of similar project types, potential displacement risk (pay close attention to eviction data — Ellis Act and owner move-in notices are strong indicators of involuntary tenant displacement), affordability impact, and infrastructure strain. If eviction_summary shows elevated totals or a rising monthly trend, flag this as a signal.

Return ONLY a JSON object in this exact shape (no other text):
{"signals": [{"title":"...","body":"...","severity":"...","concern":"..."}]}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: signalsSystemPrompt(district.label),
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);

  // Strip any accidental markdown code fences
  const raw = block.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(raw) as { signals: Signal[] };
  return parsed.signals;
}

/**
 * Generate a structured forward-looking outlook from already-fetched DistrictData.
 * If `focus` is provided, scopes the analysis to that zip's permit data.
 */
export async function generateOutlook(
  data: DistrictData,
  district: DistrictConfig,
  focus?: { zip: string; name: string },
): Promise<OutlookData> {
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

  const userContent = `${JSON.stringify(analysisData, null, 2)}
${shadowBlock}
TASK: Generate a forward-looking outlook for ${locationLabel} based on the data above.

Return ONLY a JSON object in this exact shape (no other text):
{
  "events": [3–4 items],
  "risks": [3–4 items],
  "engagement": [2–3 items]
}

For each event use these exact keys:
- "title": name of the upcoming decision, hearing, or milestone (8–12 words)
- "timeframe": estimated timing, e.g. "Next 30–60 days", "Q2 2026", "3–6 months"
- "detail": 2–3 sentences on what is happening, referencing specific project types or pipeline counts
- "impact": 1–2 sentences on what this means for residents
- "priority": exactly one of "low", "medium", "high"

For each risk use these exact keys:
- "icon": a single relevant emoji (e.g. 📉 🏗️ 🏘️ 🚇 💰 ⚠️ ☀️ 🏛️)
- "title": short risk name (4–6 words)
- "detail": 2–3 sentences on why this is a concern in the next 3–6 months, referencing permit patterns, pipeline data, or shadow-flagged addresses where relevant
- "priority": exactly one of "low", "medium", "high"

For each engagement item use these exact keys:
- "title": specific opportunity name (6–10 words)
- "detail": 1–2 sentences on how residents can participate, referencing specific project stages or hearings visible in the data

IMPORTANT: Include at least one risk item about shadow impact, citing the total count of flagged projects and referencing specific addresses from the shadow data above. Use the ☀️ icon for that item.

If eviction_summary.total > 0, include a displacement risk item in the risks section. Reference the total eviction count, the most common eviction types from by_type, and any Ellis Act or owner move-in activity as indicators of housing instability. Use the 🏘️ icon for this item.

Be specific. Reference actual project types, pipeline counts, permit patterns, and shadow-flagged addresses from the data.`;

  console.log(`[generateOutlook] STEP 2: calling Claude Haiku — prompt length: ${userContent.length} chars`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1536,
    system: outlookSystemPrompt(district.label),
    messages: [{ role: 'user', content: userContent }],
  });

  console.log(`[generateOutlook] STEP 3: Claude responded — stop_reason: ${message.stop_reason}, content blocks: ${message.content.length}`);

  const block = message.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);

  console.log(`[generateOutlook] STEP 4: raw response (first 500 chars):\n${block.text.slice(0, 500)}`);

  const raw = block.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  console.log(`[generateOutlook] STEP 5: parsing JSON — cleaned string starts with: "${raw.slice(0, 80)}"`);

  try {
    const parsed = JSON.parse(raw) as OutlookData;
    console.log(`[generateOutlook] STEP 5 OK — events: ${parsed.events?.length}, risks: ${parsed.risks?.length}, engagement: ${parsed.engagement?.length}`);
    return parsed;
  } catch (parseErr) {
    console.error('[generateOutlook] STEP 5 FAILED — JSON.parse threw:', parseErr);
    console.error('[generateOutlook] Full raw string that failed to parse:\n', raw);
    throw parseErr;
  }
}
