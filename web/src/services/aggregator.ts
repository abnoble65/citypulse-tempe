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
  type BuildingPermit,
  type DevelopmentProject,
  type ZoningDistrict,
  type EvictionNotice,
  type AssessmentAggrRow,
  type AssessmentParcel,
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

export interface DistrictData {
  permit_summary: PermitSummary;
  pipeline_summary: PipelineSummary;
  zoning_profile: ZoningProfile;
  date_range: DateRange;
  eviction_summary: EvictionSummary;
  assessment_summary: AssessmentSummary;
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

export async function aggregateDistrictData(district: DistrictConfig): Promise<DistrictData> {
  const [permits, allProjects, allZones, evictions, assessmentStats, assessmentParcels] = await Promise.all([
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
  ]);
  console.log(`[aggregator] DataSF results — permits: ${permits.length}, pipeline: ${allProjects.length}, zoning: ${allZones.length}, evictions: ${evictions.length}, assessment rows: ${assessmentStats.length}, parcels: ${assessmentParcels.length}`);

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

  return {
    permit_summary: buildPermitSummary(permits),
    pipeline_summary,
    zoning_profile,
    date_range: buildDateRange(permits, projects, []),
    eviction_summary,
    assessment_summary,
  };
}
