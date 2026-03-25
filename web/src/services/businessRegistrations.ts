/**
 * services/businessRegistrations.ts — Spatial query for SF business registrations.
 *
 * Fetches active businesses from DataSF (g8m3-pdis) using Socrata's within_box
 * spatial filter, then clips to the exact CBD polygon via isPointInCBD().
 */

import type { CBDConfig } from '../contexts/CBDContext';
import { isPointInCBD, type CBDBoundaryEntry } from '../utils/geoFilter';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DowntownBusiness {
  id: string;
  name: string;
  address: string;
  category: string;
  openDate: string;
  closeDate: string | null;
  coordinates: { lat: number; lng: number } | null;
  status: 'active' | 'closed';
}

export interface MonthlyActivity {
  month: string;       // "Jan", "Feb", etc.
  monthKey: string;    // "2025-06" for sorting
  Openings: number;
  Closures: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DATASF = 'https://data.sfgov.org/resource';

function getBoundingBox(geojson: { coordinates: number[][][][] }) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const poly of geojson.coordinates)
    for (const ring of poly)
      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
  return { minLat, maxLat, minLng, maxLng };
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchBusinessRegistrations(
  config: CBDConfig,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<DowntownBusiness[]> {
  if (!config.boundary_geojson) return [];

  const { limit = 5000, signal } = opts;
  const bb = getBoundingBox(config.boundary_geojson);

  // Fetch active businesses + those closed in the last 13 months (for chart)
  const thirteenMonthsAgo = new Date();
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);
  const cutoffDate = thirteenMonthsAgo.toISOString().split('T')[0];

  const params = new URLSearchParams({
    $where: [
      `within_box(location,${bb.maxLat},${bb.minLng},${bb.minLat},${bb.maxLng})`,
      `administratively_closed IS NULL`,
      `location IS NOT NULL`,
      `city='San Francisco'`,
      `(dba_end_date IS NULL OR dba_end_date>'${cutoffDate}')`,
    ].join(' AND '),
    $select: 'uniqueid,dba_name,ownership_name,full_business_address,naic_code_description,dba_start_date,dba_end_date,location',
    $limit: String(limit),
    $order: 'dba_start_date DESC',
  });

  const t0 = performance.now();
  const res = await fetch(`${DATASF}/g8m3-pdis.json?${params}`, { signal });
  if (!res.ok) throw new Error(`DataSF business registrations returned ${res.status}`);
  const raw: any[] = await res.json();
  if (!Array.isArray(raw)) return [];

  // Build boundary entry for polygon clipping
  const boundary: CBDBoundaryEntry = {
    name: config.name,
    geometry: config.boundary_geojson as CBDBoundaryEntry['geometry'],
  };

  const businesses: DowntownBusiness[] = [];

  for (const r of raw) {
    const coords = r.location?.coordinates;
    if (!coords || coords.length < 2) continue;

    const lng = coords[0] as number;
    const lat = coords[1] as number;

    // Clip to exact CBD polygon
    if (!isPointInCBD(lat, lng, [boundary])) continue;

    const endDate = r.dba_end_date ? (r.dba_end_date as string).split('T')[0] : null;
    businesses.push({
      id: r.uniqueid ?? '',
      name: r.dba_name || r.ownership_name || 'Unknown',
      address: r.full_business_address ?? '',
      category: r.naic_code_description || 'Uncategorized',
      openDate: (r.dba_start_date ?? '').split('T')[0],
      closeDate: endDate,
      coordinates: { lat, lng },
      status: endDate ? 'closed' : 'active',
    });
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[businessRegistrations] ${config.name}: ${raw.length} raw → ${businesses.length} in polygon (${elapsed}s)`);
  return businesses;
}

// ── Trend ────────────────────────────────────────────────────────────────────

export function computeOpeningTrend(
  businesses: DowntownBusiness[],
): { days30: number; days60: number; days90: number } {
  const active = businesses.filter(b => b.status === 'active');
  const now = new Date();
  const cutoff = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };
  const c30 = cutoff(30);
  const c60 = cutoff(60);
  const c90 = cutoff(90);
  return {
    days30: active.filter(b => b.openDate >= c30).length,
    days60: active.filter(b => b.openDate >= c60).length,
    days90: active.filter(b => b.openDate >= c90).length,
  };
}

// ── Monthly activity (last 12 months) ────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeMonthlyActivity(businesses: DowntownBusiness[]): MonthlyActivity[] {
  const now = new Date();
  // Build 12-month bucket list
  const buckets: MonthlyActivity[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ month: SHORT_MONTHS[d.getMonth()], monthKey: key, Openings: 0, Closures: 0 });
  }
  const bucketMap = new Map(buckets.map(b => [b.monthKey, b]));

  for (const b of businesses) {
    if (b.openDate) {
      const key = b.openDate.slice(0, 7); // "YYYY-MM"
      const bucket = bucketMap.get(key);
      if (bucket) bucket.Openings++;
    }
    if (b.closeDate) {
      const key = b.closeDate.slice(0, 7);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.Closures++;
    }
  }

  return buckets;
}
