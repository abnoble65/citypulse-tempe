/**
 * SF Planning GIS — Zoning & Height Ingest Job
 * Sprint 6 — Week 2
 *
 * Pulls zoning and height regulation data from the SF Planning Department
 * ArcGIS REST API by APN / parcel geometry.
 *
 * Base URL: https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer
 *
 * Two layers queried:
 *   Layer 0 — Zoning Districts    → regulation.zoning_code, regulation.special_districts
 *   Layer 1 — Height & Bulk       → regulation.zoning_height_limit, regulation.zoning_height_control
 *
 * Fields populated:
 *   regulation.zoning_code
 *   regulation.special_districts
 *   regulation.zoning_height_limit
 *   regulation.zoning_height_control
 *
 * Note: CC3D already carries zoning, gen_hght, and height1 from its own
 * data pipeline. This ingest job provides an independent verification pass
 * and fills any gaps where CC3D fields are null.
 */

import type { BuildingEntity } from "./buildingEntity";
import { mergeIntelligence } from "./entityBinder";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ARCGIS_BASE =
  "https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer";

const LAYER = {
  ZONING: 0,
  HEIGHT_BULK: 1,
} as const;

const SOURCE_LABEL = "SF Planning GIS ArcGIS";

// ─── RAW ARCGIS RESPONSE SHAPES ───────────────────────────────────────────────

export interface ArcGISFeature<T> {
  attributes: T;
}

export interface ArcGISResponse<T> {
  features: ArcGISFeature<T>[];
  error?: { code: number; message: string };
}

/** Raw attributes from the Zoning Districts layer. */
export interface ZoningAttributes {
  /** Zoning district code. e.g. "C-3-O", "RH-2". */
  ZONING_SIM?: string;
  /** Full zoning district name. */
  DISTRICTNAME?: string;
  /** Special use district code (if applicable). */
  SPECIAL_USE_DIST?: string;
}

/** Raw attributes from the Height & Bulk Districts layer. */
export interface HeightBulkAttributes {
  /** Height limit label. e.g. "600-S", "40-X". */
  HEIGHT_DIST?: string;
  /** Numeric height limit in feet. */
  HEIGHT_NUM?: number;
  /** Bulk district code. */
  BULK_DIST?: string;
}

// ─── URL BUILDERS ─────────────────────────────────────────────────────────────

/**
 * Build an ArcGIS query URL for a given layer and APN.
 *
 * ArcGIS query params:
 *   where      — attribute filter (APN field name varies by layer)
 *   outFields  — comma-separated list of fields to return
 *   f          — response format (always "json")
 *   returnGeometry — false (we only need attributes)
 */
export function buildArcGISUrl(
  layer: number,
  where: string,
  outFields: string[]
): string {
  const params = new URLSearchParams({
    where,
    outFields: outFields.join(","),
    returnGeometry: "false",
    f: "json",
  });
  return `${ARCGIS_BASE}/${layer}/query?${params.toString()}`;
}

export function buildZoningUrl(blklot: string): string {
  return buildArcGISUrl(
    LAYER.ZONING,
    `BLKLOT='${blklot}'`,
    ["ZONING_SIM", "DISTRICTNAME", "SPECIAL_USE_DIST"]
  );
}

export function buildHeightBulkUrl(blklot: string): string {
  return buildArcGISUrl(
    LAYER.HEIGHT_BULK,
    `BLKLOT='${blklot}'`,
    ["HEIGHT_DIST", "HEIGHT_NUM", "BULK_DIST"]
  );
}

// ─── APN → BLKLOT ─────────────────────────────────────────────────────────────

/**
 * Convert APN to the BLKLOT format used by SF Planning GIS.
 * APN "0667-001" → BLKLOT "0667001"
 * Strips all non-numeric characters then zero-pads to 7 digits.
 */
export function apnToBlklot(apn: string): string {
  return apn.replace(/\D/g, "").padStart(7, "0");
}

// ─── FETCH HELPERS ────────────────────────────────────────────────────────────

async function fetchArcGISLayer<T>(
  url: string,
  fetchFn: typeof fetch
): Promise<T[]> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[planningIngest] Network error:", err);
    return [];
  }

  if (!response.ok) {
    console.error(`[planningIngest] ArcGIS returned ${response.status}`);
    return [];
  }

  const data: ArcGISResponse<T> = await response.json();

  if (data.error) {
    console.error("[planningIngest] ArcGIS error:", data.error.message);
    return [];
  }

  return (data.features ?? []).map((f) => f.attributes);
}

export async function fetchZoningAttributes(
  blklot: string,
  fetchFn: typeof fetch = fetch
): Promise<ZoningAttributes[]> {
  return fetchArcGISLayer<ZoningAttributes>(buildZoningUrl(blklot), fetchFn);
}

export async function fetchHeightBulkAttributes(
  blklot: string,
  fetchFn: typeof fetch = fetch
): Promise<HeightBulkAttributes[]> {
  return fetchArcGISLayer<HeightBulkAttributes>(
    buildHeightBulkUrl(blklot),
    fetchFn
  );
}

// ─── TRANSFORM ────────────────────────────────────────────────────────────────

