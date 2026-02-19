/**
 * services/briefing.ts
 *
 * Generates a narrative district briefing by passing aggregated DataSF data
 * to Claude via the Anthropic API.
 */

import Anthropic from '@anthropic-ai/sdk';
import { aggregateDistrictData } from './aggregator';

const SYSTEM_PROMPT = `You are CityPulse, an urban intelligence analyst specializing in San Francisco's built environment. Your role is to synthesize permit activity, development pipeline data, and zoning context into clear, narrative-driven briefings for urban planners, developers, and municipal clients. Always produce exactly four sections with these exact headings: THE BRIEFING, THE SIGNAL, THE ZONING CONTEXT, THE OUTLOOK. Total length 450-600 words. Write in confident prose, no bullet points. Use specific numbers from the data.`;

export async function generateBriefing(): Promise<string> {
  const data = await aggregateDistrictData();

  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
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

  return block.text;
}
