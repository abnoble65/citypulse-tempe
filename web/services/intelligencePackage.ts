/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DATASF_BASE = "https://data.sfgov.org/resource";
const PERMITS_DATASET = "i98e-djp9";
const ASSESSOR_DATASET = "wv5m-vpq2";
const EVICTIONS_DATASET = "5cei-gny5";
const AFFORDABLE_DATASET = "aaxw-2cb8";
const PIPELINE_DATASET = "6jgi-cpb4";

const CITYPULSE_BASE = "https://citypulse-bay.vercel.app";

const SUPERVISOR_NAMES: Record<string, string> = {
  "1": "Connie Chan",
  "2": "Catherine Stefani",
  "3": "Danny Sauter",
  "4": "Joel Engardio",
  "5": "Dean Preston",
  "6": "Matt Dorsey",
  "7": "Myrna Melgar",
  "8": "Rafael Mandelman",
  "9": "Hillary Ronen",
  "10": "Shamann Walton",
  "11": "Ahsha Safaí",
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Strip hyphens so APN matches the projects table format (e.g. "0263-011" → "0263011"). */
export function normalizeAPN(apn: string): string {
  return apn.replace(/-/g, "");
}

/** Format a raw 7-char blklot into hyphenated display form (e.g. "0263011" → "0263-011"). */
function formatAPN(raw: string): string {
  const block = raw.slice(0, 4);
  const lot = raw.slice(4);
  return `${block}-${lot}`;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DataSF ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

function sentimentLabel(score: number): string {
  if (score >= 0.7) return "SUPPORTIVE";
  if (score >= 0.5) return "NEUTRAL";
  if (score >= 0.3) return "MIXED";
  return "OPPOSED";
}

function permitSignal(permitsPerYear: number): string {
  if (permitsPerYear >= 11) return "HIGH";
  if (permitsPerYear >= 3) return "MODERATE";
  return "LOW";
}

function readinessLabel(score: number): string {
  if (score >= 80) return "PRIME";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "WATCH";
  return "NOT READY";
}

function evictionRiskLevel(filings: number): string {
  if (filings === 0) return "NONE";
  if (filings <= 2) return "LOW";
  if (filings <= 5) return "MODERATE";
  return "HIGH";
}

function overallSentimentLabel(score: number): string {
  if (score >= 0.65) return "POSITIVE";
  if (score >= 0.45) return "NEUTRAL";
  return "NEGATIVE";
}

// ---------------------------------------------------------------------------
// DataSF queries
// ---------------------------------------------------------------------------

interface SocrataPermit {
  permit_number?: string;
  permit_type_definition?: string;
  description?: string;
  filed_date?: string;
  status?: string;
  estimated_cost?: string;
  street_number?: string;
  street_name?: string;
  zipcode?: string;
  location?: { type: string; coordinates: [number, number] };
}

interface SocrataAssessor {
  parcel_number?: string;
  block?: string;
  lot?: string;
  blklot?: string;
  property_location?: string;
  use_definition?: string;
  year_property_built?: string;
  number_of_stories?: string;
  property_area?: string;
  lot_area?: string;
  zoning_code?: string;
  the_geom?: { type: string; coordinates: [number, number] };
  assessor_neighborhood?: string;
  supervisor_district?: string;
}

interface SocrataEviction {
  eviction_id?: string;
  address?: string;
  file_date?: string;
  constraints_date?: string;
  breach?: string;
  nuisance?: string;
  illegal_use?: string;
  failure_to_sign_renewal?: string;
  access_denial?: string;
  unapproved_subtenant?: string;
  owner_move_in?: string;
  demolition?: string;
  capital_improvement?: string;
  substantial_rehab?: string;
  ellis_act_withdrawal?: string;
  condo_conversion?: string;
  roommate_same_unit?: string;
  other_cause?: string;
  late_payments?: string;
  lead_remediation?: string;
  development?: string;
  good_samaritan_ends?: string;
}

async function fetchPermits(address: string) {
  const [num, ...rest] = address.split(" ");
  const street = rest.join(" ").replace(/ St$/i, "");
  const url =
    `${DATASF_BASE}/${PERMITS_DATASET}.json` +
    `?$where=street_number='${num}' AND street_name='${street}'` +
    `&$order=filed_date DESC&$limit=50000`;
  return fetchJSON<SocrataPermit[]>(url);
}

async function fetchAssessor(apn: string): Promise<SocrataAssessor | null> {
  const clean = normalizeAPN(apn);
  const url =
    `${DATASF_BASE}/${ASSESSOR_DATASET}.json` +
    `?$where=parcel_number='${clean}'&$order=closed_roll_year DESC&$limit=1`;
  const rows = await fetchJSON<SocrataAssessor[]>(url);
  return rows[0] ?? null;
}

async function fetchEvictions(address: string) {
  const encoded = encodeURIComponent(address.toUpperCase());
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const since = twoYearsAgo.toISOString().slice(0, 10);
  const url =
    `${DATASF_BASE}/${EVICTIONS_DATASET}.json` +
    `?$where=address like '%25${encoded}%25' AND file_date>='${since}'`;
  return fetchJSON<SocrataEviction[]>(url);
}

async function fetchAffordableHousing(address: string) {
  const encoded = encodeURIComponent(address.toUpperCase());
  const url =
    `${DATASF_BASE}/${AFFORDABLE_DATASET}.json` +
    `?$where=project_name like '%25${encoded}%25'&$limit=5`;
  return fetchJSON<Record<string, string>[]>(url);
}

async function fetchPipeline(address: string) {
  const encoded = encodeURIComponent(address.toUpperCase());
  const url =
    `${DATASF_BASE}/${PIPELINE_DATASET}.json` +
    `?$where=nameaddr like '%25${encoded}%25'&$limit=5`;
  return fetchJSON<Record<string, string>[]>(url);
}

// ---------------------------------------------------------------------------
// Supabase queries
// ---------------------------------------------------------------------------

async function fetchProject(apn: string) {
  const clean = normalizeAPN(apn);
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("parcel_apn", clean)
    .limit(1)
    .maybeSingle();
  return data;
}

async function fetchHearings(address: string) {
  const { data } = await supabase
    .from("hearings")
    .select("*")
    .ilike("address", `%${address}%`)
    .order("date", { ascending: false });
  return data ?? [];
}

async function fetchPublicSentiment(hearingIds: string[]) {
  if (hearingIds.length === 0) return [];
  const { data } = await supabase
    .from("public_sentiment")
    .select("*")
    .in("hearing_id", hearingIds);
  return data ?? [];
}

async function fetchCBDProfile(district: string) {
  const { data } = await supabase
    .from("cbd_profiles")
    .select("*")
    .eq("supervisor_district", district)
    .limit(1)
    .maybeSingle();
  return data;
}

async function fetchSignalCache(cacheKey: string) {
  const { data } = await supabase
    .from("signal_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .limit(1)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export interface IntelligencePackage {
  _schema: string;
  _generated: string;
  _source: string;
  _note_for_nextspace: string;
  parcel_identity: Record<string, unknown>;
  spatial: Record<string, unknown>;
  building_attributes: Record<string, unknown>;
  permit_intelligence: Record<string, unknown>;
  planning_commission_intelligence: Record<string, unknown>;
  development_readiness: Record<string, unknown>;
  eviction_signals: Record<string, unknown>;
  affordable_housing: Record<string, unknown>;
  public_sentiment: Record<string, unknown>;
  district_trend_signals: Record<string, unknown>;
  site_selection_ranking: Record<string, unknown>;
  citypulse_deeplink: Record<string, unknown>;
  nextspace_handoff: Record<string, unknown>;
}

export async function generateIntelligencePackage(
  apn: string,
): Promise<IntelligencePackage> {
  const cleanAPN = normalizeAPN(apn);
  const displayAPN = formatAPN(cleanAPN);

  // -----------------------------------------------------------------------
  // 1. Parallel data fetch
  // -----------------------------------------------------------------------
  const [project, assessor] = await Promise.all([
    fetchProject(apn),
    fetchAssessor(apn),
  ]);

  const address =
    project?.address ??
    assessor?.property_location?.replace(/^0+ |0+$/g, "").trim() ??
    "";

  const [permits, evictions, affordable, pipeline, hearings] =
    await Promise.all([
      fetchPermits(address),
      fetchEvictions(address),
      fetchAffordableHousing(address),
      fetchPipeline(address),
      fetchHearings(address),
    ]);

  const hearingIds = hearings
    .map((h: Record<string, unknown>) => h.id as string)
    .filter(Boolean);
  const sentimentRows = await fetchPublicSentiment(hearingIds);

  // Resolve CBD profile from supervisor district
  const supervisorDistrict =
    project?.district ??
    assessor?.supervisor_district ??
    "";
  const cbdProfile = await fetchCBDProfile(supervisorDistrict);
  const cbdSlug = cbdProfile?.slug ?? "downtown";
  const cbdName = cbdProfile?.name ?? "Downtown SF";

  // Signal cache — keyed by district
  const signalData = await fetchSignalCache(`D${supervisorDistrict}`);

  // -----------------------------------------------------------------------
  // 2. Permit intelligence
  // -----------------------------------------------------------------------
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const permitsLast12 = permits.filter(
    (p) => p.filed_date && new Date(p.filed_date) >= oneYearAgo,
  ).length;
  const permitsLast30 = permits.filter(
    (p) => p.filed_date && new Date(p.filed_date) >= thirtyDaysAgo,
  ).length;
  const openPermits = permits.filter((p) =>
    ["issued", "filed", "approved"].includes((p.status ?? "").toLowerCase()),
  ).length;
  const mostRecent = permits[0];

  // -----------------------------------------------------------------------
  // 3. Hearing intelligence
  // -----------------------------------------------------------------------
  const mostRecentHearing = hearings[0] as Record<string, unknown> | undefined;
  const votes = (mostRecentHearing?.votes ?? {}) as Record<string, number>;
  const voteStr =
    votes.aye != null ? `${votes.aye}-${votes.nay}` : null;
  const detail = (mostRecentHearing?.detail ?? {}) as Record<string, unknown>;
  const concerns = (detail.commissionerConcerns ?? []) as {
    name: string;
    concern: string;
  }[];

  // -----------------------------------------------------------------------
  // 4. Sentiment computation
  // -----------------------------------------------------------------------
  let sentimentScore = 0.5;
  const allThemes: string[] = [];
  if (sentimentRows.length > 0) {
    let totalFor = 0;
    let totalAgainst = 0;
    let totalNeutral = 0;
    for (const row of sentimentRows) {
      const r = row as Record<string, unknown>;
      totalFor += Number(r.for_project ?? r.forProject ?? 0);
      totalAgainst += Number(r.against_project ?? r.againstProject ?? 0);
      totalNeutral += Number(r.neutral ?? 0);
      const themes = (r.top_themes ?? r.topThemes ?? []) as string[];
      allThemes.push(...themes);
    }
    const total = totalFor + totalAgainst + totalNeutral;
    if (total > 0) {
      sentimentScore = (totalFor + totalNeutral * 0.5) / total;
    }
  }
  const uniqueThemes = [...new Set(allThemes)].slice(0, 5);
  const latestSentiment = sentimentRows[0] as Record<string, unknown> | undefined;

  // -----------------------------------------------------------------------
  // 5. Eviction signals
  // -----------------------------------------------------------------------
  const evictionTypes: string[] = [];
  for (const e of evictions) {
    if (e.ellis_act_withdrawal === "true") evictionTypes.push("Ellis Act");
    if (e.owner_move_in === "true") evictionTypes.push("Owner Move-In");
    if (e.demolition === "true") evictionTypes.push("Demolition");
    if (e.capital_improvement === "true") evictionTypes.push("Capital Improvement");
    if (e.nuisance === "true") evictionTypes.push("Nuisance");
    if (e.breach === "true") evictionTypes.push("Breach");
  }
  const uniqueEvictionTypes = [...new Set(evictionTypes)];

  // -----------------------------------------------------------------------
  // 6. Development readiness score
  // -----------------------------------------------------------------------
  const permitActivityScore = Math.min(
    100,
    Math.round((permitsLast12 / 15) * 100),
  );
  const hearingSentimentScore = Math.round(sentimentScore * 100);
  const evictionRisk = evictions.length > 0;
  const affordableConstraint = affordable.length > 0;
  // Zoning capacity and infrastructure remain stubbed
  const zoningCapacity = 85;
  const infrastructureFlag = false;

  const rawScore = Math.round(
    permitActivityScore * 0.3 +
      hearingSentimentScore * 0.25 +
      zoningCapacity * 0.2 +
      (evictionRisk ? 0 : 100) * 0.1 +
      (affordableConstraint ? 0 : 100) * 0.1 +
      (infrastructureFlag ? 0 : 100) * 0.05,
  );
  const devScore = Math.min(100, Math.max(0, rawScore));

  // -----------------------------------------------------------------------
  // 7. District trend signals (from signal_cache)
  // -----------------------------------------------------------------------
  const signals = (signalData?.signals ?? []) as Record<string, unknown>[];
  const trendSignal = signals[0] ?? {};

  // -----------------------------------------------------------------------
  // 8. Build centroid from best available source
  // -----------------------------------------------------------------------
  const lat =
    project?.parcel_centroid_lat ??
    project?.lat ??
    (assessor?.the_geom?.coordinates?.[1] ?? null);
  const lng =
    project?.parcel_centroid_lng ??
    project?.lng ??
    (assessor?.the_geom?.coordinates?.[0] ?? null);

  // -----------------------------------------------------------------------
  // 9. Assemble package
  // -----------------------------------------------------------------------
  const block = project?.block ?? assessor?.block ?? cleanAPN.slice(0, 4);
  const lot = project?.lot ?? assessor?.lot ?? cleanAPN.slice(4);

  const pkg: IntelligencePackage = {
    _schema: "CityPulse_Intelligence_Package_v1",
    _generated: new Date().toISOString(),
    _source: "CityPulse (citypulse-bay.vercel.app)",
    _note_for_nextspace:
      "This package is the proposed format for Nextspace ontology ingestion. " +
      "APN is the proposed primary join key to CC3D building entity.",

    parcel_identity: {
      apn: displayAPN,
      block,
      lot,
      address,
      city: "San Francisco",
      state: "CA",
      zip: assessor?.zoning_code
        ? undefined
        : undefined, // zip not in assessor blklot query — derive from permits
      cbd_slug: cbdSlug,
      cbd_name: cbdName,
      supervisor_district: `D${supervisorDistrict}`,
      supervisor_name:
        SUPERVISOR_NAMES[supervisorDistrict] ?? "Unknown",
    },

    spatial: {
      centroid: { lat, lng, crs: "WGS84" },
      parcel_geojson_url: `${CITYPULSE_BASE}/api/parcels/${displayAPN}/geometry`,
      cbd_boundary_geojson_url: `${CITYPULSE_BASE}/api/cbd/${cbdSlug}/boundary`,
    },

    building_attributes: {
      primary_use: assessor?.use_definition ?? project?.zoning ?? null,
      height_ft: null, // not in Assessor blklot query — needs building dataset
      floors_above_grade: assessor?.number_of_stories
        ? parseInt(assessor.number_of_stories, 10)
        : null,
      floors_below_grade: null, // GAP — no source
      year_built: assessor?.year_property_built
        ? parseInt(assessor.year_property_built, 10)
        : null,
      gross_sq_ft: assessor?.property_area
        ? parseInt(assessor.property_area, 10) || null
        : null,
      zoning_code: assessor?.zoning_code ?? project?.zoning ?? null,
      zoning_label: null, // would need zoning label lookup
    },

    permit_intelligence: {
      total_permits_on_record: permits.length,
      permits_last_12_months: permitsLast12,
      permits_last_30_days: permitsLast30,
      open_permits: openPermits,
      most_recent_permit: mostRecent
        ? {
            permit_number: mostRecent.permit_number ?? null,
            type: mostRecent.permit_type_definition ?? null,
            description: mostRecent.description ?? null,
            filed_date: mostRecent.filed_date?.slice(0, 10) ?? null,
            status: mostRecent.status ?? null,
            estimated_cost_usd: mostRecent.estimated_cost
              ? parseFloat(mostRecent.estimated_cost)
              : null,
            official_record_url: mostRecent.permit_number
              ? `https://dbiweb02.sfgov.org/dbipts/default.aspx?permit=${mostRecent.permit_number}`
              : null,
          }
        : null,
      permit_activity_signal: permitSignal(permitsLast12),
      _signal_legend:
        "LOW = 0-2 permits/yr | MODERATE = 3-10 | HIGH = 11+ | ACTIVE_DEVELOPMENT = major project filed",
    },

    planning_commission_intelligence: {
      total_hearings_referencing_parcel: hearings.length,
      most_recent_hearing: mostRecentHearing
        ? {
            hearing_date: mostRecentHearing.date ?? null,
            project_description:
              mostRecentHearing.desc ??
              project?.project_description ??
              null,
            outcome: mostRecentHearing.action ?? null,
            vote: voteStr,
            commissioner_dissent_summary:
              concerns.length > 0
                ? concerns.map((c) => c.concern).join("; ")
                : null,
          }
        : null,
      hearing_sentiment_score: Math.round(sentimentScore * 100) / 100,
      _sentiment_legend:
        "0.0 = fully opposed | 0.5 = neutral | 1.0 = full support",
      sentiment_label: sentimentLabel(sentimentScore),
      dominant_commissioner_concern:
        concerns.length > 0 ? concerns[0].concern : null,
    },

    development_readiness: {
      score: devScore,
      score_label: readinessLabel(devScore),
      _score_legend:
        "0-39 = NOT READY | 40-59 = WATCH | 60-79 = HIGH | 80-100 = PRIME",
      score_components: {
        permit_activity: permitActivityScore,
        hearing_sentiment: hearingSentimentScore,
        zoning_capacity_remaining: zoningCapacity,
        eviction_risk_flag: evictionRisk,
        affordable_housing_constraint: affordableConstraint,
        infrastructure_flag: infrastructureFlag,
      },
      readiness_summary: null, // AI-generated at serving time via callAI()
    },

    eviction_signals: {
      eviction_filings_last_24_months: evictions.length,
      eviction_type_flags: uniqueEvictionTypes,
      eviction_risk_level: evictionRiskLevel(evictions.length),
      _source: "DataSF Eviction Dataset",
    },

    affordable_housing: {
      inclusionary_units_on_site: affordable.reduce(
        (sum, r) => sum + (parseInt(r.inclusionary_units ?? "0", 10) || 0),
        0,
      ),
      bmr_units_on_site: affordable.reduce(
        (sum, r) => sum + (parseInt(r.bmr_units ?? "0", 10) || 0),
        0,
      ),
      housing_pipeline_flag: pipeline.length > 0,
    },

    public_sentiment: {
      overall_sentiment_label: overallSentimentLabel(sentimentScore),
      overall_sentiment_score: Math.round(sentimentScore * 100) / 100,
      primary_topics_mentioned: uniqueThemes,
      sentiment_source: latestSentiment
        ? `SFGovTV public meeting transcripts — AI analysis (${latestSentiment.source ?? "minutes_pdf"})`
        : "SFGovTV public meeting transcripts — AI analysis",
      last_updated: latestSentiment
        ? (latestSentiment.created_at as string)?.slice(0, 10) ?? null
        : null,
    },

    district_trend_signals: {
      district: cbdName,
      trend_label: (trendSignal.title as string) ?? null,
      trend_summary: (trendSignal.summary as string) ?? null,
      trend_direction: (trendSignal.direction as string) ?? null,
      trend_confidence: null, // GAP — not a distinct field in signal_cache
      ai_generated: true,
      last_refreshed: signalData?.generated_at?.slice(0, 10) ?? null,
    },

    site_selection_ranking: {
      rank_within_cbd: null, // requires cross-parcel computation
      rank_within_sf: null,
      rank_basis:
        "Composite score: permit activity + hearing sentiment + zoning capacity + transit proximity",
      transit_proximity: {
        nearest_bart: null, // GAP — no transit dataset
        walking_minutes: null,
        nearest_muni_line: null,
        walking_minutes_muni: null,
      },
      comparable_parcels_in_cbd: [], // requires cross-parcel computation
    },

    citypulse_deeplink: {
      civic_app_url: `${CITYPULSE_BASE}/districts/D${supervisorDistrict}`,
      cbd_portal_url: `${CITYPULSE_BASE}/cbd/${cbdSlug}`,
      permits_view_url: `${CITYPULSE_BASE}/cbd/${cbdSlug}/permits?apn=${displayAPN}`,
      site_selection_url: `${CITYPULSE_BASE}/cbd/${cbdSlug}/site-selection?apn=${displayAPN}`,
    },

    nextspace_handoff: {
      _purpose:
        "Placeholders for Nextspace to populate during integration design",
      nextspace_entity_id: "PENDING — to be confirmed by Nextspace/CC3D",
      nextspace_entity_type: "PENDING — e.g. Building | Parcel | Feature",
      nextspace_scene_url:
        "PENDING — deep-link URL format from Kevin Devito",
      suggested_layers_on_load: [
        "permits",
        "planning_hearings",
        "zoning_envelope",
        "flood_zone",
        "transit",
      ],
      suggested_ai_context_prompt: null, // AI-generated at serving time
      integration_method:
        "PENDING — deep-link | iframe | REST API | Supabase context store",
    },
  };

  // Back-fill zip from permit data if available
  if (mostRecent?.zipcode) {
    (pkg.parcel_identity as Record<string, unknown>).zip = mostRecent.zipcode;
  }

  return pkg;
}
