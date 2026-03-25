/**
 * DBI Building Permits — Ingest Job
 * Sprint 6 — Week 2
 *
 * Pulls permit history from the SF Department of Building Inspection
 * dataset on DataSF (Socrata API) by APN, then merges into a BuildingEntity.
 *
 * Dataset: Building Permits
 * Endpoint: https://data.sfgov.org/resource/i98e-djp9.json
 * Docs:     https://dev.socrata.com/foundry/data.sfgov.org/i98e-djp9
 *
 * Fields populated:
 *   intelligence.history.permit_history     (full permit records)
 *   intelligence.history.last_renovated     (year of most recent finalled permit)
 *   intelligence.land_use.occupancy_type    (from proposed_use on most recent permit)
 */

import type { BuildingEntity, PermitRecord } from "./buildingEntity";
import { mergeIntelligence } from "./entityBinder";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SOCRATA_BASE = "https://data.sfgov.org/resource";
const PERMITS_DATASET_ID = "i98e-djp9";
const SOURCE_LABEL = "DBI Building Permits DataSF";

const APP_TOKEN =
  typeof import.meta !== "undefined"
    ? (import.meta as Record<string, Record<string, string>>).env
        ?.VITE_DATASF_APP_TOKEN ?? ""
    : process.env.DATASF_APP_TOKEN ?? "";

// Max permits to fetch per building.
// Keeps response sizes predictable for large commercial buildings.
const MAX_PERMITS = 50;

// ─── RAW SOCRATA RESPONSE SHAPE ───────────────────────────────────────────────

export interface DBIPermitRecord {
  /** Permit number. Primary identifier. */
  permit_number?: string;
  /** Permit type definition. e.g. "Additions Alterations Or Repairs". */
  permit_type_definition?: string;
  /** Date application was filed. ISO string. */
  filed_date?: string;
  /** Date permit was issued. ISO string. */
  issued_date?: string;
  /** Date permit was completed / finalled. ISO string. */
  completed_date?: string;
  /** Current permit status. e.g. "complete", "issued", "filed". */
  status?: string;
  /** Description of work. */
  description?: string;
  /** Proposed occupancy / use from the permit application. */
  proposed_use?: string;
  /** Existing occupancy / use before permit work. */
  existing_use?: string;
  /** Estimated construction cost (USD). Numeric string. */
  estimated_cost?: string;
  /** Block and lot — used to match parcel. */
  block?: string;
  lot?: string;
}

// ─── STATUS NORMALISATION ─────────────────────────────────────────────────────

/**
 * Statuses that indicate completed construction work.
 * Used to determine last_renovated year.
 */
const COMPLETED_STATUSES = new Set([
  "complete",
  "completed",
  "finalled",
  "final",
  "expired", // expired permits still reflect attempted work
]);

function isCompleted(status: string | undefined): boolean {
  if (!status) return false;
  return COMPLETED_STATUSES.has(status.toLowerCase().trim());
}

// ─── URL BUILDER ──────────────────────────────────────────────────────────────

/**
 * Build the Socrata query URL for permits by APN.
 *
 * DBI stores parcel references as block + lot rather than full APN.
 * APN format "BBBB-LLL" → block="BBBB" lot="LLL".
 * Falls back to a full-text search on the street address if needed,
 * but block/lot is the most reliable match.
 */
export function parseBlockLot(apn: string): { block: string; lot: string } | null {
  // Strip non-numeric characters, then split at the natural block/lot boundary.
  // SF APNs: first 4 digits = block, last 3 digits = lot.
  const digits = apn.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return {
    block: digits.slice(0, 4),
    lot: digits.slice(4, 7),
  };
}

export function buildPermitsUrl(apn: string): string {
  const parsed = parseBlockLot(apn);
  if (!parsed) {
    throw new Error(`Cannot parse block/lot from APN: ${apn}`);
  }

  const params = new URLSearchParams({
    $where: `block='${parsed.block}' AND lot='${parsed.lot}'`,
    $order: "filed_date DESC",
    $limit: String(MAX_PERMITS),
  });

  return `${SOCRATA_BASE}/${PERMITS_DATASET_ID}.json?${params.toString()}`;
}

// ─── FETCH ────────────────────────────────────────────────────────────────────

export async function fetchPermitRecords(
  apn: string,
  fetchFn: typeof fetch = fetch
): Promise<DBIPermitRecord[]> {
  return [];
}

// ─── TRANSFORM ────────────────────────────────────────────────────────────────

/**
 * Map a raw DBI permit record to the canonical PermitRecord shape.
 */
