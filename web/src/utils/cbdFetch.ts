/**
 * cbdFetch.ts — Server-side spatial filtering for CBD 311 data.
 *
 * Calculates the CBD bounding box from its GeoJSON boundary and passes
 * lat/lng bounds directly to the DataSF API query. No client-side
 * point-in-polygon filtering needed.
 */

import type { CBDConfig } from "../contexts/CBDContext";

const DATASF = "https://data.sfgov.org/resource";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CBD311Row {
  lat: number;
  lng: number;
  category: string;
  address: string;
  date: string;
  closedDate: string | null;
  month: string;
  status?: string;
  subtype?: string;
}

// ── Bounding box from GeoJSON ───────────────────────────────────────────────

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

// ── Fetch 311 data for a CBD ────────────────────────────────────────────────

export async function fetch311ForCBD(
  config: CBDConfig,
  opts: { days?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<CBD311Row[]> {
  const { days = 180, limit = 3000, signal } = opts;
  if (!config.boundary_geojson) return [];

  const bb = getBoundingBox(config.boundary_geojson);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const $where = [
    `lat>${bb.minLat}`,
    `lat<${bb.maxLat}`,
    `long>${bb.minLng}`,
    `long<${bb.maxLng}`,
    `requested_datetime>'${cutoffStr}'`,
  ].join(" AND ");

  const t0 = performance.now();
  const res = await fetch(
    `${DATASF}/vw6y-z8j6.json?${new URLSearchParams({
      $where,
      $select: "lat,long,service_name,service_subtype,address,requested_datetime,closed_datetime,status_description",
      $limit: String(limit),
      $order: "requested_datetime DESC",
    })}`,
    { signal },
  );

  if (!res.ok) throw new Error(`DataSF returned ${res.status}`);
  const raw: any[] = await res.json();

  const rows: CBD311Row[] = [];
  for (const r of raw) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.long);
    if (isNaN(lat) || isNaN(lng)) continue;
    const dt = r.requested_datetime ?? "";
    const cd = r.closed_datetime ?? null;
    rows.push({
      lat, lng,
      category: r.service_name ?? "",
      address: r.address ?? "",
      date: dt.split("T")[0],
      closedDate: cd ? cd.split("T")[0] : null,
      month: dt.slice(0, 7),
      status: r.status_description,
      subtype: r.service_subtype,
    });
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[fetch311ForCBD] ${config.name}: ${rows.length} rows in ${elapsed}s (${days}d, limit ${limit})`);
  return rows;
}
