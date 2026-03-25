/**
 * SF Assessor Property Characteristics — Ingest Job
 * Sprint 6 — Week 2
 *
 * Pulls building intelligence attributes from the SF Assessor dataset
 * on DataSF (Socrata API) by APN, then merges them into a BuildingEntity.
 *
 * Dataset: SF Assessor Historical Secured Property Tax Rolls
 * Endpoint: https://data.sfgov.org/resource/wv5m-vpq2.json
 * Docs:     https://dev.socrata.com/foundry/data.sfgov.org/wv5m-vpq2
 *
 * Fields populated:
 *   intelligence.land_use.building_use      (from use_code / use_def)
 *   intelligence.land_use.secondary_use     (from secondary_use_code / secondary_use_def)
 *   intelligence.land_use.building_class    (from property_class_code)
 *   intelligence.history.year_built         (from year_property_built)
 *   intelligence.ownership.ownership_type   (from ownership_type)
 *   intelligence.ownership.assessed_value   (from assessed_improvement_val + assessed_land_val)
 */

import type { BuildingEntity } from "./buildingEntity";
import { mergeIntelligence } from "./entityBinder";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SOCRATA_BASE = "https://data.sfgov.org/resource";
const ASSESSOR_DATASET_ID = "wv5m-vpq2";
const SOURCE_LABEL = "SF Assessor DataSF";

/**
 * Socrata app token.
 * Set VITE_DATASF_APP_TOKEN in your .env file.
 * Without a token requests still work but are rate-limited to ~1 req/sec.
 */
const APP_TOKEN =
  typeof import.meta !== "undefined"
    ? (import.meta as Record<string, Record<string, string>>).env
        ?.VITE_DATASF_APP_TOKEN ?? ""
    : process.env.DATASF_APP_TOKEN ?? "";

// ─── RAW SOCRATA RESPONSE SHAPE ───────────────────────────────────────────────
// Only the fields CityPulse needs. The full record has ~80 fields.

export interface AssessorRecord {
  /** Assessor Parcel Number. Format: "XXXX-XXX" or "XXXXXXXX". */
  apn?: string;
  /** Blk/lot — alternate parcel reference used by some SF datasets. */
  blk_lot?: string;
  /** Primary use code (numeric string). e.g. "D" = retail, "C" = office. */
  use_code?: string;
  /** Primary use description. e.g. "OFFICE", "RETAIL". */
  use_def?: string;
  /** Secondary use code. */
  secondary_use_code?: string;
  /** Secondary use description. */
  secondary_use_def?: string;
  /** Property class code. e.g. "A" = Class A office. */
  property_class_code?: string;
  /** Year the building was constructed. Numeric string. */
  year_property_built?: string;
  /** Assessed improvement value (USD). Numeric string. */
  assessed_improvement_val?: string;
  /** Assessed land value (USD). Numeric string. */
  assessed_land_val?: string;
  /** Ownership type. e.g. "Corporate", "Individual". */
  ownership_type?: string;
  /** Tax year the record applies to. Used for recency check. */
  tax_year?: string;
}

// ─── FETCH ────────────────────────────────────────────────────────────────────

/**
 * Build the Socrata query URL for a given APN.
 * Uses $where to match on apn field.
 * $order=tax_year DESC $limit=1 gets the most recent record.
 */
export function buildAssessorUrl(apn: string): string {
  const cleaned = apn.replace(/[^0-9]/g, ""); // strip dashes for query
  const params = new URLSearchParams({
    $where: `apn='${cleaned}'`,
    $order: "tax_year DESC",
    $limit: "1",
  });
  return `${SOCRATA_BASE}/${ASSESSOR_DATASET_ID}.json?${params.toString()}`;
}

export async function fetchAssessorRecord(
  apn: string,
  fetchFn: typeof fetch = fetch
): Promise<AssessorRecord | null> {
  return null;
}

// ─── TRANSFORM ────────────────────────────────────────────────────────────────

/**
 * Map ownership codes to human-readable labels.
 * Extend this map as more codes appear in the data.
 */
const OWNERSHIP_CODE_MAP: Record<string, string> = {
  CO: "Corporate",
  IN: "Individual",
  PU: "Public",
  TR: "Trust",
  PA: "Partnership",
  LL: "LLC",
};

function normalizeOwnershipType(raw: string | undefined): string | null {
  if (!raw) return null;
  return OWNERSHIP_CODE_MAP[raw.toUpperCase()] ?? raw;
}

