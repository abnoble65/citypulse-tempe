/**
 * cbdFetch.ts — Server-side spatial filtering for CBD data.
 *
 * Calculates the CBD bounding box from its GeoJSON boundary and passes
 * lat/lng bounds directly to the DataSF API query. No client-side
 * point-in-polygon filtering needed.
 */

import type { CBDConfig } from "../contexts/CBDContext";

const DATASF = "https://data.sfgov.org/resource";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CBDPermitRow {
  lat: number;
  lng: number;
  permitNumber: string;
  type: string;
  description: string;
  status: string;
  cost: number;
  revisedCost: number;
  address: string;
  filedDate: string;
  issuedDate: string;
  completedDate: string;
  neighborhood: string;
  existingUse: string;
  proposedUse: string;
  month: string;
  block: string;
  lot: string;
}

export interface CBDBusinessRow {
  name: string;
  dba: string;
  address: string;
  zip: string;
  startDate: string;
  endDate: string | null;
  month: string;
}

export interface CBD311Row {
  lat: number;
  lng: number;
  serviceRequestId: string;
  category: string;
  address: string;
  neighborhood?: string;
  date: string;
  updatedDate: string;
  closedDate: string | null;
  month: string;
  status?: string;
  subtype?: string;
  serviceDetails?: string;
  agencyResponsible?: string;
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
  const { days = 90, limit = 3000, signal } = opts;
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

  const params = new URLSearchParams({
    $where,
    $select: "service_request_id,lat,long,service_name,service_subtype,service_details,address,neighborhoods_sffind_boundaries,requested_datetime,updated_datetime,closed_date,status_description,agency_responsible",
    $limit: String(limit),
    $order: "requested_datetime DESC",
  });
  const url = `${DATASF}/vw6y-z8j6.json?${params}`;
  console.log("[fetch311ForCBD] URL:", url);

  const t0 = performance.now();
  const res = await fetch(url, { signal });

  if (!res.ok) throw new Error(`DataSF returned ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) { console.error("[fetch311ForCBD] unexpected response", data); return []; }
  const raw: any[] = data;

  const rows: CBD311Row[] = [];
  for (const r of raw) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.long);
    if (isNaN(lat) || isNaN(lng)) continue;
    const dt = r.requested_datetime ?? "";
    const ud = r.updated_datetime ?? "";
    const cd = r.closed_date ?? null;
    rows.push({
      lat, lng,
      serviceRequestId: r.service_request_id ?? "",
      category: r.service_name ?? "",
      address: r.address ?? "",
      neighborhood: r.neighborhoods_sffind_boundaries ?? undefined,
      date: dt.split("T")[0],
      updatedDate: ud ? ud.split("T")[0] : "",
      closedDate: cd ? cd.split("T")[0] : null,
      month: dt.slice(0, 7),
      status: r.status_description,
      subtype: r.service_subtype,
      serviceDetails: r.service_details ?? undefined,
      agencyResponsible: r.agency_responsible ?? undefined,
    });
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[fetch311ForCBD] ${config.name}: ${rows.length} rows in ${elapsed}s (${days}d, limit ${limit})`);
  return rows;
}

// ── Fetch permits for a CBD ─────────────────────────────────────────────

