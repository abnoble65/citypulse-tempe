/**
 * services/aggregator.ts — CityPulse web
 *
 * Fetches all three DataSF datasets in parallel and returns a single
 * structured summary object for the requested supervisor district.
 */

import {
  fetchBuildingPermits,
  fetchDevelopmentPipeline,
  fetchZoningDistricts,
  fetchEvictions,
  fetchAssessmentStats,
  fetchTopAssessedProperties,
  fetchAffordableHousingPipeline,
  type BuildingPermit,
  type DevelopmentProject,
  type ZoningDistrict,
  type EvictionNotice,
  type AssessmentAggrRow,
  type AssessmentParcel,
  type AffordableHousingProject,
} from './dataSF';
import { DISTRICTS } from '../districts';
import type { DistrictConfig } from '../districts';

// ── Session-level DataSF cache ────────────────────────────────────────────────
// Re-fetching 7 datasets on every filter change is wasteful. Cache per district
// for 5 minutes — DataSF data doesn't change meaningfully within a session.
const CACHE_TTL_MS = 5 * 60 * 1000;
interface DistrictCacheEntry { data: DistrictData; ts: number }
const districtCache = new Map<string, DistrictCacheEntry>();

// Wraps a promise with performance.now() logging
function timed<T>(label: string, p: Promise<T>): Promise<T> {
  const t0 = performance.now();
  return p.then(
    v  => { console.log(`[datasf] ${label}: ${(performance.now() - t0).toFixed(0)}ms`); return v; },
    e  => { console.warn(`[datasf] ${label}: FAILED ${(performance.now() - t0).toFixed(0)}ms`); return Promise.reject(e); },
  );
}

export interface NotablePermit {
  permit_number: string;
  address: string;
  description: string;
  estimated_cost_usd: number;
  status: string;
}

/** Lightweight permit record used exclusively for map rendering. */
export interface MapPermit {
  permit_number: string;
  address: string;
  permit_type_definition: string;
  status: string;
  filed_date: string;
  lat: number;
  lng: number;
  zipcode?: string;
}

export interface ZipPermitSummary {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  cost_by_type: Record<string, number>;
  total_estimated_cost_usd: number;
}

export interface PermitSummary extends ZipPermitSummary {
  notable_permits: NotablePermit[];
  by_zip: Record<string, ZipPermitSummary>;
}

export interface PipelineSummary {
  total: number;
  net_pipeline_units: number;
  by_status: Record<string, number>;
  total_affordable_units: number;
}