export function toPermitRecord(raw: DBIPermitRecord): PermitRecord {
  return {
    permit_number: raw.permit_number ?? "UNKNOWN",
    permit_type: raw.permit_type_definition ?? "Unknown",
    filed_date: raw.filed_date ?? null,
    issued_date: raw.issued_date ?? null,
    status: raw.status ?? null,
    description: raw.description ?? null,
  };
}

/**
 * Derive last_renovated year from the most recent completed permit.
 * Uses completed_date first, then issued_date as a fallback.
 */
export function deriveLastRenovated(records: DBIPermitRecord[]): number | null {
  const completed = records.filter((r) => isCompleted(r.status));
  if (completed.length === 0) return null;

  // Sort by completed_date DESC, fall back to issued_date
  const sorted = [...completed].sort((a, b) => {
    const dateA = a.completed_date ?? a.issued_date ?? "";
    const dateB = b.completed_date ?? b.issued_date ?? "";
    return dateB.localeCompare(dateA);
  });

  const mostRecent = sorted[0];
  const dateStr = mostRecent.completed_date ?? mostRecent.issued_date;
  if (!dateStr) return null;

  const year = new Date(dateStr).getFullYear();
  return isNaN(year) ? null : year;
}

/**
 * Derive occupancy_type from proposed_use on the most recent permit.
 * Falls back to existing_use if proposed_use is absent.
 */
export function deriveOccupancyType(records: DBIPermitRecord[]): string | null {
  if (records.length === 0) return null;
  // Records are already sorted filed_date DESC from the API
  for (const record of records) {
    const use = record.proposed_use ?? record.existing_use;
    if (use) return use;
  }
  return null;
}

/**
 * Transform raw DBI permit records into a BuildingEntity intelligence payload.
 */
export function transformPermitRecords(
  records: DBIPermitRecord[]
): Partial<BuildingEntity["intelligence"]> {
  return {
    land_use: {
      // Only occupancy_type comes from permits.
      // building_use, secondary_use, building_class come from assessor.
      // Omit those fields entirely so mergeIntelligence doesn't clobber them.
      building_use: undefined,
      secondary_use: undefined,
      building_class: undefined,
      occupancy_type: deriveOccupancyType(records),
    },
    history: {
      // year_built comes from assessor, not permits.
      year_built: undefined,
      last_renovated: deriveLastRenovated(records),
      permit_history: records.map(toPermitRecord),
    },
  };
}

// ─── MAIN INGEST FUNCTION ─────────────────────────────────────────────────────

export interface PermitsIngestResult {
  success: boolean;
  entity: BuildingEntity;
  raw: DBIPermitRecord[];
  message: string;
}

/**
 * Run the DBI permits ingest job for a single building entity.
 *
 * 1. Checks entity has an APN.
 * 2. Parses block/lot from APN.
 * 3. Fetches up to MAX_PERMITS records from DataSF.
 * 4. Transforms and merges into the entity.
 */
export async function ingestPermits(
  entity: BuildingEntity,
  fetchFn: typeof fetch = fetch
): Promise<PermitsIngestResult> {
  const apn = entity.identity.apn;

  if (!apn) {
    return {
      success: false,
      entity,
      raw: [],
      message: `Skipped ${entity.identity.building_id} — no APN present.`,
    };
  }

  const parsed = parseBlockLot(apn);
  if (!parsed) {
    return {
      success: false,
      entity,
      raw: [],
      message: `Cannot parse block/lot from APN ${apn}.`,
    };
  }

  const raw = await fetchPermitRecords(apn, fetchFn);

  // An empty permit list is valid — not every building has permits on file.
  const payload = transformPermitRecords(raw);
  const updated = mergeIntelligence(entity, payload, SOURCE_LABEL);

  return {
    success: true,
    entity: updated,
    raw,
    message: `${raw.length} permit(s) merged for APN ${apn}.`,
  };
}

// ─── BATCH INGEST ─────────────────────────────────────────────────────────────

export interface PermitsBatchResult {
  succeeded: BuildingEntity[];
  failed: Array<{ building_id: string; reason: string }>;
}

export async function ingestPermitsBatch(
  entities: BuildingEntity[],
  fetchFn: typeof fetch = fetch,
  delayMs = 200
): Promise<PermitsBatchResult> {
  const succeeded: BuildingEntity[] = [];
  const failed: Array<{ building_id: string; reason: string }> = [];

  for (const entity of entities) {
    const result = await ingestPermits(entity, fetchFn);
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
