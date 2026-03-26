/**
 * geocoder.ts — SF address geocoding via ArcGIS World Geocoding Service.
 *
 * Free tier, no API key required. All requests fire in parallel so geocoding
 * 50 addresses takes ~1–2s total. Results are cached in sessionStorage so
 * re-navigation within a session is instant.
 */

const CACHE_KEY = 'cp_geocache_v1';
const ARCGIS_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

export interface LatLng { lat: number; lng: number; }

function loadCache(): Record<string, LatLng> {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveCache(cache: Record<string, LatLng>): void {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  catch { /* storage full — silently accept the loss */ }
}

async function geocodeOne(address: string): Promise<LatLng | null> {
  try {
    const params = new URLSearchParams({
      SingleLine: `${address}, Tempe, AZ`,
      f: 'json',
      maxLocations: '1',
      outFields: '',
    });
    const res = await fetch(`${ARCGIS_URL}?${params}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      candidates?: Array<{ location: { x: number; y: number }; score: number }>;
    };
    const c = data.candidates?.[0];
    // Score < 70 means uncertain match — skip rather than misplace a marker
    if (!c || c.score < 70) return null;
    return { lat: c.location.y, lng: c.location.x };
  } catch {
    return null;
  }
}

/**
 * Geocode a list of SF addresses. Returns a Map<address, LatLng>.
 *
 * - All requests fire in parallel (no documented rate limit for free tier).
 * - Cache-first: only addresses absent from sessionStorage are fetched.
 * - Addresses that fail or score < 70 are silently omitted.
 */
export async function geocodeAddresses(addresses: string[]): Promise<Map<string, LatLng>> {
  const cache = loadCache();
  const result = new Map<string, LatLng>();
  const toFetch: string[] = [];

  for (const addr of addresses) {
    if (cache[addr]) {
      result.set(addr, cache[addr]);
    } else {
      toFetch.push(addr);
    }
  }

  if (toFetch.length === 0) return result;

  const settled = await Promise.allSettled(
    toFetch.map(addr => geocodeOne(addr).then(ll => ({ addr, ll }))),
  );

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.ll) {
      result.set(r.value.addr, r.value.ll);
      cache[r.value.addr] = r.value.ll;
    }
  }

  saveCache(cache);
  return result;
}