export interface ZoningProfile {
  unique_zoning_codes: string[];
  special_use_districts: string[];
  height_range: string | null;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface EvictionMonthly {
  month: string;  // "YYYY-MM"
  count: number;
}

export interface EvictionSummary {
  total: number;
  by_type: Record<string, number>;         // e.g. { "Nuisance": 45, "Non-Payment": 38 }
  by_month: EvictionMonthly[];             // last 24 months, zero-filled
  by_neighborhood: Record<string, number>; // neighborhood name → count
}

export interface AssessmentUseGroup {
  use_code: string;           // e.g. "RES", "COMM", "MISC"
  avg_land_usd: number;
  avg_improvement_usd: number;
  total_assessed_usd: number;
  count: number;
}

export interface AssessmentYearSummary {
  year: string;               // "2023" or "2024"
  use_groups: AssessmentUseGroup[];
  total_land_usd: number;
  total_improvement_usd: number;
  total_assessed_usd: number;
}

export interface TopAssessedProperty {
  address: string;
  parcel_number: string;
  use_code: string;
  total_assessed_usd: number;
  neighborhood: string;
}

export interface AssessmentSummary {
  years: AssessmentYearSummary[];   // usually 2 entries (older + newer roll year)
  yoy_change_pct: number | null;    // null if insufficient data
  top_properties: TopAssessedProperty[];
}

export interface AmiDistribution {
  deep_affordable: number;  // ≤50% AMI: units targeted to lowest-income households
  low_income: number;       // 51–80% AMI
  moderate: number;         // 81–120% AMI
  workforce: number;        // >120% AMI (up to 150%)
  undeclared: number;
}

export interface AffordableHousingPipelineProject {
  project_id: string;
  name: string;
  address: string;
  neighborhood: string;
  status: string;
  total_units: number;
  affordable_units: number;
  affordable_pct: number;
  tenure: string;             // "Rental" | "Ownership"
  estimated_completion: string | null;
}

export interface AffordableHousingSummary {
  total_projects: number;
  total_pipeline_units: number;
  total_affordable_units: number;
  total_market_rate_units: number;
  affordable_ratio: number;                   // 0–1 fraction
  by_status: Record<string, number>;          // status label → project count
  by_status_units: Record<string, number>;    // status label → affordable unit count
  ami_distribution: AmiDistribution;
  projects: AffordableHousingPipelineProject[];
}

/** Per-district high-level summary for citywide AI prompts (~200 bytes/district, ~2KB total). */
export interface CitywideDistrictSummary {
  district_number: string;
  district_name: string;
  total_permits: number;
  top_permit_types: Array<{ type: string; count: number }>;
  total_evictions: number;
  top_eviction_type: string | null;
  assessed_value_yoy_pct: number | null;
  total_affordable_units: number;
  affordable_ratio: number;
}

export interface DistrictData {
  permit_summary: PermitSummary;
  pipeline_summary: PipelineSummary;
  zoning_profile: ZoningProfile;
  date_range: DateRange;
  eviction_summary: EvictionSummary;
  assessment_summary: AssessmentSummary;
  affordable_housing_summary: AffordableHousingSummary;
  /** Up to 200 geocoded permits for map rendering. Excluded from AI prompts. */
  map_permits: MapPermit[];
  /** Only populated in citywide (number="0") mode. Keys are district numbers "1"–"11". */
  by_district?: Record<string, DistrictData>;
  /** Compact per-district summary for citywide AI prompts. Avoids sending 300KB+ to Claude. */
  citywide_prompt_summary?: CitywideDistrictSummary[];
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}

function parseCost(value: string | undefined): number {
  const n = parseFloat(value ?? '');
  return isNaN(n) ? 0 : n;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildZipSummary(permits: BuildingPermit[]): ZipPermitSummary {
  const by_type = countBy(permits, (p) => p.permit_type_definition ?? p.permit_type);
  const by_status = countBy(permits, (p) => p.status);
  const cost_by_type: Record<string, number> = {};
  let total_estimated_cost_usd = 0;
  for (const p of permits) {
    const cost = parseCost(p.revised_cost ?? p.estimated_cost);
    const type = p.permit_type_definition ?? p.permit_type;
    cost_by_type[type] = (cost_by_type[type] ?? 0) + cost;
    total_estimated_cost_usd += cost;
  }
  return { total: permits.length, by_type, by_status, cost_by_type, total_estimated_cost_usd };
}

function buildPermitSummary(permits: BuildingPermit[]): PermitSummary {
  const base = buildZipSummary(permits);

  const notable_permits: NotablePermit[] = permits
    .filter((p) => parseCost(p.revised_cost ?? p.estimated_cost) > 1_000_000)
    .map((p) => ({
      permit_number: p.permit_number,
      address: [p.street_number, p.street_name, p.street_suffix].filter(Boolean).join(' '),
      description: p.description,
      estimated_cost_usd: parseCost(p.revised_cost ?? p.estimated_cost),
      status: p.status,
    }));

  // Bucket permits by zip code for client-side filtering
  const byZipMap: Record<string, BuildingPermit[]> = {};
  for (const p of permits) {
    const zip = p.zipcode?.trim();
    if (!zip) continue;
    (byZipMap[zip] ??= []).push(p);
  }
  const by_zip: Record<string, ZipPermitSummary> = {};
  for (const [zip, zipPermits] of Object.entries(byZipMap)) {
    by_zip[zip] = buildZipSummary(zipPermits);
  }

  return { ...base, notable_permits, by_zip };
}

function buildPipelineSummary(projects: DevelopmentProject[]): PipelineSummary {
  const net_pipeline_units = projects.reduce(
    (sum, p) => sum + (Number(p.new_pipeline_units) || 0),
    0,
  );

  const by_status = countBy(projects, (p) => p.current_status);

  const total_affordable_units = projects.reduce(
    (sum, p) => sum + (Number(p.pipeline_affordable_units) || 0),
    0,
  );

  return { total: projects.length, net_pipeline_units, by_status, total_affordable_units };
}

function buildZoningProfile(zones: ZoningDistrict[]): ZoningProfile {
  const unique_zoning_codes = [...new Set(zones.map((z) => z.zoning_sim))].sort();

  const special_use_districts = [
    ...new Set(
      zones
        .filter((z) => z.gen?.toLowerCase().includes('special'))
        .map((z) => z.districtna),
    ),
  ].sort();

  const height_range: string | null = null;

  return { unique_zoning_codes, special_use_districts, height_range };
}

function buildDateRange(
  permits: BuildingPermit[],
  projects: DevelopmentProject[],
  _zones: ZoningDistrict[],
): DateRange {
  const candidates: Date[] = [
    ...permits.map((p) => p.filed_date),
    ...permits.map((p) => p.status_date),
    ...projects.map((p) => p.current_status_date),
  ]
    .filter((s): s is string => !!s)
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()));