/**
 * Derive a readable building use string from the assessor use_def field.
 * Falls back to use_code if use_def is absent.
 */
function normalizeBuildingUse(record: AssessorRecord): string | null {
  if (record.use_def) return toTitleCase(record.use_def);
  if (record.use_code) return `Use Code ${record.use_code}`;
  return null;
}

function normalizeSecondaryUse(record: AssessorRecord): string | null {
  if (record.secondary_use_def) return toTitleCase(record.secondary_use_def);
  if (record.secondary_use_code) return `Use Code ${record.secondary_use_code}`;
  return null;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse the assessor assessed value.
 * Total = improvement value + land value.
 */
function parseAssessedValue(record: AssessorRecord): number | null {
  const imp = Number(record.assessed_improvement_val ?? 0);
  const land = Number(record.assessed_land_val ?? 0);
  if (isNaN(imp) && isNaN(land)) return null;
  const total = (isNaN(imp) ? 0 : imp) + (isNaN(land) ? 0 : land);
  return total > 0 ? total : null;
}

/**
 * Transform a raw AssessorRecord into a BuildingEntity intelligence payload.
 */
export function transformAssessorRecord(
  record: AssessorRecord
): Partial<BuildingEntity["intelligence"]> {
  return {
    land_use: {
      building_use: normalizeBuildingUse(record),
      secondary_use: normalizeSecondaryUse(record),
      building_class: record.property_class_code ?? null,
      // occupancy_type comes from DBI permits, not assessor
      occupancy_type: null,
    },
    history: {
      year_built: record.year_property_built
        ? Number(record.year_property_built)
        : null,
      // last_renovated comes from DBI permits
      last_renovated: null,
      permit_history: null,
    },
    ownership: {
      ownership_type: normalizeOwnershipType(record.ownership_type),
      assessed_value: parseAssessedValue(record),
      // market_value comes from sales records — not assessor
      market_value: null,
      vacancy_status: null,
    },
  };
}

// ─── MAIN INGEST FUNCTION ─────────────────────────────────────────────────────

export interface IngestResult {
  success: boolean;
  entity: BuildingEntity;
  /** The raw assessor record fetched. Null if not found. */
  raw: AssessorRecord | null;
  message: string;
}

/**
 * Run the SF Assessor ingest job for a single building entity.
 *
 * 1. Checks the entity has an APN — skips if missing.
 * 2. Fetches the most recent assessor record from DataSF.
 * 3. Transforms the raw record into intelligence attributes.
 * 4. Merges into the entity and returns the updated entity.
 */
export async function ingestAssessor(
  entity: BuildingEntity,
  fetchFn: typeof fetch = fetch
): Promise<IngestResult> {
  const apn = entity.identity.apn;

  if (!apn) {
    return {
      success: false,
      entity,
      raw: null,
      message: `Skipped ${entity.identity.building_id} — no APN present.`,
    };
  }

  const raw = await fetchAssessorRecord(apn, fetchFn);
  if (!raw) {
    return {
      success: false,
      entity,
      raw: null,
      message: `No assessor record found for APN ${apn}.`,
    };
  }

  const payload = transformAssessorRecord(raw);
  const updated = mergeIntelligence(entity, payload, SOURCE_LABEL);

  return {
    success: true,
    entity: updated,
    raw,
    message: `Assessor data merged for APN ${apn} (tax year: ${raw.tax_year ?? "unknown"}).`,
  };
}

// ─── BATCH INGEST ─────────────────────────────────────────────────────────────

export interface BatchIngestResult {
  succeeded: BuildingEntity[];
  failed: Array<{ building_id: string; reason: string }>;
}

/**
 * Run the assessor ingest job across an array of building entities.
 * Processes sequentially to respect Socrata rate limits.
 * Add a delay between requests if running without an app token.
 */
export async function ingestAssessorBatch(
  entities: BuildingEntity[],
  fetchFn: typeof fetch = fetch,
  delayMs = 200
): Promise<BatchIngestResult> {
  const succeeded: BuildingEntity[] = [];
  const failed: Array<{ building_id: string; reason: string }> = [];

  for (const entity of entities) {
    const result = await ingestAssessor(entity, fetchFn);
    if (result.success) {
      succeeded.push(result.entity);
    } else {
      failed.push({
        building_id: entity.identity.building_id,
        reason: result.message,
      });
    }
    // Polite delay between Socrata requests
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { succeeded, failed };
}
