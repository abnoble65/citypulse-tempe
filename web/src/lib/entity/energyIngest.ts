/**
 * SF Energy Benchmarking — Ingest Job
 * Sprint 6 — Week 3
 *
 * Pulls energy performance data from the SF Environment Department
 * dataset on DataSF (Socrata API) by APN / address.
 *
 * Dataset: Existing Commercial Buildings Energy Performance Benchmarking
 * Endpoint: https://data.sfgov.org/resource/j2j3-acqj.json
 * Docs:     https://dev.socrata.com/foundry/data.sfgov.org/j2j3-acqj
 *
 * Fields populated:
 *   intelligence.environment.energy_use_intensity
 *   intelligence.environment.sustainability_rating
 */

import type { BuildingEntity } from "./buildingEntity";
import { mergeIntelligence } from "./entityBinder";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SOCRATA_BASE = "https://data.sfgov.org/resource";
const ENERGY_DATASET_ID = "j2j3-acqj";
const SOURCE_LABEL = "SF Energy Benchmarking DataSF";

const APP_TOKEN =
  typeof import.meta !== "undefined"
    ? (import.meta as Record<string, Record<string, string>>).env
        ?.VITE_DATASF_APP_TOKEN ?? ""
    : process.env.DATASF_APP_TOKEN ?? "";

// ─── RAW SOCRATA RESPONSE SHAPE ───────────────────────────────────────────────

export interface EnergyBenchmarkRecord {
  /** Assessor Parcel Number. */
  parcel_number?: string;
  /** Site Energy Use Intensity (kBtu/sqft/yr). Primary EUI metric. */
  site_eui?: string;
  /** Weather-normalised Site EUI. More reliable across years. */
  weather_normalized_site_eui?: string;
  /** ENERGY STAR score (1–100). Higher = more efficient. */
  energy_star_score?: string;
  /** Compliance status. e.g. "Compliant", "Exempt". */
  compliance_status?: string;
  /** Benchmark year the record covers. */
  benchmark_year?: string;
  /** Property name as reported. */
  property_name?: string;
  /** Gross floor area (sqft). Used as a sanity check against CC3D footprint. */
  floor_area?: string;
}

// ─── URL BUILDER ─────────────────────────────────────────────────────────────

export function buildEnergyUrl(apn: string): string {
  // Energy benchmarking stores APN as parcel_number without dashes.
  const cleaned = apn.replace(/\D/g, "");
  const params = new URLSearchParams({
    $where: `parcel_number='${cleaned}'`,
    $order: "benchmark_year DESC",
    $limit: "1",
  });
  return `${SOCRATA_BASE}/${ENERGY_DATASET_ID}.json?${params.toString()}`;
}

// ─── FETCH ────────────────────────────────────────────────────────────────────

export async function fetchEnergyRecord(
  apn: string,
  fetchFn: typeof fetch = fetch
): Promise<EnergyBenchmarkRecord | null> {
  const url = buildEnergyUrl(apn);
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (APP_TOKEN) headers["X-App-Token"] = APP_TOKEN;

  let response: Response;
  try {
    response = await fetchFn(url, { headers });
  } catch (err) {
    console.error(`[energyIngest] Network error for APN ${apn}:`, err);
    return null;
  }

  if (!response.ok) {
    console.error(`[energyIngest] Socrata returned ${response.status} for APN ${apn}`);
    return null;
  }

  const data: EnergyBenchmarkRecord[] = await response.json();
  if (!data || data.length === 0) {
    // Not all buildings are required to benchmark — this is expected.
    console.info(`[energyIngest] No energy record for APN ${apn} — building may be exempt.`);
    return null;
  }

  return data[0];
}

// ─── TRANSFORM ────────────────────────────────────────────────────────────────

/**
 * Parse EUI from the raw record.
 * Prefers weather_normalized_site_eui for consistency across benchmark years.
 * Falls back to site_eui.
 */
export function parseEUI(record: EnergyBenchmarkRecord): number | null {
  const raw = record.weather_normalized_site_eui ?? record.site_eui;
  if (!raw) return null;
  const val = Number(raw);
  return isNaN(val) ? null : val;
}

/**
 * Derive a letter-grade sustainability rating from ENERGY STAR score.
 *
 * ENERGY STAR scale (1–100):
 *   75–100 = A  (top quartile — eligible for ENERGY STAR certification)
 *   50–74  = B  (above average)
 *   25–49  = C  (below average)
 *   1–24   = D  (poor)
 */
export function deriveRating(record: EnergyBenchmarkRecord): string | null {
  if (!record.energy_star_score) return null;
  const score = Number(record.energy_star_score);
  if (isNaN(score)) return null;
  if (score >= 75) return "A";
  if (score >= 50) return "B";
  if (score >= 25) return "C";
  return "D";
}

export function transformEnergyRecord(
  record: EnergyBenchmarkRecord
): Partial<BuildingEntity["intelligence"]> {
  return {
    environment: {
      energy_use_intensity: parseEUI(record),
      sustainability_rating: deriveRating(record),
      // remaining environment fields come from other jobs
      carbon_emissions: undefined,
      flood_risk: undefined,
      heat_island_index: undefined,
      solar_potential: undefined,
    },
  };
}

// ─── MAIN INGEST FUNCTION ─────────────────────────────────────────────────────

export interface EnergyIngestResult {
  success: boolean;
  entity: BuildingEntity;
  raw: EnergyBenchmarkRecord | null;
  message: string;
}

export async function ingestEnergy(
  entity: BuildingEntity,
  fetchFn: typeof fetch = fetch
): Promise<EnergyIngestResult> {
  const apn = entity.identity.apn;

  if (!apn) {
    return {
      success: false,
      entity,
      raw: null,
      message: `Skipped ${entity.identity.building_id} — no APN present.`,
    };
  }

  const raw = await fetchEnergyRecord(apn, fetchFn);

  if (!raw) {
    // No record is valid — many buildings are exempt from benchmarking.
    return {
      success: true,
      entity,
      raw: null,
      message: `No energy benchmarking record for APN ${apn} — building may be exempt.`,
    };
  }

  const payload = transformEnergyRecord(raw);
  const updated = mergeIntelligence(entity, payload, SOURCE_LABEL);

  return {
    success: true,
    entity: updated,
    raw,
    message: `Energy benchmarking merged for APN ${apn} (year: ${raw.benchmark_year ?? "unknown"}).`,
  };
}

// ─── BATCH ────────────────────────────────────────────────────────────────────

export interface EnergyBatchResult {
  succeeded: BuildingEntity[];
  failed: Array<{ building_id: string; reason: string }>;
}

export async function ingestEnergyBatch(
  entities: BuildingEntity[],
  fetchFn: typeof fetch = fetch,
  delayMs = 200
): Promise<EnergyBatchResult> {
  const succeeded: BuildingEntity[] = [];
  const failed: Array<{ building_id: string; reason: string }> = [];

  for (const entity of entities) {
    const result = await ingestEnergy(entity, fetchFn);
    if (result.success) {
      succeeded.push(result.entity);
    } else {
      failed.push({
        building_id: entity.identity.building_id,
        reason: result.message,
      });
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { succeeded, failed };
}