  if (candidates.length === 0) {
    return { start: '', end: '' };
  }

  const ms = candidates.map((d) => d.getTime());
  return {
    start: isoDate(new Date(Math.min(...ms))),
    end: isoDate(new Date(Math.max(...ms))),
  };
}

// ── Eviction type flag → human-readable label ─────────────────────────────────
const EVICTION_TYPE_KEYS: Array<{ key: keyof EvictionNotice; label: string }> = [
  { key: 'non_payment',             label: 'Non-Payment' },
  { key: 'nuisance',                label: 'Nuisance' },
  { key: 'breach',                  label: 'Breach' },
  { key: 'owner_move_in',           label: 'Owner Move-In' },
  { key: 'ellis_act_withdrawal',    label: 'Ellis Act' },
  { key: 'late_payments',           label: 'Late Payments' },
  { key: 'illegal_use',             label: 'Illegal Use' },
  { key: 'unapproved_subtenant',    label: 'Unapproved Subtenant' },
  { key: 'failure_to_sign_renewal', label: 'Failure to Sign Renewal' },
  { key: 'roommate_same_unit',      label: 'Roommate Same Unit' },
  { key: 'capital_improvement',     label: 'Capital Improvement' },
  { key: 'substantial_rehab',       label: 'Substantial Rehab' },
  { key: 'demolition',              label: 'Demolition' },
  { key: 'condo_conversion',        label: 'Condo Conversion' },
  { key: 'access_denial',           label: 'Access Denial' },
  { key: 'lead_remediation',        label: 'Lead Remediation' },
  { key: 'development',             label: 'Development' },
  { key: 'good_samaritan_ends',     label: 'Good Samaritan Ends' },
  { key: 'other_cause',             label: 'Other' },
];

function isTrue(val: unknown): boolean {
  return val === true || val === 'true';
}

function buildEvictionSummary(evictions: EvictionNotice[]): EvictionSummary {
  // by_type: count each flag independently
  const by_type: Record<string, number> = {};
  for (const e of evictions) {
    for (const { key, label } of EVICTION_TYPE_KEYS) {
      if (isTrue(e[key])) {
        by_type[label] = (by_type[label] ?? 0) + 1;
      }
    }
  }

  // by_month: bucket by YYYY-MM, then zero-fill the last 24 months
  const monthMap: Record<string, number> = {};
  for (const e of evictions) {
    const month = e.file_date?.slice(0, 7);
    if (!month) continue;
    monthMap[month] = (monthMap[month] ?? 0) + 1;
  }
  const now = new Date();
  const by_month: EvictionMonthly[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    by_month.push({ month: key, count: monthMap[key] ?? 0 });
  }

  // by_neighborhood
  const by_neighborhood: Record<string, number> = {};
  for (const e of evictions) {
    const n = e.neighborhood?.trim();
    if (!n) continue;
    by_neighborhood[n] = (by_neighborhood[n] ?? 0) + 1;
  }

  return { total: evictions.length, by_type, by_month, by_neighborhood };
}