/**
 * Convert a height in feet to metres, rounded to 1 decimal place.
 * SF Planning uses feet; CityPulse stores metres to match CC3D geometry.
 */
export function feetToMetres(feet: number | undefined): number | null {
  if (feet === undefined || feet === null || isNaN(feet)) return null;
  return Math.round(feet * 0.3048 * 10) / 10;
}

/**
 * Collect all non-null special use district codes from zoning features.
 * A parcel can span multiple zoning polygons in edge cases.
 */
export function extractSpecialDistricts(
  features: ZoningAttributes[]
): string[] | null {
  const districts = features
    .map((f) => f.SPECIAL_USE_DIST)
    .filter((d): d is string => !!d && d.trim() !== "" && d !== "None");
  return districts.length > 0 ? districts : null;
}

export function transformZoningAttributes(
  features: ZoningAttributes[]
): Pick<BuildingEntity["regulation"], "zoning_code" | "special_districts"> {
  if (features.length === 0) {
    return { zoning_code: null, special_districts: null };
  }
  // Use the first feature as primary — parcels are usually in one zone.
  const primary = features[0];
  return {
    zoning_code: primary.ZONING_SIM ?? null,
    special_districts: extractSpecialDistricts(features),
  };
}

export function transformHeightBulkAttributes(
  features: HeightBulkAttributes[]
): Pick<
  BuildingEntity["regulation"],
  "zoning_height_limit" | "zoning_height_control"
> {
  if (features.length === 0) {
    return { zoning_height_limit: null, zoning_height_control: null };
  }
  const primary = features[0];
  return {
    zoning_height_limit: feetToMetres(primary.HEIGHT_NUM),
    zoning_height_control: primary.HEIGHT_DIST ?? null,
  };
}

// ─── MAIN INGEST FUNCTION ─────────────────────────────────────────────────────

export interface PlanningIngestResult {
  success: boolean;
  entity: BuildingEntity;
  message: string;
}

/**
 * Run the SF Planning GIS ingest job for a single building entity.
 *
 * Queries both Zoning and Height & Bulk layers in parallel.
 * Results are merged into the regulation layer of the entity.
 *
 * Only fills null regulation fields — does not overwrite values
 * already provided by CC3D unless CC3D left them null.
 */
export async function ingestPlanning(
  entity: BuildingEntity,
  fetchFn: typeof fetch = fetch
): Promise<PlanningIngestResult> {
  const apn = entity.identity.apn;

  if (!apn) {
    return {
      success: false,
      entity,
      message: `Skipped ${entity.identity.building_id} — no APN present.`,
    };
  }

  const blklot = apnToBlklot(apn);

  // Query both layers in parallel
  const [zoningFeatures, heightFeatures] = await Promise.all([
    fetchZoningAttributes(blklot, fetchFn),
    fetchHeightBulkAttributes(blklot, fetchFn),
  ]);

  const zoningResult = transformZoningAttributes(zoningFeatures);
  const heightResult = transformHeightBulkAttributes(heightFeatures);

  // Build regulation payload.
  // Only set a field if CC3D left it null — CC3D values take precedence.
  const regulation: Partial<BuildingEntity["regulation"]> = {};

  if (!entity.regulation.zoning_code && zoningResult.zoning_code) {
    regulation.zoning_code = zoningResult.zoning_code;
  }
  if (!entity.regulation.special_districts && zoningResult.special_districts) {
    regulation.special_districts = zoningResult.special_districts;
  }
  if (!entity.regulation.zoning_height_limit && heightResult.zoning_height_limit) {
    regulation.zoning_height_limit = heightResult.zoning_height_limit;
  }
  if (!entity.regulation.zoning_height_control && heightResult.zoning_height_control) {
    regulation.zoning_height_control = heightResult.zoning_height_control;
  }

  // Merge regulation fields directly onto the entity (bypass intelligence merge)
  const updated: BuildingEntity = {
    ...entity,
    regulation: {
      ...entity.regulation,
      ...regulation,
    },
    provenance: {
      ...entity.provenance,
      intelligence_updated_at: new Date().toISOString(),
      intelligence_sources: Array.from(
        new Set([...entity.provenance.intelligence_sources, SOURCE_LABEL])
      ),
    },
  };

  const zoningCount = zoningFeatures.length;
  const heightCount = heightFeatures.length;

  return {
    success: true,
    entity: updated,
    message: `Planning GIS merged for BLKLOT ${blklot} — ${zoningCount} zoning feature(s), ${heightCount} height feature(s).`,
  };
}

// ─── BATCH ────────────────────────────────────────────────────────────────────

export interface PlanningBatchResult {
  succeeded: BuildingEntity[];
  failed: Array<{ building_id: string; reason: string }>;
}

export async function ingestPlanningBatch(
  entities: BuildingEntity[],
  fetchFn: typeof fetch = fetch,
  delayMs = 200
): Promise<PlanningBatchResult> {
  const succeeded: BuildingEntity[] = [];
  const failed: Array<{ building_id: string; reason: string }> = [];

  for (const entity of entities) {
    const result = await ingestPlanning(entity, fetchFn);
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
