/**
 * services/chatbot.ts — CityPulse AI assistant
 *
 * Multi-turn tool-use loop against the Anthropic API.
 * Reuses existing DataSF + Supabase functions — no new API calls.
 */

import { callAI } from './aiProxy';
import {
  fetchBuildingPermits,
  fetchEvictions,
  fetchAssessmentStats,
  fetchAffordableHousingPipeline,
} from './dataSF';
import { supabase } from './supabase';

// Client-side AI calls go through the /api/ai serverless proxy

const MODEL = 'claude-sonnet-4-6';

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CityPulse, an AI assistant that answers questions about San Francisco civic data. You have access to live city data including building permits, eviction notices, property assessments, affordable housing pipeline, Planning Commission hearings, and government actions across all 11 SF Supervisor Districts.

Be balanced. Present facts from the data. When topics are contested, show both sides. Lead with what's working, then address concerns honestly. Never take political sides.

Keep answers short — 2-4 sentences for simple questions, a few paragraphs for complex ones. Use plain language, no jargon. Cite specific numbers from the data.

Always call a tool before answering data questions — do not invent statistics.`;

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: any[] = [
  {
    name: 'search_permits',
    description:
      'Search SF building permits for a specific supervisor district. Use for questions about construction, renovations, demolitions, or building activity. District is required — if the user asks about a neighborhood, infer the district number.',
    input_schema: {
      type: 'object' as const,
      properties: {
        district: {
          type: 'string',
          description: 'Supervisor district number, 1–11.',
        },
        limit: {
          type: 'number',
          description: 'Max permits to fetch, default 200.',
        },
      },
      required: ['district'],
    },
  },
  {
    name: 'search_evictions',
    description:
      'Search eviction notices filed in SF over the last 2 years. Use for questions about tenant displacement or eviction trends. Omit district for a multi-district sample.',
    input_schema: {
      type: 'object' as const,
      properties: {
        district: {
          type: 'string',
          description: 'Supervisor district 1–11. Omit to get a sample from key districts.',
        },
      },
    },
  },
  {
    name: 'search_assessments',
    description:
      'Get property assessment statistics (land value, improvement value) for a district. Use for questions about property values or tax assessments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        district: {
          type: 'string',
          description: 'Supervisor district 1–11.',
        },
      },
      required: ['district'],
    },
  },
  {
    name: 'search_affordable_housing',
    description:
      'Search the MOHCD affordable housing pipeline for a district. Use for questions about affordable housing development, income-restricted units, or housing programs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        district: {
          type: 'string',
          description: 'Supervisor district 1–11.',
        },
      },
      required: ['district'],
    },
  },
  {
    name: 'search_commission',
    description:
      'Search Planning Commission projects from the database. Use for questions about specific addresses, shadow studies, or development project approvals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        district: {
          type: 'string',
          description: 'Filter by supervisor district 1–11.',
        },
        search_text: {
          type: 'string',
          description: 'Text to search in project description.',
        },
        address: {
          type: 'string',
          description: 'Specific street address or partial address to look up.',
        },
      },
    },
  },
  {
    name: 'search_hearings',
    description:
      'Search Board of Supervisors legislation and actions. Use for questions about BOS votes, ordinances, or government actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        district: {
          type: 'string',
          description: 'Filter items tagged to a district.',
        },
        search_text: {
          type: 'string',
          description: 'Text to search in item titles.',
        },
        limit: {
          type: 'number',
          description: 'Max results, default 20.',
        },
      },
    },
  },
];

// ── Tool input type ───────────────────────────────────────────────────────────

interface ToolInput {
  district?: string;
  search_text?: string;
  address?: string;
  limit?: number;
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {

      case 'search_permits': {
        const district = input.district ?? '3';
        const limit = Math.min(input.limit ?? 200, 300);
        const permits = await fetchBuildingPermits(district, limit);
        const byType: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        for (const p of permits) {
          byType[p.permit_type_definition] = (byType[p.permit_type_definition] ?? 0) + 1;
          byStatus[p.status]               = (byStatus[p.status]               ?? 0) + 1;
        }
        const recent = permits.slice(0, 12).map(p => ({
          address:      `${p.street_number} ${p.street_name} ${p.street_suffix ?? ''}`.trim(),
          type:         p.permit_type_definition,
          status:       p.status,
          filed:        p.filed_date?.split('T')[0],
          description:  p.description?.slice(0, 120),
          cost:         p.estimated_cost,
          proposed_use: p.proposed_use,
        }));
        return JSON.stringify({ district, total: permits.length, by_type: byType, by_status: byStatus, recent_12: recent });
      }

      case 'search_evictions': {
        if (!input.district) {
          // Sample three representative districts for a citywide overview
          const [d6, d9, d10] = await Promise.all([
            fetchEvictions('6', 300),
            fetchEvictions('9', 300),
            fetchEvictions('10', 300),
          ]);
          const summarise = (evs: typeof d6, label: string) => {
            const reasons: Record<string, number> = {};
            for (const e of evs) {
              if (e.non_payment)          reasons.non_payment          = (reasons.non_payment          ?? 0) + 1;
              if (e.owner_move_in)        reasons.owner_move_in        = (reasons.owner_move_in        ?? 0) + 1;
              if (e.nuisance)             reasons.nuisance             = (reasons.nuisance             ?? 0) + 1;
              if (e.ellis_act_withdrawal) reasons.ellis_act_withdrawal = (reasons.ellis_act_withdrawal ?? 0) + 1;
              if (e.breach)               reasons.breach               = (reasons.breach               ?? 0) + 1;
            }
            return { district: label, count: evs.length, by_reason: reasons };
          };
          return JSON.stringify({
            note: 'Sample of districts D6/D9/D10 — specify a district for full data',
            d6:  summarise(d6,  '6'),
            d9:  summarise(d9,  '9'),
            d10: summarise(d10, '10'),
          });
        }
        const evictions = await fetchEvictions(input.district, 500);
        const reasons: Record<string, number> = {};
        const byMonth: Record<string, number> = {};
        for (const e of evictions) {
          if (e.non_payment)          reasons.non_payment          = (reasons.non_payment          ?? 0) + 1;
          if (e.owner_move_in)        reasons.owner_move_in        = (reasons.owner_move_in        ?? 0) + 1;
          if (e.nuisance)             reasons.nuisance             = (reasons.nuisance             ?? 0) + 1;
          if (e.ellis_act_withdrawal) reasons.ellis_act_withdrawal = (reasons.ellis_act_withdrawal ?? 0) + 1;
          if (e.breach)               reasons.breach               = (reasons.breach               ?? 0) + 1;
          if (e.capital_improvement)  reasons.capital_improvement  = (reasons.capital_improvement  ?? 0) + 1;
          if (e.demolition)           reasons.demolition           = (reasons.demolition           ?? 0) + 1;
          const month = e.file_date?.slice(0, 7);
          if (month) byMonth[month] = (byMonth[month] ?? 0) + 1;
        }
        const trend = Object.entries(byMonth)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 12);
        const recent = evictions.slice(0, 8).map(e => ({
          address:      e.address,
          date:         e.file_date?.split('T')[0],
          neighborhood: e.neighborhood,
        }));
        return JSON.stringify({
          district: input.district,
          total: evictions.length,
          by_reason: reasons,
          monthly_trend: Object.fromEntries(trend),
          recent_8: recent,
        });
      }

      case 'search_assessments': {
        const district = input.district ?? '1';
        const stats = await fetchAssessmentStats(district);
        return JSON.stringify({ district, assessment_rows: stats });
      }

      case 'search_affordable_housing': {
        const district = input.district ?? '1';
        const projects = await fetchAffordableHousingPipeline(district);
        const byStatus: Record<string, number> = {};
        for (const p of projects) {
          byStatus[p.project_status] = (byStatus[p.project_status] ?? 0) + 1;
        }
        const totalUnits       = projects.reduce((s, p) => s + (parseInt(p.total_project_units       ?? '0') || 0), 0);
        const totalAffordable  = projects.reduce((s, p) => s + (parseInt(p.mohcd_affordable_units     ?? '0') || 0), 0);
        const sample = projects.slice(0, 10).map(p => ({
          name:        p.project_name,
          address:     p.plannning_approval_address,
          status:      p.project_status,
          total_units: p.total_project_units,
          affordable:  p.mohcd_affordable_units,
          type:        p.project_type,
          tenure:      p.housing_tenure,
          completion:  p.estimated_construction_completion,
        }));
        return JSON.stringify({
          district,
          total_projects:        projects.length,
          by_status:             byStatus,
          total_units:           totalUnits,
          total_affordable_units: totalAffordable,
          sample_10:             sample,
        });
      }

      case 'search_commission': {
        let query = supabase
          .from('projects')
          .select('address, project_description, shadow_details, supervisor_district')
          .limit(12);
        if (input.district)     query = query.eq('supervisor_district', input.district);
        if (input.search_text)  query = query.ilike('project_description', `%${input.search_text}%`);
        if (input.address)      query = query.ilike('address', `%${input.address}%`);
        const { data, error } = await query;
        if (error) throw error;
        return JSON.stringify({ total: data?.length ?? 0, projects: data ?? [] });
      }

      case 'search_hearings': {
        const limit = Math.min(input.limit ?? 20, 40);
        let query = supabase
          .from('bos_items')
          .select('file_number, title, action_taken, districts, topics')
          .limit(limit);
        if (input.search_text) query = query.ilike('title', `%${input.search_text}%`);
        if (input.district)    query = query.contains('districts', [input.district]);
        const { data, error } = await query;
        if (error) throw error;
        return JSON.stringify({ total: data?.length ?? 0, items: data ?? [] });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    console.error(`[chatbot] tool ${name} failed:`, err);
    return JSON.stringify({
      error: `Data temporarily unavailable for ${name}.`,
    });
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:      'user' | 'assistant';
  content:   string;
  timestamp: number;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendChatMessage(
  userMessage:     string,
  history:         ChatMessage[],
  currentDistrict?: string,
): Promise<string> {
  // Build message history for the API
  const messages: any[] = history.map(m => ({
    role:    m.role,
    content: m.content,
  }));
  messages.push({ role: 'user', content: userMessage });

  const system = (currentDistrict && currentDistrict !== '0')
    ? `${SYSTEM_PROMPT}\n\nThe user is currently viewing District ${currentDistrict}.`
    : SYSTEM_PROMPT;

  // Agentic tool-use loop (max 5 turns to prevent runaway)
  for (let turn = 0; turn < 5; turn++) {
    const response = await callAI({
      model:      MODEL,
      max_tokens: 1024,
      system,
      tools:      TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const block = response.content.find((b: any) => b.type === 'text');
      return block?.type === 'text' ? block.text : "I couldn't generate a response.";
    }

    if (response.stop_reason === 'tool_use') {
      // Append assistant's response (including tool_use blocks) to history
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls in parallel
      const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use');
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block: any) => {
          if (block.type !== 'tool_use') return null;
          const result = await executeTool(block.name, block.input as ToolInput);
          return {
            type:        'tool_result' as const,
            tool_use_id: block.id,
            content:     result,
          };
        })
      );

      messages.push({
        role:    'user',
        content: toolResults.filter(Boolean) as any[],
      });
      continue;
    }

    // Unexpected stop — return any text found
    const block = response.content.find((b: any) => b.type === 'text');
    if (block?.type === 'text') return block.text;
    break;
  }

  return "I ran into an issue processing your question. Please try again.";
}
