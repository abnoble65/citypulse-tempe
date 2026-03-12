// web/api/nextspace-package.ts
// Vercel serverless function
// GET /api/nextspace-package?apn=0263011
// GET /api/nextspace-package?address=101+California+St
// GET /api/nextspace-package?building_id=CC3D-SF-0002451
//
// This is a PULL endpoint — Nextspace calls this to retrieve
// CityPulse building intelligence on demand.
// No push credentials needed. Kevin's team integrates at their pace.
//
// Auth: Bearer token via NEXTSPACE_API_KEY env var.
// If the env var is not set, the endpoint is open (dev mode).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeAPN(raw: string): string {
  return raw.replace(/-/g, "").trim();
}

function formatAPN(apn: string): string {
  const n = normalizeAPN(apn);
  if (n.length === 7) return `${n.slice(0, 4)}-${n.slice(4)}`;
  return n;
}

function setCORSHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function checkAuth(req: VercelRequest): boolean {
  const apiKey = process.env.NEXTSPACE_API_KEY;
  if (!apiKey) return true;
  const auth = req.headers["authorization"] ?? "";
  return auth === `Bearer ${apiKey}`;
}

async function fetchAssessorData(apn: string) {
  try {
    const url = `https://data.sfgov.org/resource/wv5m-vpq2.json?$where=parcel_number='${apn}'&$limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch { return null; }
}

async function fetchPermitCount(apn: string) {
  try {
    const url = `https://data.sfgov.org/resource/i98e-djp9.json?$select=count(*)&$where=parcel_number='${apn}'`;
    const res = await fetch(url);
    const data = await res.json();
    return parseInt(data?.[0]?.count ?? "0", 10);
  } catch { return 0; }
}

async function fetchParcelFromDB(apn: string) {
  const { data } = await supabase
    .from("projects")
    .select("address, district, lat, lng, parcel_centroid_lat, parcel_centroid_lng, zoning, parcel_apn, block, lot")
    .eq("parcel_apn", apn)
    .limit(1)
    .single();
  return data;
}

async function fetchCBDProfile(apn: string) {
  const { data: project } = await supabase
    .from("projects")
    .select("district")
    .eq("parcel_apn", apn)
    .limit(1)
    .single();
  if (!project?.district) return null;
  const { data: cbd } = await supabase
    .from("cbd_profiles")
    .select("name, slug, accent_color")
    .eq("supervisor_district", project.district)
    .limit(1)
    .single();
  return cbd;
}

async function fetchHearingCount(apn: string) {
  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("parcel_apn", apn);
  return count ?? 0;
}

