/**
 * api/intelligence.ts — Vercel serverless function for CityPulse Intelligence Packages.
 *
 * - Accepts GET requests with ?apn= query parameter
 * - Returns a full intelligence package JSON for the given parcel
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateIntelligencePackage } from "../services/intelligencePackage";

// ── Handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apn = req.query.apn;

  if (!apn || typeof apn !== "string") {
    return res.status(400).json({ error: "Missing or invalid `apn` query parameter." });
  }

  try {
    const pkg = await generateIntelligencePackage(apn);
    return res.status(200).json(pkg);
  } catch (e: any) {
    console.error("[api/intelligence]", e);
    return res.status(500).json({
      error: "Failed to generate intelligence package.",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