function cleanPropertyAddress(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function buildAssessmentSummary(
  rows: AssessmentAggrRow[],
  parcels: AssessmentParcel[],
): AssessmentSummary {
  // Group aggregation rows by roll year
  const byYear: Record<string, AssessmentYearSummary> = {};
  for (const row of rows) {
    const y = row.closed_roll_year;
    if (!byYear[y]) {
      byYear[y] = { year: y, use_groups: [], total_land_usd: 0, total_improvement_usd: 0, total_assessed_usd: 0 };
    }
    const land = parseFloat(row.sum_land) || 0;
    const imp  = parseFloat(row.sum_improvement) || 0;
    byYear[y].total_land_usd        += land;
    byYear[y].total_improvement_usd += imp;
    byYear[y].total_assessed_usd    += land + imp;
    byYear[y].use_groups.push({
      use_code:            row.use_code,
      avg_land_usd:        parseFloat(row.avg_land)        || 0,
      avg_improvement_usd: parseFloat(row.avg_improvement) || 0,
      total_assessed_usd:  land + imp,
      count:               parseInt(row.count, 10)          || 0,
    });
  }

  const years = Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year));

  // Year-over-year change on total assessed value
  let yoy_change_pct: number | null = null;
  if (years.length >= 2) {
    const older = years[years.length - 2].total_assessed_usd;
    const newer = years[years.length - 1].total_assessed_usd;
    if (older > 0) {
      yoy_change_pct = Math.round(((newer - older) / older) * 1000) / 10;
    }
  }

  // Top properties sorted by combined assessed value
  const top_properties: TopAssessedProperty[] = parcels
    .map(p => ({
      address:           cleanPropertyAddress(p.property_location ?? p.parcel_number),
      parcel_number:     p.parcel_number,
      use_code:          p.use_code ?? '',
      total_assessed_usd:
        (parseFloat(p.assessed_land_value) || 0) +
        (parseFloat(p.assessed_improvement_value) || 0),
      neighborhood:      p.analysis_neighborhood ?? p.assessor_neighborhood ?? '',
    }))
    .sort((a, b) => b.total_assessed_usd - a.total_assessed_usd)
    .slice(0, 10);

  return { years, yoy_change_pct, top_properties };
}

const EMPTY_PIPELINE_SUMMARY: PipelineSummary = {
  total: 0,
  net_pipeline_units: 0,
  by_status: {},
  total_affordable_units: 0,
};

const EMPTY_ZONING_PROFILE: ZoningProfile = {
  unique_zoning_codes: [],
  special_use_districts: [],
  height_range: null,
};

const EMPTY_EVICTION_SUMMARY: EvictionSummary = {
  total: 0,
  by_type: {},
  by_month: [],
  by_neighborhood: {},
};

const EMPTY_ASSESSMENT_SUMMARY: AssessmentSummary = {
  years: [],
  yoy_change_pct: null,
  top_properties: [],
};

function parseUnits(val: string | undefined): number {
  return parseInt(val ?? '0', 10) || 0;
}

const STATUS_ORDER: Record<string, number> = {
  'Construction': 0,
  'Building Rehabilitation (Construction)': 1,
  'Pre-Construction': 2,
  'Building Rehabilitation (Pre-Construction)': 3,
};

