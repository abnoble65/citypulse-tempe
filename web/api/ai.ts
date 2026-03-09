/**
 * api/ai.ts — Vercel serverless proxy for Anthropic Claude API.
 *
 * - Per-IP rate limiting (10 requests / hour)
 * - Model allowlist
 * - max_tokens ceiling (2048)
 * - API key stays server-side (ANTHROPIC_API_KEY env var)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ── In-memory rate limiter (per warm instance) ────────────────────────────

const hits = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 3_600_000; // 1 hour

function rateOk(ip: string): boolean {
  const now = Date.now();
  // Periodic cleanup when map grows large
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.reset < now) hits.delete(k);
    }
  }
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ── Guards ────────────────────────────────────────────────────────────────

const MODEL_ALLOWLIST = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"];
const MAX_TOKENS_CEIL = 2048;

// ── Handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!rateOk(ip)) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  }

  const { model, max_tokens, messages, system, tools } = req.body ?? {};

  if (!MODEL_ALLOWLIST.includes(model)) {
    return res.status(400).json({ error: `Model not allowed: ${model}` });
  }

  const capped = Math.min(max_tokens ?? 1024, MAX_TOKENS_CEIL);

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
    const params: Record<string, unknown> = { model, max_tokens: capped, messages };
    if (system) params.system = system;
    if (tools) params.tools = tools;

    const result = await client.messages.create(params as any);
    return res.status(200).json(result);
  } catch (e: any) {
    console.error("[api/ai]", e);
    return res.status(502).json({ error: e.message ?? "Upstream error" });
  }
}
