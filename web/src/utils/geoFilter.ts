/**
 * geoFilter.ts — Polygon-based neighborhood filtering.
 *
 * Lazy-loads SF neighborhood boundary polygons from DataSF (jwn9-ihcz) once
 * per session, then provides synchronous point-in-polygon tests via ray casting.
 *
 * Usage:
 *   const boundaries = await loadNeighborhoodBoundaries();
 *   const inNeighborhood = isPointInNeighborhoodSync(37.797, -122.408, "North Beach", boundaries);
 */

// ── Types ──────────────────────────────────────────────────────────────────────

interface NHFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: { name: string };
}

export type BoundaryMap = Map<string, NHFeature>;

// ── Module-level singleton ────────────────────────────────────────────────────

const GEO_URL =
  "https://data.sfgov.org/resource/jwn9-ihcz.geojson?$limit=200";

let boundaryCache: BoundaryMap | null = null;
let loadPromise:  Promise<BoundaryMap> | null = null;

/**
 * Fetches neighborhood boundaries from DataSF and caches them for the session.
 * Safe to call multiple times — only one network request is ever made.
 */
export function loadNeighborhoodBoundaries(): Promise<BoundaryMap> {
  if (boundaryCache) return Promise.resolve(boundaryCache);
  if (loadPromise)   return loadPromise;

  loadPromise = fetch(GEO_URL)
    .then(r => r.json())
    .then((geojson: { features: NHFeature[] }) => {
      const map: BoundaryMap = new Map();
      for (const f of geojson.features ?? []) {
        if (f.properties?.name) map.set(f.properties.name, f);
      }
      boundaryCache = map;
      return map;
    })
    .catch(() => {
      loadPromise = null; // allow retry
      return new Map() as BoundaryMap;
    });

  return loadPromise;
}

/** Fire-and-forget preload — call early to avoid latency on first filter use. */
export function preloadNeighborhoodBoundaries(): void {
  loadNeighborhoodBoundaries().catch(() => {});
}

// ── Ray-casting algorithm ─────────────────────────────────────────────────────

/**
 * Even-odd ray-casting point-in-polygon test for a single ring.
 * Ring coordinates are [lng, lat] pairs (GeoJSON order).
 */
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]; // x=lng, y=lat
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(lat: number, lng: number, f: NHFeature): boolean {
  const { type, coordinates } = f.geometry;

  if (type === "Polygon") {
    const rings = coordinates as number[][][];
    if (!pointInRing(lat, lng, rings[0])) return false;
    for (let h = 1; h < rings.length; h++) {
      if (pointInRing(lat, lng, rings[h])) return false; // inside a hole
    }
    return true;
  }

  if (type === "MultiPolygon") {
    const polys = coordinates as number[][][][];
    for (const poly of polys) {
      if (!pointInRing(lat, lng, poly[0])) continue;
      let inHole = false;
      for (let h = 1; h < poly.length; h++) {
        if (pointInRing(lat, lng, poly[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }

  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronous point-in-polygon test against a pre-loaded BoundaryMap.
 *
 * @param lat          WGS-84 latitude
 * @param lng          WGS-84 longitude
 * @param geoName      Exact neighborhood name from the DataSF GeoJSON
 *                     (e.g. "North Beach", "South of Market")
 * @param boundaries   Map returned by loadNeighborhoodBoundaries()
 * @returns true if the point falls within the neighborhood polygon; false otherwise
 */
export function isPointInNeighborhoodSync(
  lat:        number,
  lng:        number,
  geoName:    string,
  boundaries: BoundaryMap,
): boolean {
  const feature = boundaries.get(geoName);
  return feature ? pointInFeature(lat, lng, feature) : false;
}

// ── CBD point-in-polygon ──────────────────────────────────────────────────

export interface CBDBoundaryEntry {
  name: string;
  geometry: {
    type: string;
    coordinates: number[][][][] | number[][][];
  };
}

/**
 * Returns the name of the CBD that contains the given point, or null.
 * Reuses the same ray-casting logic as neighborhood tests.
 */
export function isPointInCBD(
  lat: number,
  lng: number,
  cbdBoundaries: CBDBoundaryEntry[],
): string | null {
  for (const cbd of cbdBoundaries) {
    const feature: NHFeature = {
      type: "Feature",
      geometry: cbd.geometry as NHFeature["geometry"],
      properties: { name: cbd.name },
    };
    if (pointInFeature(lat, lng, feature)) return cbd.name;
  }
  return null;
}
