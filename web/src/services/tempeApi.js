/**
 * tempeApi.js — ArcGIS data layer for CityPulse Tempe
 *
 * Two confirmed ArcGIS FeatureServer endpoints:
 *   - Building permits (Maricopa County / City of Tempe)
 *   - Zoning districts (City of Tempe GIS)
 *
 * All functions return camelCase arrays and gracefully degrade to []
 * on network or parse errors.
 */

const PERMITS_URL =
  "https://services.arcgis.com/lQySeXwbBg53XWDi/arcgis/rest/services/building_permits/FeatureServer/0/query";

const ZONING_URL =
  "https://gis.tempe.gov/arcgis/rest/services/Open_Data/Zoning_Districts/FeatureServer/0/query";

/** ArcGIS REST API page size ceiling. */
const PAGE_SIZE = 2000;

// ── Zone code groupings ─────────────────────────────────────────────────────

/** @type {Record<string, string[]>} */
export const ZONE_CODE_MAP = {
  "mixed-use":     ["MU-2", "MU-3", "MU-4", "MU-ED"],
  "single family": ["R1-4", "R1-5", "R1-6", "R1-PAD"],
  "high density":  ["R-3", "R-3R", "R-4", "R-5"],
  "commercial":    ["CC", "CSS", "PCC-1", "PCC-2"],
  "industrial":    ["GI", "LI"],
};

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Query an ArcGIS FeatureServer endpoint and return the features array.
 * @param {string} baseUrl
 * @param {Record<string, string>} params
 * @returns {Promise<any[]>}
 */
async function arcgisQuery(baseUrl, params) {
  const qs = new URLSearchParams({ f: "json", outSR: "4326", returnGeometry: "true", ...params });
  const res = await fetch(`${baseUrl}?${qs}`);
  if (!res.ok) throw new Error(`ArcGIS ${res.status}: ${baseUrl}`);
  const json = await res.json();
  if (json.error) throw new Error(`ArcGIS error: ${json.error.message}`);
  return json.features ?? [];
}

/**
 * Map a raw ArcGIS permit feature to a clean camelCase object.
 * @param {{ attributes: Record<string, any>, geometry?: { x: number, y: number } }} f
 * @returns {{ address: string, issuedDate: string|null, estimatedCost: number, zone: string, permitType: string, status: string, housingUnits: number, lat: number|null, lng: number|null }}
 */
function mapPermit(f) {
  const a = f.attributes ?? {};
  const ts = a.IssuedDateDtm;
  return {
    address:       a.OriginalAddress1 ?? "",
    issuedDate:    ts ? new Date(ts).toISOString().split("T")[0] : null,
    estimatedCost: Number(a.EstProjectCost) || 0,
    zone:          a.Zone ?? "",
    permitType:    a.PermitType ?? "",
    status:        a.StatusCurrent ?? "",
    housingUnits:  Number(a.HousingUnits) || 0,
    lat:           f.geometry?.y ?? null,
    lng:           f.geometry?.x ?? null,
  };
}

/**
 * Map a raw ArcGIS zoning feature to a clean camelCase object.
 * @param {{ attributes: Record<string, any>, geometry?: any }} f
 * @returns {{ zoningCode: string, description: string, maxHeight: number|null, maxDensity: number|null, geometry: any }}
 */
function mapZone(f) {
  const a = f.attributes ?? {};
  return {
    zoningCode:  a.ZoningCode ?? "",
    description: a.ZoningDescription ?? "",
    maxHeight:   a.HeightMax != null ? Number(a.HeightMax) : null,
    maxDensity:  a.DensityMaximum != null ? Number(a.DensityMaximum) : null,
    geometry:    f.geometry ?? null,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch building permits issued within the last `daysBack` days.
 * Handles ArcGIS pagination (2 000 feature ceiling per request).
 *
 * @param {number} [daysBack=90]
 * @returns {Promise<Array<{ address: string, issuedDate: string|null, estimatedCost: number, zone: string, permitType: string, status: string, housingUnits: number, lat: number|null, lng: number|null }>>}
 */
export async function fetchRecentPermits(daysBack = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split("T")[0];
    const where = `IssuedDateDtm >= DATE '${cutoffDate}'`;
    const outFields = "OriginalAddress1,IssuedDateDtm,EstProjectCost,Zone,PermitType,StatusCurrent,HousingUnits";

    let all = [];
    let offset = 0;

    while (true) {
      const features = await arcgisQuery(PERMITS_URL, {
        where,
        outFields,
        resultRecordCount: String(PAGE_SIZE),
        resultOffset: String(offset),
      });
      all = all.concat(features);
      if (features.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return all.map(mapPermit);
  } catch (err) {
    console.warn("[tempeApi] fetchRecentPermits failed:", err);
    return [];
  }
}

/**
 * Fetch all Tempe zoning districts with geometry.
 *
 * @returns {Promise<Array<{ zoningCode: string, description: string, maxHeight: number|null, maxDensity: number|null, geometry: any }>>}
 */
export async function fetchZoningDistricts() {
  try {
    const outFields = "ZoningCode,ZoningDescription,HeightMax,DensityMaximum";
    let all = [];
    let offset = 0;

    while (true) {
      const features = await arcgisQuery(ZONING_URL, {
        where: "1=1",
        outFields,
        resultRecordCount: String(PAGE_SIZE),
        resultOffset: String(offset),
      });
      all = all.concat(features);
      if (features.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return all.map(mapZone);
  } catch (err) {
    console.warn("[tempeApi] fetchZoningDistricts failed:", err);
    return [];
  }
}

/**
 * Fetch building permits filtered to specific zone codes.
 * Pass an array like `['MU-2', 'MU-3']` or use ZONE_CODE_MAP values.
 *
 * @param {string[]} [zoneCodes=[]]
 * @returns {Promise<Array<{ address: string, issuedDate: string|null, estimatedCost: number, zone: string, permitType: string, status: string, housingUnits: number, lat: number|null, lng: number|null }>>}
 */
export async function fetchPermitsByZoneCode(zoneCodes = []) {
  if (zoneCodes.length === 0) return [];
  try {
    const inList = zoneCodes.map((c) => `'${c}'`).join(",");
    const where = `Zone IN (${inList})`;
    const outFields = "OriginalAddress1,IssuedDateDtm,EstProjectCost,Zone,PermitType,StatusCurrent,HousingUnits";

    let all = [];
    let offset = 0;

    while (true) {
      const features = await arcgisQuery(PERMITS_URL, {
        where,
        outFields,
        resultRecordCount: String(PAGE_SIZE),
        resultOffset: String(offset),
      });
      all = all.concat(features);
      if (features.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return all.map(mapPermit);
  } catch (err) {
    console.warn("[tempeApi] fetchPermitsByZoneCode failed:", err);
    return [];
  }
}