async function fetchSignals(cbdSlug: string) {
  if (!cbdSlug) return null;
  const { data } = await supabase
    .from("signal_cache")
    .select("signals, generated_at")
    .eq("cache_key", `signals_${cbdSlug}`)
    .single();
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORSHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed. Use GET." });
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized." });

  const { apn, address, building_id } = req.query as Record<string, string>;

  if (!apn && !address && !building_id) {
    return res.status(400).json({
      error: "Provide one of: apn, address, or building_id",
      examples: {
        by_apn: "/api/nextspace-package?apn=0263011",
        by_address: "/api/nextspace-package?address=101+California+St",
      },
    });
  }

  let resolvedAPN: string | null = null;

  if (apn) {
    resolvedAPN = normalizeAPN(apn);
  } else if (building_id) {
    return res.status(501).json({
      error: "building_id lookup not yet implemented. Use apn for now.",
      note: "Building ID crosswalk is Phase 2 — pending CC3D data from Kevin Devito.",
    });
  } else if (address) {
    try {
      const encoded = encodeURIComponent(address);
      const geoRes = await fetch(
        `https://data.sfgov.org/resource/wv5m-vpq2.json?$where=upper(address)=upper('${encoded}')&$limit=1`
      );
      const geoData = await geoRes.json();
      if (Array.isArray(geoData) && geoData.length > 0) {
        resolvedAPN = normalizeAPN(geoData[0].parcel_number ?? "");
      }
    } catch { /* fall through */ }
    if (!resolvedAPN) {
      return res.status(404).json({ error: `Could not resolve APN from address: ${address}` });
    }
  }

  if (!resolvedAPN) return res.status(400).json({ error: "Could not resolve a valid APN." });

  const [parcelDB, assessor, permitCount, hearingCount] = await Promise.all([
    fetchParcelFromDB(resolvedAPN),
    fetchAssessorData(resolvedAPN),
    fetchPermitCount(resolvedAPN),
    fetchHearingCount(resolvedAPN),
  ]);

  const cbd = await fetchCBDProfile(resolvedAPN);
  const signals = cbd?.slug ? await fetchSignals(cbd.slug) : null;

  const lat = parcelDB?.parcel_centroid_lat ?? assessor?.latitude ?? null;
  const lng = parcelDB?.parcel_centroid_lng ?? assessor?.longitude ?? null;
  const addressResolved = parcelDB?.address ?? address ?? null;

  const permitSignal =
    permitCount === 0 ? "LOW"
    : permitCount <= 10 ? "MODERATE"
    : permitCount <= 30 ? "HIGH"
    : "ACTIVE_DEVELOPMENT";

  const readinessScore = Math.min(100,
    (permitCount > 0 ? 20 : 0) +
    (hearingCount > 0 ? 15 : 0) +
    (assessor?.yrbuilt ? (new Date().getFullYear() - parseInt(assessor.yrbuilt) > 40 ? 25 : 10) : 0) +
    35
  );

  const now = new Date().toISOString();

  const pkg = {
    schema: "CityPulse_Nextspace_Package_v1",
    generated_at: now,
    ttl_seconds: 3600,
    source: "CityPulse API (citypulse-bay.vercel.app)",
    identity: {
      apn: formatAPN(resolvedAPN),
      apn_normalised: resolvedAPN,
      building_id: null,
      entity_id: null,
      address: addressResolved,
      city: "San Francisco",
      state: "CA",
      jurisdiction: "San Francisco County",
    },
    spatial: {
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      crs: "WGS84",
      parcel_geojson_url: `https://citypulse-bay.vercel.app/api/parcels/${formatAPN(resolvedAPN)}/geometry`,
      cbd_boundary_url: cbd?.slug ? `https://citypulse-bay.vercel.app/api/cbd/${cbd.slug}/boundary` : null,
    },
    building_attributes: {
      building_id: null,
      parcel_apn: formatAPN(resolvedAPN),
      address_full: addressResolved,
      city_jurisdiction: "San Francisco",
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
      year_built: assessor?.yrbuilt ? parseInt(assessor.yrbuilt) : null,
      gross_floor_area_sqft: assessor?.sqft ? parseFloat(assessor.sqft) : null,
      building_height_ft: null,
      stories: assessor?.storeyno ? parseInt(assessor.storeyno) : null,
      footprint_area_sqft: null,
      building_type: assessor?.usecode ?? null,
      primary_land_use: assessor?.uselabel ?? null,
      secondary_land_use: null,
      zoning_code: parcelDB?.zoning ?? null,
      occupancy_status: "unknown",
      physical_condition_rating: "unknown",
      last_major_renovation_year: null,
      permit_activity_status: permitSignal.toLowerCase(),
      flood_risk_level: "unknown",
      heat_risk_level: "unknown",
      seismic_risk_level: "moderate",
      energy_use_intensity_kbtu_sqft: null,
      emissions_intensity_kgco2e_sqft: null,
      solar_potential_score: null,
      benchmarking_status: "unknown",
      assessed_value_usd: assessor?.netav ? parseFloat(assessor.netav) : null,
      market_estimate_usd: null,
      development_opportunity_score: readinessScore,
      city_priority_tags: signals?.signals?.top_signals?.slice(0, 3) ?? [],
    },
    intelligence: {
      readiness_score: readinessScore,
      readiness_label: readinessScore >= 80 ? "PRIME" : readinessScore >= 60 ? "HIGH" : readinessScore >= 40 ? "WATCH" : "NOT_READY",
      risk_score: null,
      permit_activity_signal: permitSignal,
      total_permits: permitCount,
      total_hearings: hearingCount,
      district: parcelDB?.district ?? null,
      cbd_name: cbd?.name ?? null,
    },
    provenance: {
      citypulse_version: "4.0",
      data_sources: [
        "Supabase (projects, hearings, cbd_profiles)",
        "DataSF Assessor API (wv5m-vpq2)",
        "DataSF Permits API (i98e-djp9)",
      ],
      next_refresh_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      pending_fields: [
        "building_id — awaiting CC3D crosswalk",
        "entity_id — awaiting Nextspace scene credentials",
        "building_height_ft — awaiting CC3D geometry",
        "flood_risk_level — awaiting Nextspace spatial layer",
      ],
    },
  };

  supabase
    .from("nextspace_context_queue")
    .insert({
      apn: resolvedAPN,
      address: addressResolved,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      triggered_from: "nextspace_pull",
      status: "delivered",
      delivered_at: now,
    })
    .then(() => {})
    .catch(() => {});

  return res.status(200).json(pkg);
}