function buildAffordableHousingSummary(projects: AffordableHousingProject[]): AffordableHousingSummary {
  let total_pipeline_units = 0;
  let total_affordable_units = 0;
  const by_status: Record<string, number> = {};
  const by_status_units: Record<string, number> = {};
  const ami: AmiDistribution = { deep_affordable: 0, low_income: 0, moderate: 0, workforce: 0, undeclared: 0 };
  const projectList: AffordableHousingPipelineProject[] = [];

  for (const p of projects) {
    const totalUnits      = parseUnits(p.total_project_units);
    const affordableUnits = parseUnits(p.mohcd_affordable_units);

    total_pipeline_units  += totalUnits;
    total_affordable_units += affordableUnits;

    const status = p.project_status;
    by_status[status]       = (by_status[status]       ?? 0) + 1;
    by_status_units[status] = (by_status_units[status] ?? 0) + affordableUnits;

    // AMI bucketing: deep ≤50%, low 51–80%, moderate 81–120%, workforce >120%
    ami.deep_affordable += parseUnits(p._20_ami) + parseUnits(p._30_ami) +
                           parseUnits(p._40_ami) + parseUnits(p._50_ami);
    ami.low_income      += parseUnits(p._55_ami) + parseUnits(p._60_ami) + parseUnits(p._80_ami);
    ami.moderate        += parseUnits(p._90_ami) + parseUnits(p._100_ami) + parseUnits(p._105_ami) +
                           parseUnits(p._110_ami) + parseUnits(p._120_ami);
    ami.workforce       += parseUnits(p._130_ami) + parseUnits(p._150_ami);
    ami.undeclared      += parseUnits(p.ami_undeclared);

    projectList.push({
      project_id:           p.project_id,
      name:                 p.project_name ?? p.project_id,
      address:              p.plannning_approval_address ?? '',
      neighborhood:         p.city_analysis_neighborhood ?? '',
      status:               p.project_status,
      total_units:          totalUnits,
      affordable_units:     affordableUnits,
      affordable_pct:       totalUnits > 0 ? Math.round((affordableUnits / totalUnits) * 100) : 0,
      tenure:               p.housing_tenure ?? '',
      estimated_completion: p.estimated_construction_completion ?? null,
    });
  }

  // Sort: active construction first, then pre-construction; within each tier by unit count desc
  projectList.sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
    return so !== 0 ? so : b.affordable_units - a.affordable_units;
  });

  return {
    total_projects:         projects.length,
    total_pipeline_units,
    total_affordable_units,
    total_market_rate_units: total_pipeline_units - total_affordable_units,
    affordable_ratio:        total_pipeline_units > 0 ? total_affordable_units / total_pipeline_units : 0,
    by_status,
    by_status_units,
    ami_distribution:       ami,
    projects:               projectList.slice(0, 15),
  };
}

const EMPTY_AFFORDABLE_HOUSING_SUMMARY: AffordableHousingSummary = {
  total_projects: 0,
  total_pipeline_units: 0,
  total_affordable_units: 0,
  total_market_rate_units: 0,
  affordable_ratio: 0,
  by_status: {},
  by_status_units: {},
  ami_distribution: { deep_affordable: 0, low_income: 0, moderate: 0, workforce: 0, undeclared: 0 },
  projects: [],
};

