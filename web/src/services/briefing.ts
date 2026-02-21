/**
 * services/briefing.ts — CityPulse web
 *
 * Calls the Anthropic API directly from the browser using the key exposed
 * via VITE_ANTHROPIC_API_KEY in web/.env.
 */

import Anthropic from '@anthropic-ai/sdk';
import { aggregateDistrictData, type DistrictData } from './aggregator';

export type { DistrictData };

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are CityPulse, an urban intelligence analyst specializing in San Francisco's built environment. Your role is to synthesize permit activity, development pipeline data, and zoning context into clear, narrative-driven briefings for urban planners, developers, and municipal clients. Always produce exactly four sections with these exact headings: THE BRIEFING, THE SIGNAL, THE ZONING CONTEXT, THE OUTLOOK. Total length 450-600 words. Write in confident prose, no bullet points. Use specific numbers from the data.`;

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

export async function generateBriefing(): Promise<{ text: string; data: DistrictData }> {
  const data = await aggregateDistrictData();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(data, null, 2),
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== 'text') {
    throw new Error(`Unexpected response block type: ${block.type}`);
  }

  return { text: block.text, data };
}
