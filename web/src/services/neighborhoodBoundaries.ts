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
