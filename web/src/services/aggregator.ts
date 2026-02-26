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
import type { DistrictConfig } from '../districts';

export interface NotablePermit {
  permit_number: string;
  address: string;
  description: string;
  estimated_cost_usd: number;
  status: string;
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

export interface DistrictData {
  permit_summary: PermitSummary;
  pipeline_summary: PipelineSummary;
  zoning_profile: ZoningProfile;
  date_range: DateRange;
  eviction_summary: EvictionSummary;
  assessment_summary: AssessmentSummary;
  affordable_housing_summary: AffordableHousingSummary;
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
  const [permits, allProjects, allZones, evictions, assessmentStats, assessmentParcels, affordableProjects] = await Promise.all([
    fetchBuildingPermits(district.number),
    fetchDevelopmentPipeline(),
    fetchZoningDistricts(),
    fetchEvictions(district.number).catch(err => {
      console.warn('[aggregator] Eviction fetch failed (non-fatal):', err);
      return [] as EvictionNotice[];
    }),
    fetchAssessmentStats(district.number).catch(err => {
      console.warn('[aggregator] Assessment stats fetch failed (non-fatal):', err);
      return [] as AssessmentAggrRow[];
    }),
    fetchTopAssessedProperties(district.number).catch(err => {
      console.warn('[aggregator] Assessment parcels fetch failed (non-fatal):', err);
      return [] as AssessmentParcel[];
    }),
    fetchAffordableHousingPipeline(district.number).catch(err => {
      console.warn('[aggregator] Affordable housing fetch failed (non-fatal):', err);
      return [] as AffordableHousingProject[];
    }),
  ]);
  console.log(`[aggregator] DataSF results — permits: ${permits.length}, pipeline: ${allProjects.length}, zoning: ${allZones.length}, evictions: ${evictions.length}, assessment rows: ${assessmentStats.length}, parcels: ${assessmentParcels.length}, affordable housing: ${affordableProjects.length}`);

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

  return {
    permit_summary: buildPermitSummary(permits),
    pipeline_summary,
    zoning_profile,
    date_range: buildDateRange(permits, projects, []),
    eviction_summary,
    assessment_summary,
    affordable_housing_summary,
  };
}
