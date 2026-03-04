/**
 * parcelLookup.ts — Client-side parcel lookup via DataSF Parcels API (acdm-wktn).
 *
 * Two entry points:
 *   lookupByAPN(apn)         → ParcelInfo | null
 *   lookupByAddress(address) → ParcelInfo | null  (geocodes first, then intersects)
 *
 * Results are cached in sessionStorage for the page session.
 * Used by Map, Commission, and future CC3D deep-link.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParcelInfo {
  apn:   string;
  block: string;
  lot:   string;
  lat:   number;
  lng:   number;
  zoning: string | null;  // planning_district from DataSF
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PARCEL_API  = 'https://data.sfgov.org/resource/acdm-wktn.json';
const GEOCODE_API = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const CACHE_KEY   = 'cp_parcel_cache_v1';

// ── Cache ─────────────────────────────────────────────────────────────────────

function loadCache(): Record<string, ParcelInfo> {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveCache(cache: Record<string, ParcelInfo>): void {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  catch { /* storage full — silently accept */ }
}

// ── Lookup by APN (blklot) ────────────────────────────────────────────────────

export async function lookupByAPN(apn: string): Promise<ParcelInfo | null> {
  if (!apn) return null;

  const cache = loadCache();
  const cacheKey = `apn:${apn}`;
  if (cache[cacheKey]) return cache[cacheKey];

  try {
    const params = new URLSearchParams({
      '$where':  `blklot='${apn}'`,
      '$select': 'blklot,block_num,lot_num,centroid_latitude,centroid_longitude,planning_district',
      '$limit':  '1',
    });

    const res = await fetch(`${PARCEL_API}?${params}`);
    if (!res.ok) return null;

    const rows = await res.json() as Array<{
      blklot: string;
      block_num: string;
      lot_num: string;
      centroid_latitude: string;
      centroid_longitude: string;
      planning_district?: string;
    }>;

    const row = rows[0];
    if (!row) return null;

    const info: ParcelInfo = {
      apn:    row.blklot,
      block:  row.block_num,
      lot:    row.lot_num,
      lat:    parseFloat(row.centroid_latitude),
      lng:    parseFloat(row.centroid_longitude),
      zoning: row.planning_district ?? null,
    };

    cache[cacheKey] = info;
    saveCache(cache);
    return info;
  } catch {
    return null;
  }
}

// ── Lookup by address (geocode → point-in-parcel) ─────────────────────────────

export async function lookupByAddress(address: string): Promise<ParcelInfo | null> {
  if (!address || address.length < 4) return null;

  const cache = loadCache();
  const cacheKey = `addr:${address.toLowerCase().trim()}`;
  if (cache[cacheKey]) return cache[cacheKey];

  try {
    // Step 1: Geocode the address to lat/lng
    const geoParams = new URLSearchParams({
      SingleLine:   `${address}, San Francisco, CA`,
      f:            'json',
      maxLocations: '1',
    });

    const geoRes = await fetch(`${GEOCODE_API}?${geoParams}`);
    if (!geoRes.ok) return null;

    const geoData = await geoRes.json() as {
      candidates?: Array<{ location: { x: number; y: number } }>;
    };

    const candidate = geoData.candidates?.[0];
    if (!candidate) return null;

    const lng = candidate.location.x;
    const lat = candidate.location.y;

    // Step 2: Find the parcel that contains this point
    const wkt = `POINT (${lng} ${lat})`;
    const parcelParams = new URLSearchParams({
      '$where':  `intersects(shape, '${wkt}')`,
      '$select': 'blklot,block_num,lot_num,centroid_latitude,centroid_longitude,planning_district',
      '$limit':  '1',
    });

    const parcelRes = await fetch(`${PARCEL_API}?${parcelParams}`);
    if (!parcelRes.ok) return null;

    const rows = await parcelRes.json() as Array<{
      blklot: string;
      block_num: string;
      lot_num: string;
      centroid_latitude: string;
      centroid_longitude: string;
      planning_district?: string;
    }>;

    const row = rows[0];
    if (!row) return null;

    const info: ParcelInfo = {
      apn:    row.blklot,
      block:  row.block_num,
      lot:    row.lot_num,
      lat:    parseFloat(row.centroid_latitude),
      lng:    parseFloat(row.centroid_longitude),
      zoning: row.planning_district ?? null,
    };

    cache[cacheKey] = info;
    saveCache(cache);
    return info;
  } catch {
    return null;
  }
}