export async function fetchPermitsForCBD(
  config: CBDConfig,
  opts: { days?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<CBDPermitRow[]> {
  const { days = 365, limit = 2000, signal } = opts;
  if (!config.boundary_geojson) return [];

  const bb = getBoundingBox(config.boundary_geojson);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const $where = [
    `within_box(location, ${bb.maxLat}, ${bb.minLng}, ${bb.minLat}, ${bb.maxLng})`,
    `filed_date>'${cutoffStr}'`,
    `location IS NOT NULL`,
  ].join(" AND ");

  const params = new URLSearchParams({
    $where,
    $select: "permit_number,permit_type_definition,description,status,estimated_cost,revised_cost,street_number,street_name,street_suffix,filed_date,issued_date,completed_date,neighborhoods_analysis_boundaries,existing_use,proposed_use,location,block,lot",
    $limit: String(limit),
    $order: "filed_date DESC",
  });
  const url = `${DATASF}/i98e-djp9.json?${params}`;
  console.log("[fetchPermitsForCBD] URL:", url);

  const t0 = performance.now();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`DataSF permits returned ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) { console.error("[fetchPermitsForCBD] unexpected response", data); return []; }
  const raw: any[] = data;

  const rows: CBDPermitRow[] = [];
  for (const r of raw) {
    const coords = r.location?.coordinates;
    if (!coords) continue;
    const lat = coords[1], lng = coords[0];
    if (isNaN(lat) || isNaN(lng)) continue;
    const dt = r.filed_date ?? "";
    const id = r.issued_date ?? "";
    const cd = r.completed_date ?? "";
    rows.push({
      lat, lng,
      permitNumber: r.permit_number ?? "",
      type: r.permit_type_definition ?? "",
      description: r.description ?? "",
      status: r.status ?? "",
      cost: parseFloat(r.estimated_cost) || 0,
      revisedCost: parseFloat(r.revised_cost) || 0,
      address: [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" "),
      filedDate: dt.split("T")[0],
      issuedDate: id ? id.split("T")[0] : "",
      completedDate: cd ? cd.split("T")[0] : "",
      neighborhood: r.neighborhoods_analysis_boundaries ?? "",
      existingUse: r.existing_use ?? "",
      proposedUse: r.proposed_use ?? "",
      month: dt.slice(0, 7),
      block: r.block ?? "",
      lot: r.lot ?? "",
    });
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[fetchPermitsForCBD] ${config.name}: ${rows.length} rows in ${elapsed}s`);
  return rows;
}

// ── Fetch businesses for a CBD ──────────────────────────────────────────
// Business dataset (g8m3-pdis) has no lat/lng — filter by address matching
// the CBD's known streets from its permit data, or by zip code proximity.

export async function fetchBusinessesForCBD(
  config: CBDConfig,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<CBDBusinessRow[]> {
  const { limit = 3000, signal } = opts;

  // First, find zip codes within the CBD by querying permits in the bounding box
  if (!config.boundary_geojson) return [];
  const bb = getBoundingBox(config.boundary_geojson);

  // Get distinct zips from permits in the CBD area
  const zipParams = new URLSearchParams({
    $select: "zipcode,count(*) as cnt",
    $where: `within_box(location, ${bb.maxLat}, ${bb.minLng}, ${bb.minLat}, ${bb.maxLng}) AND zipcode IS NOT NULL`,
    $group: "zipcode",
    $order: "cnt DESC",
    $limit: "10",
  });
  const zipRes = await fetch(`${DATASF}/i98e-djp9.json?${zipParams}`, { signal });
  if (!zipRes.ok) throw new Error(`DataSF zip lookup returned ${zipRes.status}`);
  const zipData: any[] = await zipRes.json();
  const zips = zipData.map((z: any) => z.zipcode).filter(Boolean);

  if (zips.length === 0) return [];

  const t0 = performance.now();
  const zipFilter = zips.map(z => `business_zip='${z}'`).join(" OR ");
  const params = new URLSearchParams({
    $where: `city='San Francisco' AND dba_start_date IS NOT NULL AND (${zipFilter})`,
    $select: "ownership_name,dba_name,full_business_address,business_zip,dba_start_date,dba_end_date,location_start_date,location_end_date",
    $limit: String(limit),
    $order: "dba_start_date DESC",
  });
  const url = `${DATASF}/g8m3-pdis.json?${params}`;
  console.log("[fetchBusinessesForCBD] URL:", url);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`DataSF businesses returned ${res.status}`);
  const raw: any[] = await res.json();

  const rows: CBDBusinessRow[] = [];
  for (const r of raw) {
    const dt = r.dba_start_date ?? r.location_start_date ?? "";
    const endDt = r.dba_end_date ?? r.location_end_date ?? null;
    rows.push({
      name: r.ownership_name ?? "",
      dba: r.dba_name ?? "",
      address: r.full_business_address ?? "",
      zip: r.business_zip ?? "",
      startDate: dt.split("T")[0],
      endDate: endDt ? endDt.split("T")[0] : null,
      month: dt.slice(0, 7),
    });
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[fetchBusinessesForCBD] ${config.name}: ${rows.length} rows in ${elapsed}s`);
  return rows;
}
