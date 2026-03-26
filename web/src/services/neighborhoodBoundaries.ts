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

// DataSF boundary fetches stubbed for Tempe fork — returns empty results.

export async function fetchDistrictBoundaries(
  _districtConfig?: DistrictConfig,
): Promise<Map<string, GeoFeature>> {
  return new Map();
}

export async function fetchSFSupervisorBoundary(
  _districtNumber?: string,
): Promise<GeoFeature | null> {
  return null;
}

export async function fetchAllSFDistrictBoundaries(): Promise<Map<string, GeoFeature>> {
  return new Map();
}