export async function aggregateDistrictData(district: DistrictConfig): Promise<DistrictData> {
  // Return cached data if fresh
  const cached = districtCache.get(district.number);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[aggregator] cache hit — district ${district.number} (age ${Math.round((Date.now() - cached.ts) / 1000)}s)`);
    return cached.data;
  }

  const t0 = performance.now();
  const [permits, allProjects, allZones, evictions, assessmentStats, assessmentParcels, affordableProjects] = await Promise.all([
    timed('permits',           fetchBuildingPermits(district.number)),
    timed('pipeline',          fetchDevelopmentPipeline()),
    timed('zoning',            fetchZoningDistricts()),
    timed('evictions',         fetchEvictions(district.number).catch(err => {
      console.warn('[aggregator] Eviction fetch failed (non-fatal):', err);
      return [] as EvictionNotice[];
    })),
    timed('assessment-stats',  fetchAssessmentStats(district.number).catch(err => {
      console.warn('[aggregator] Assessment stats fetch failed (non-fatal):', err);
      return [] as AssessmentAggrRow[];
    })),
    timed('assessment-parcels',fetchTopAssessedProperties(district.number).catch(err => {
      console.warn('[aggregator] Assessment parcels fetch failed (non-fatal):', err);
      return [] as AssessmentParcel[];
    })),
    timed('affordable-housing',fetchAffordableHousingPipeline(district.number).catch(err => {
      console.warn('[aggregator] Affordable housing fetch failed (non-fatal):', err);
      return [] as AffordableHousingProject[];
    })),
  ]);
  console.log(`[aggregator] all 7 fetches complete: ${(performance.now() - t0).toFixed(0)}ms | permits: ${permits.length}, pipeline: ${allProjects.length}, evictions: ${evictions.length}, assessment: ${assessmentStats.length}, parcels: ${assessmentParcels.length}, affordable: ${affordableProjects.length}`);

  const projects = allProjects.filter((p) => {
    const hood = (p.nhood41 ?? '').toLowerCase();
    return district.pipelineNeighborhoods.some((n) => hood.includes(n));
  });

  const zones = allZones.filter((z) => z.districtna?.trim() && z.zoning_sim?.trim());

  if (projects.length === 0) {
    console.warn('[aggregator] No pipeline projects returned from DataSF — using empty fallback.');
  }
  const pipeline_summary =
    projects.length > 0 ? buildPipelineSummary(projects) : EMPTY_PIPELINE_SUMMARY;

  const zoningProfile = buildZoningProfile(zones);
  if (zoningProfile.unique_zoning_codes.length === 0) {
    console.warn('[aggregator] No zoning districts returned from DataSF — using empty fallback.');
  }
  const zoning_profile =
    zoningProfile.unique_zoning_codes.length > 0 ? zoningProfile : EMPTY_ZONING_PROFILE;

  const eviction_summary = evictions.length > 0
    ? buildEvictionSummary(evictions)
    : EMPTY_EVICTION_SUMMARY;

  const assessment_summary = (assessmentStats.length > 0 || assessmentParcels.length > 0)
    ? buildAssessmentSummary(assessmentStats, assessmentParcels)
    : EMPTY_ASSESSMENT_SUMMARY;

  const affordable_housing_summary = affordableProjects.length > 0
    ? buildAffordableHousingSummary(affordableProjects)
    : EMPTY_AFFORDABLE_HOUSING_SUMMARY;

  const map_permits: MapPermit[] = permits
    .filter(p => p.location?.coordinates)
    .slice(0, 200)
    .map(p => ({
      permit_number: p.permit_number,
      address: [p.street_number, p.street_name, p.street_suffix].filter(Boolean).join(' '),
      permit_type_definition: p.permit_type_definition ?? p.permit_type,
      status: p.status,
      filed_date: (p.filed_date ?? '').split('T')[0],
      lat: p.location!.coordinates[1],
      lng: p.location!.coordinates[0],
      zipcode: p.zipcode,
    }));

  const result: DistrictData = {
    permit_summary: buildPermitSummary(permits),
    pipeline_summary,
    zoning_profile,
    date_range: buildDateRange(permits, projects, []),
    eviction_summary,
    assessment_summary,
    affordable_housing_summary,
    map_permits,
  };

  districtCache.set(district.number, { data: result, ts: Date.now() });
  console.log(`[aggregator] district ${district.number} cached`);
  return result;
}

// ── Citywide merge helpers ────────────────────────────────────────────────────

function mergeCountMaps(maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  return out;
}

function mergePermitSummaries(summaries: PermitSummary[]): PermitSummary {
  const total = summaries.reduce((s, p) => s + p.total, 0);
  const total_estimated_cost_usd = summaries.reduce((s, p) => s + p.total_estimated_cost_usd, 0);
  const notable_permits = summaries
    .flatMap(p => p.notable_permits)
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)
    .slice(0, 10);
  const by_zip: Record<string, ZipPermitSummary> = {};
  for (const p of summaries) for (const [z, s] of Object.entries(p.by_zip)) by_zip[z] = s;
  return {
    total,
    by_type:                mergeCountMaps(summaries.map(p => p.by_type)),
    by_status:              mergeCountMaps(summaries.map(p => p.by_status)),
    cost_by_type:           mergeCountMaps(summaries.map(p => p.cost_by_type)),
    total_estimated_cost_usd,
    notable_permits,
    by_zip,
  };
}

function mergeEvictionSummaries(summaries: EvictionSummary[]): EvictionSummary {
  const monthMap: Record<string, number> = {};
  for (const s of summaries) for (const { month, count } of s.by_month) monthMap[month] = (monthMap[month] ?? 0) + count;
  const by_month: EvictionMonthly[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
  return {
    total:           summaries.reduce((s, e) => s + e.total, 0),
    by_type:         mergeCountMaps(summaries.map(e => e.by_type)),
    by_month,
    by_neighborhood: mergeCountMaps(summaries.map(e => e.by_neighborhood)),
  };
}

function mergeAssessmentSummaries(summaries: AssessmentSummary[]): AssessmentSummary {
  const yearMap: Record<string, AssessmentYearSummary> = {};
  for (const s of summaries) {
    for (const yr of s.years) {
      if (!yearMap[yr.year]) yearMap[yr.year] = { year: yr.year, use_groups: [], total_land_usd: 0, total_improvement_usd: 0, total_assessed_usd: 0 };
      yearMap[yr.year].total_land_usd        += yr.total_land_usd;
      yearMap[yr.year].total_improvement_usd += yr.total_improvement_usd;
      yearMap[yr.year].total_assessed_usd    += yr.total_assessed_usd;
      for (const g of yr.use_groups) {
        const ex = yearMap[yr.year].use_groups.find(x => x.use_code === g.use_code);
        if (ex) { ex.total_assessed_usd += g.total_assessed_usd; ex.count += g.count; }
        else     yearMap[yr.year].use_groups.push({ ...g });
      }
    }
  }
  const years = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year));
  let yoy_change_pct: number | null = null;
  if (years.length >= 2) {
    const older = years[years.length - 2].total_assessed_usd;
    const newer = years[years.length - 1].total_assessed_usd;
    if (older > 0) yoy_change_pct = Math.round(((newer - older) / older) * 1000) / 10;
  }
  return {
    years,
    yoy_change_pct,
    top_properties: summaries
      .flatMap(s => s.top_properties)
      .sort((a, b) => b.total_assessed_usd - a.total_assessed_usd)
      .slice(0, 10),
  };
}

function mergeAffordableHousingSummaries(summaries: AffordableHousingSummary[]): AffordableHousingSummary {
  const total_pipeline_units   = summaries.reduce((s, a) => s + a.total_pipeline_units,   0);
  const total_affordable_units = summaries.reduce((s, a) => s + a.total_affordable_units, 0);
  const ami: AmiDistribution = {
    deep_affordable: summaries.reduce((s, a) => s + a.ami_distribution.deep_affordable, 0),
    low_income:      summaries.reduce((s, a) => s + a.ami_distribution.low_income,      0),
    moderate:        summaries.reduce((s, a) => s + a.ami_distribution.moderate,        0),
    workforce:       summaries.reduce((s, a) => s + a.ami_distribution.workforce,       0),
    undeclared:      summaries.reduce((s, a) => s + a.ami_distribution.undeclared,      0),
  };
  return {
    total_projects:         summaries.reduce((s, a) => s + a.total_projects,         0),
    total_pipeline_units,
    total_affordable_units,
    total_market_rate_units: total_pipeline_units - total_affordable_units,
    affordable_ratio:        total_pipeline_units > 0 ? total_affordable_units / total_pipeline_units : 0,
    by_status:       mergeCountMaps(summaries.map(a => a.by_status)),
    by_status_units: mergeCountMaps(summaries.map(a => a.by_status_units)),
    ami_distribution: ami,
    projects: summaries
      .flatMap(a => a.projects)
      .sort((a, b) => b.affordable_units - a.affordable_units)
      .slice(0, 15),
  };
}

// ── Citywide prompt summary builder ──────────────────────────────────────────

function buildCitywidePromptSummary(
  districtNums: string[],
  allData: DistrictData[],
): CitywideDistrictSummary[] {
  return districtNums.map((num, i) => {
    const d = allData[i];
    const cfg = DISTRICTS[num];
    const top_permit_types = Object.entries(d.permit_summary.by_type)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
    const topEviction = Object.entries(d.eviction_summary.by_type)
      .sort(([, a], [, b]) => b - a)[0];
    return {
      district_number: num,
      district_name: cfg.label,
      total_permits: d.permit_summary.total,
      top_permit_types,
      total_evictions: d.eviction_summary.total,
      top_eviction_type: topEviction ? topEviction[0] : null,
      assessed_value_yoy_pct: d.assessment_summary.yoy_change_pct,
      total_affordable_units: d.affordable_housing_summary.total_affordable_units,
      affordable_ratio: d.affordable_housing_summary.affordable_ratio,
    };
  });
}

// ── Citywide aggregation ──────────────────────────────────────────────────────

export async function aggregateCitywideData(): Promise<DistrictData> {
  const cached = districtCache.get('0');
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[aggregator] cache hit — citywide (age ${Math.round((Date.now() - cached.ts) / 1000)}s)`);
    return cached.data;
  }

  console.time('[aggregator] citywide total fetch');
  const t0 = performance.now();

  const districtNums = ['1','2','3','4','5','6','7','8','9','10','11'];
  const allData = await Promise.all(districtNums.map(n => aggregateDistrictData(DISTRICTS[n])));

  const totalMs = (performance.now() - t0).toFixed(0);
  console.timeEnd('[aggregator] citywide total fetch');
  console.log(`[aggregator] citywide: all 11 districts done in ${totalMs}ms`);

  // Index per district
  const by_district: Record<string, DistrictData> = {};
  for (let i = 0; i < districtNums.length; i++) by_district[districtNums[i]] = allData[i];

  // Merge city-wide summaries
  const mergedPermits = mergePermitSummaries(allData.map(d => d.permit_summary));

  // Expose each district's permit summary at by_zip[districtNumber] so that
  // NeighborhoodHero and Charts can do a simple by_zip[zip] lookup in citywide mode.
  for (const num of districtNums) mergedPermits.by_zip[num] = by_district[num].permit_summary;

  const result: DistrictData = {
    permit_summary:             mergedPermits,
    pipeline_summary:           {
      total:                  allData.reduce((s, d) => s + d.pipeline_summary.total, 0),
      net_pipeline_units:     allData.reduce((s, d) => s + d.pipeline_summary.net_pipeline_units, 0),
      by_status:              mergeCountMaps(allData.map(d => d.pipeline_summary.by_status)),
      total_affordable_units: allData.reduce((s, d) => s + d.pipeline_summary.total_affordable_units, 0),
    },
    zoning_profile:             {
      unique_zoning_codes:  [...new Set(allData.flatMap(d => d.zoning_profile.unique_zoning_codes))].sort(),
      special_use_districts: [...new Set(allData.flatMap(d => d.zoning_profile.special_use_districts))].sort(),
      height_range: null,
    },
    date_range: {
      start: allData.map(d => d.date_range.start).filter(Boolean).sort()[0]  ?? '',
      end:   [...allData.map(d => d.date_range.end).filter(Boolean)].sort().at(-1) ?? '',
    },
    eviction_summary:           mergeEvictionSummaries(allData.map(d => d.eviction_summary)),
    assessment_summary:         mergeAssessmentSummaries(allData.map(d => d.assessment_summary)),
    affordable_housing_summary: mergeAffordableHousingSummaries(allData.map(d => d.affordable_housing_summary)),
    map_permits:                allData.flatMap(d => d.map_permits).slice(0, 400),
    by_district,
    citywide_prompt_summary:    buildCitywidePromptSummary(districtNums, allData),
  };

  districtCache.set('0', { data: result, ts: Date.now() });
  console.log(`[aggregator] citywide cached — ${result.permit_summary.total.toLocaleString()} total permits, ${result.eviction_summary.total} evictions`);
  return result;
}
