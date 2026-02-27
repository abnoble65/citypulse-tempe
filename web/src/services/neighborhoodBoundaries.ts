/**
 * neighborhoodBoundaries.ts — fetch SF neighborhood boundary GeoJSON
 *
 * Source: DataSF dataset jwn9-ihcz (SF Planning Analysis Neighborhoods)
 * Field: `name` (exact equality match via SoQL)
 *
 * Alias map handles CityPulse names that differ from DataSF names.
 * Fetches are parallel; results are cached for the session lifetime
 * (module-level Map — survives React remounts, cleared on page reload).
 */

import type { Feature, GeoJsonObject } from "geojson";
import type { DistrictConfig } from "../districts";

export type { GeoJsonObject };
export type GeoFeature = Feature<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

// ── CityPulse name → DataSF analysis-neighborhood name ──────────────────────
const ALIASES: Record<string, string> = {
  "SoMa":             "South of Market",
  "Haight-Ashbury":   "Haight Ashbury",
  "Mission District": "Mission",
  "Ocean View":       "Oceanview",
};

/** Names that have no matching feature in the DataSF dataset — skip silently. */
const NO_MATCH = new Set(["NoPa"]);

function toDataSFName(cityPulseName: string): string | null {
  if (NO_MATCH.has(cityPulseName)) return null;
  return ALIASES[cityPulseName] ?? cityPulseName;
}

// ── Module-level cache (lives for the page session) ──────────────────────────
const cache = new Map<string, GeoFeature | null>();

async function fetchOne(datasfName: string): Promise<GeoFeature | null> {
  if (cache.has(datasfName)) return cache.get(datasfName)!;
  try {
    const url =
      `https://data.sfgov.org/resource/jwn9-ihcz.geojson` +
      `?$where=name='${encodeURIComponent(datasfName)}'`;
    const res = await fetch(url);
    if (!res.ok) { cache.set(datasfName, null); return null; }
    const fc = await res.json() as { features?: Feature[] };
    const feature = (fc.features?.[0] ?? null) as GeoFeature | null;
    cache.set(datasfName, feature);
    return feature;
  } catch {
    cache.set(datasfName, null);
    return null;
  }
}

/**
 * Fetch boundary GeoJSON for every neighborhood in `districtConfig`.
 * Returns Map<cityPulseName, GeoFeature>.
 * Neighborhoods without a DataSF match are silently omitted.
 */
export async function fetchDistrictBoundaries(
  districtConfig: DistrictConfig,
): Promise<Map<string, GeoFeature>> {
  const results = new Map<string, GeoFeature>();
  await Promise.allSettled(
    districtConfig.neighborhoods.map(async n => {
      const dsName = toDataSFName(n.name);
      if (!dsName) return;
      const feature = await fetchOne(dsName);
      if (feature) results.set(n.name, feature);
    }),
  );
  return results;
}

// ── SF Supervisor District boundaries ────────────────────────────────────────
// Source: DataSF dataset f2zs-jevy (Current Supervisor Districts)
// Field: sup_dist — "1"–"11"

const districtBoundaryCache = new Map<string, GeoFeature | null>();

/**
 * Fetch the boundary polygon for a single SF Supervisor District.
 * Returns null for citywide (number "0") or on fetch failure.
 * Results are cached for the session lifetime.
 */
export async function fetchSFSupervisorBoundary(
  districtNumber: string,
): Promise<GeoFeature | null> {
  if (districtNumber === "0") return null;
  if (districtBoundaryCache.has(districtNumber))
    return districtBoundaryCache.get(districtNumber)!;
  try {
    const url =
      `https://data.sfgov.org/resource/f2zs-jevy.geojson` +
      `?$where=sup_dist='${encodeURIComponent(districtNumber)}'&$limit=1`;
    const res = await fetch(url);
    if (!res.ok) { districtBoundaryCache.set(districtNumber, null); return null; }
    const fc = await res.json() as { features?: Feature[] };
    const feature = (fc.features?.[0] ?? null) as GeoFeature | null;
    districtBoundaryCache.set(districtNumber, feature);
    return feature;
  } catch {
    districtBoundaryCache.set(districtNumber, null);
    return null;
  }
}

/**
 * Fetch all 11 SF Supervisor District boundaries in one request.
 * Returns Map<districtNumber, GeoFeature> ("1"–"11" keys).
 * Used by the Home page SF district map.
 */
export async function fetchAllSFDistrictBoundaries(): Promise<Map<string, GeoFeature>> {
  const results = new Map<string, GeoFeature>();
  try {
    const url = `https://data.sfgov.org/resource/f2zs-jevy.geojson?$limit=11`;
    const res = await fetch(url);
    if (!res.ok) return results;
    const fc = await res.json() as { features?: Feature[] };
    for (const feat of fc.features ?? []) {
      const num: string = feat.properties?.sup_dist;
      if (num) results.set(num, feat as GeoFeature);
    }
  } catch { /* return empty map */ }
  return results;
}
