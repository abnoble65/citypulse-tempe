/**
 * CityPulse Entity Binder
 * Sprint 6 — Phase 2 Entity Binding
 *
 * Takes a raw CC3D record and produces a canonical BuildingEntity.
 * Intelligence-layer attributes are left as null here — they are
 * populated separately by CityPulse ingest jobs (assessor, permits, etc.).
 *
 * Usage:
 *   import { bindCC3DRecord } from './entityBinder';
 *   const entity = bindCC3DRecord(cc3dRecord);
 */

import type { BuildingEntity } from "./buildingEntity";
import { emptyBuildingEntity } from "./buildingEntity";
import type { CC3DRecord } from "./cc3dMapping";
import { CC3D_FIELD_MAP } from "./cc3dMapping";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Set a value at a dot-notation path on a plain object.
 * e.g. setPath(obj, "identity.apn", "123-456")
 */
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

/** Coerce a raw CC3D value to the declared type. */
function coerce(raw: unknown, type: string): unknown {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case "number":
      return typeof raw === "number" ? raw : Number(raw) || null;
    case "string[]":
      return Array.isArray(raw) ? raw.map(String) : [String(raw)];
    case "iso_date":
      return raw ? new Date(String(raw)).toISOString() : null;
    default: // "string"
      return String(raw);
  }
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

export interface BindingResult {
  entity: BuildingEntity;
  warnings: string[];
}

function validateCC3DRecord(record: CC3DRecord): string[] {
  const warnings: string[] = [];

  if (!record.BuildingID) {
    warnings.push("CRITICAL: BuildingID is missing. Entity cannot be bound.");
  }
  if (!record.APN) {
    warnings.push(
      "WARNING: APN is missing. Cannot link to city datasets. Entity will have no intelligence attributes."
    );
  }
  if (record.height === null || record.height === undefined) {
    warnings.push("WARNING: height is null. Geometry layer will be incomplete.");
  }
  if (!record.zoning) {
    warnings.push("INFO: zoning is null. Regulation layer will be incomplete.");
  }

  return warnings;
}

// ─── MAIN BINDER ─────────────────────────────────────────────────────────────

/**
 * Bind a raw CC3D record to a canonical BuildingEntity.
 *
 * Returns the entity plus any validation warnings.
 * If BuildingID is missing, the entity is still returned but warnings
 * will flag it as un-bindable.
 */
export function bindCC3DRecord(record: CC3DRecord): BindingResult {
  const warnings = validateCC3DRecord(record);

  // Start with an empty entity, keyed by BuildingID (may be empty string)
  const entity = emptyBuildingEntity(
    record.BuildingID ?? "",
    record.APN ?? null
  ) as unknown as Record<string, unknown>;

  // Apply every field in the crosswalk map
  for (const mapping of CC3D_FIELD_MAP) {
    const raw = record[mapping.cc3d_field];
    const coerced = coerce(raw, mapping.type);
    setPath(entity, mapping.entity_path, coerced);
  }

  // Stamp provenance timestamp
  setPath(entity, "provenance.geometry_updated_at", new Date().toISOString());

  return {
    entity: entity as unknown as BuildingEntity,
    warnings,
  };
}

// ─── BATCH BINDER ────────────────────────────────────────────────────────────

/**
 * Bind an array of CC3D records.
 * Skips records missing BuildingID and logs them to `skipped`.
 */
export function bindCC3DRecords(records: CC3DRecord[]): {
  entities: BuildingEntity[];
  skipped: Array<{ record: CC3DRecord; reason: string }>;
  warningCount: number;
} {
  const entities: BuildingEntity[] = [];
  const skipped: Array<{ record: CC3DRecord; reason: string }> = [];
  let warningCount = 0;

  for (const record of records) {
    if (!record.BuildingID) {
      skipped.push({ record, reason: "Missing BuildingID" });
      continue;
    }

    const { entity, warnings } = bindCC3DRecord(record);
    entities.push(entity);
    warningCount += warnings.length;

    if (warnings.length > 0) {
      console.warn(`[entityBinder] ${record.BuildingID}:`, warnings);
    }
  }

  return { entities, skipped, warningCount };
}

// ─── INTELLIGENCE MERGE ──────────────────────────────────────────────────────

/**
 * Merge a partial intelligence payload (from a CityPulse ingest job)
 * into an existing BuildingEntity.
 *
 * Ingest jobs call this after pulling data from DataSF, Planning GIS, etc.
 * Only non-null incoming values overwrite existing ones.
 */
export function mergeIntelligence(
  entity: BuildingEntity,
  payload: Partial<BuildingEntity["intelligence"]>,
  source: string
): BuildingEntity {
  // Only overwrite a field if the incoming value is not undefined.
  // null = "we looked and found nothing" (valid, overwrites)
  // undefined = "this job doesn't own this field" (skip, preserve existing)
  function mergeLayer<T extends object>(existing: T, incoming: Partial<T> | undefined): T {
    if (!incoming) return existing;
    const result = { ...existing };
    for (const key of Object.keys(incoming) as (keyof T)[]) {
      if (incoming[key] !== undefined) {
        result[key] = incoming[key] as T[keyof T];
      }
    }
    return result;
  }

  const merged: BuildingEntity = {
    ...entity,
    intelligence: {
      land_use: mergeLayer(entity.intelligence.land_use, payload.land_use),
      history: mergeLayer(entity.intelligence.history, payload.history),
      ownership: mergeLayer(entity.intelligence.ownership, payload.ownership),
      environment: mergeLayer(entity.intelligence.environment, payload.environment),
      signals: mergeLayer(entity.intelligence.signals, payload.signals),
    },
    provenance: {
      ...entity.provenance,
      intelligence_updated_at: new Date().toISOString(),
      intelligence_sources: Array.from(
        new Set([...entity.provenance.intelligence_sources, source])
      ),
    },
  };

  return merged;
}

// ─── COMPLETENESS CHECK ──────────────────────────────────────────────────────

/**
 * Returns a score (0–100) for how complete an entity's intelligence layer is.
 * Useful for prioritising which buildings need more data ingestion.
 */
export function intelligenceCompleteness(entity: BuildingEntity): number {
  const fields = [
    entity.intelligence.land_use.building_use,
    entity.intelligence.land_use.secondary_use,
    entity.intelligence.land_use.occupancy_type,
    entity.intelligence.land_use.building_class,
    entity.intelligence.history.year_built,
    entity.intelligence.history.last_renovated,
    entity.intelligence.history.permit_history,
    entity.intelligence.ownership.ownership_type,
    entity.intelligence.ownership.assessed_value,
    entity.intelligence.ownership.market_value,
    entity.intelligence.environment.energy_use_intensity,
    entity.intelligence.environment.flood_risk,
    entity.intelligence.environment.solar_potential,
    entity.intelligence.signals.readiness_score,
    entity.intelligence.signals.readiness_label,
    entity.intelligence.signals.permit_activity_signal,
    entity.intelligence.signals.total_permits,
  ];

  const filled = fields.filter((f) => f !== null && f !== undefined).length;
  return Math.round((filled / fields.length) * 100);
}
