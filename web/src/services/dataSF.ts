/**
 * services/DataSF.ts — CityPulse web
 *
 * Fetches SF open data via the Socrata API (unauthenticated).
 * Rate limits are sufficient for demo use without an app token.
 */

import { fetchWithTimeout, TIMEOUT_DATA } from '../utils/fetchWithTimeout';

const BASE_URL = 'https://data.sfgov.org/resource';

function buildHeaders(): Record<string, string> {
  return { Accept: 'application/json' };
}

async function socrataFetch<T>(datasetId: string, params: URLSearchParams, signal?: AbortSignal): Promise<T[]> {
  const url = `${BASE_URL}/${datasetId}.json?${params.toString()}`;
  const response = await fetchWithTimeout(url, {
    headers: buildHeaders(),
    timeoutMs: TIMEOUT_DATA,
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `DataSF [${datasetId}] ${response.status} ${response.statusText}` +
        (body ? `: ${body}` : ''),
    );
  }

  return response.json() as Promise<T[]>;
}

export interface BuildingPermit {
  permit_number: string;
  permit_type: string;
  permit_type_definition: string;
  permit_creation_date: string;
  block: string;
  lot: string;
  street_number: string;
  street_name: string;
  street_suffix: string;
  unit?: string;
  description: string;
  status: string;
  status_date: string;
  filed_date: string;
  issued_date?: string;
  completed_date?: string;
  first_construction_document_date?: string;
  existing_use?: string;
  proposed_use?: string;
  existing_units?: string;
  proposed_units?: string;
  estimated_cost?: string;
  revised_cost?: string;
  existing_construction_type_description?: string;
  proposed_construction_type_description?: string;
  supervisor_district: string;
  neighborhoods_analysis_boundaries?: string;
  zipcode?: string;
  location?: { type: string; coordinates: [number, number] };
  data_as_of?: string;
}

export async function fetchBuildingPermits(district: string, limit = 5000, signal?: AbortSignal): Promise<BuildingPermit[]> {
  const year = new Date().getFullYear();
  const startDate = `${year}-01-01T00:00:00.000`;
  const params = new URLSearchParams({
    $select: [
      'permit_number', 'permit_type', 'permit_type_definition',
      'status', 'status_date', 'filed_date',
      'street_number', 'street_name', 'street_suffix',
      'zipcode', 'estimated_cost', 'revised_cost',
      'description', 'supervisor_district', 'location',
    ].join(','),
    $where: `supervisor_district='${district}' AND filed_date >= '${startDate}'`,
    $limit: String(limit),
    $order: 'filed_date DESC',
  });
  return socrataFetch<BuildingPermit>('i98e-djp9', params, signal);
}

export interface DevelopmentProject {
  nameaddr: string;
  blklot: string;
  planning_area?: string;
  nhood41?: string;
  zoning_district?: string;
  sd22: number;
  has_approved_entitlement?: boolean;
  current_status: string;
  current_status_date: string;
  new_pipeline_units?: number;
  completed_new_units?: number;
  pipeline_affordable_units?: number;
  case_no?: string;
  bpa_no?: string;
  description_planning?: string;
  description_dbi?: string;
  planner?: string;
  sponsor?: string;
}

export async function fetchDevelopmentPipeline(limit = 500, signal?: AbortSignal): Promise<DevelopmentProject[]> {
  const params = new URLSearchParams({
    $limit: String(limit),
  });
  return socrataFetch<DevelopmentProject>('6jgi-cpb4', params, signal);
}

export interface ZoningDistrict {
  zoning_sim: string;
  districtna: string;   // was districtname in old dataset
  gen: string;
  zoning: string;
  codesectio: string;   // was codesection in old dataset
  url?: string;
}

export async function fetchZoningDistricts(limit = 200, signal?: AbortSignal): Promise<ZoningDistrict[]> {
  const params = new URLSearchParams({ $limit: String(limit) });
  return socrataFetch<ZoningDistrict>('3i4a-hu95', params, signal);
}

export interface EvictionNotice {
  eviction_id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  file_date: string;
  supervisor_district?: string;
  neighborhood?: string;
  non_payment?: boolean;
  breach?: boolean;
  nuisance?: boolean;
  illegal_use?: boolean;
  failure_to_sign_renewal?: boolean;
  access_denial?: boolean;
  unapproved_subtenant?: boolean;
  owner_move_in?: boolean;
  demolition?: boolean;
  capital_improvement?: boolean;
  substantial_rehab?: boolean;
  ellis_act_withdrawal?: boolean;
  condo_conversion?: boolean;
  roommate_same_unit?: boolean;
  other_cause?: boolean;
  late_payments?: boolean;
  lead_remediation?: boolean;
  development?: boolean;
  good_samaritan_ends?: boolean;
}

// ── Property Assessment (Assessor Historical Secured Property Tax Rolls) ──────
// Dataset ID: wv5m-vpq2
// Aggregation query: avg/sum of assessed values grouped by year + use_code
// Top-properties query: highest land-value parcels for the latest roll year

export interface AssessmentAggrRow {
  closed_roll_year: string;
  use_code: string;                 // e.g. "RES", "COMM", "MISC"
  avg_land: string;                 // Socrata returns aggregations as strings
  avg_improvement: string;
  sum_land: string;
  sum_improvement: string;
  count: string;
}

export interface AssessmentParcel {
  property_location?: string;
  parcel_number: string;
  use_code?: string;
  use_definition?: string;
  assessed_land_value: string;
  assessed_improvement_value: string;
  analysis_neighborhood?: string;
  assessor_neighborhood?: string;
}

/** Returns [olderYear, newerYear] as strings, capped at the dataset's latest roll (2024). */
function assessmentYears(): [string, string] {
  const latest = Math.min(new Date().getFullYear() - 1, 2024);
  return [String(latest - 1), String(latest)];
}

/**
 * Fetch aggregated assessment stats for two roll years, grouped by use_code.
 * Returns ~10–20 rows — very lightweight.
 */
export async function fetchAssessmentStats(district: string, signal?: AbortSignal): Promise<AssessmentAggrRow[]> {
  const [y1, y2] = assessmentYears();
  const params = new URLSearchParams({
    $select: [
      'closed_roll_year', 'use_code',
      'avg(assessed_land_value) as avg_land',
      'avg(assessed_improvement_value) as avg_improvement',
      'sum(assessed_land_value) as sum_land',
      'sum(assessed_improvement_value) as sum_improvement',
      'count(*) as count',
    ].join(','),
    $where: `closed_roll_year in('${y1}','${y2}') AND supervisor_district='${district}' AND assessed_land_value > 0`,
    $group: 'closed_roll_year,use_code',
    $limit: '100',
  });
  return socrataFetch<AssessmentAggrRow>('wv5m-vpq2', params, signal);
}

/**
 * Fetch the top 20 parcels by assessed land value for the most recent roll year.
 * Sorted server-side; client will re-sort by land+improvement total.
 */
export async function fetchTopAssessedProperties(district: string, signal?: AbortSignal): Promise<AssessmentParcel[]> {
  const [, y2] = assessmentYears();
  const params = new URLSearchParams({
    $select: [
      'property_location', 'parcel_number', 'use_code', 'use_definition',
      'assessed_land_value', 'assessed_improvement_value',
      'analysis_neighborhood', 'assessor_neighborhood',
    ].join(','),
    $where: `closed_roll_year='${y2}' AND supervisor_district='${district}' AND assessed_land_value > 500000`,
    $order: 'assessed_land_value DESC',
    $limit: '20',
  });
  return socrataFetch<AssessmentParcel>('wv5m-vpq2', params, signal);
}

// ── Affordable Housing Pipeline (MOHCD) ───────────────────────────────────────
// Dataset ID: aaxw-2cb8
// 194 projects citywide; filter by supervisor_district (text field)

export interface AffordableHousingProject {
  project_id: string;
  project_name?: string;
  plannning_approval_address?: string; // Note: DataSF typo — three n's
  zip_code?: string;
  supervisor_district?: string;
  city_analysis_neighborhood?: string;
  project_status: string;              // Pre-Construction | Construction | Building Rehabilitation (…)
  construction_status?: string;
  project_type?: string;               // New Construction | Rehabilitation
  housing_tenure?: string;             // Rental | Ownership
  general_housing_program?: string;
  total_project_units?: string;
  mohcd_affordable_units?: string;
  affordable_percent?: string;         // stored as text
  estimated_construction_completion?: string;
  // AMI brackets (all stored as text numbers by Socrata)
  _20_ami?: string;
  _30_ami?: string;
  _40_ami?: string;
  _50_ami?: string;
  _55_ami?: string;
  _60_ami?: string;
  _80_ami?: string;
  _90_ami?: string;
  _100_ami?: string;
  _105_ami?: string;
  _110_ami?: string;
  _120_ami?: string;
  _130_ami?: string;
  _150_ami?: string;
  ami_undeclared?: string;
}

export async function fetchAffordableHousingPipeline(district: string, signal?: AbortSignal): Promise<AffordableHousingProject[]> {
  const params = new URLSearchParams({
    $where: `supervisor_district='${district}'`,
    $limit: '200',
    $order: 'project_status ASC',
  });
  return socrataFetch<AffordableHousingProject>('aaxw-2cb8', params, signal);
}

// ── 311 Service Requests ────────────────────────────────────────────────────
// Dataset ID: vw6y-z8j6

export interface ThreeOneOneRequest {
  service_request_id: string;
  requested_datetime: string;
  closed_date?: string;
  status_description: string;
  service_name: string;
  service_subtype?: string;
  address?: string;
  lat?: string;
  long?: string;
  supervisor_district?: string;
  neighborhoods_sffind_neighborhoods?: string;
}

export async function fetch311Requests(district: string, limit = 2000, signal?: AbortSignal): Promise<ThreeOneOneRequest[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const dateStr = cutoff.toISOString().split('T')[0];

  const params = new URLSearchParams({
    $select: [
      'service_request_id', 'requested_datetime', 'closed_date',
      'status_description', 'service_name', 'service_subtype',
      'address', 'lat', 'long', 'supervisor_district',
      'neighborhoods_sffind_neighborhoods',
    ].join(','),
    $where: `supervisor_district='${district}' AND requested_datetime >= '${dateStr}T00:00:00.000'`,
    $order: 'requested_datetime DESC',
    $limit: String(limit),
  });
  return socrataFetch<ThreeOneOneRequest>('vw6y-z8j6', params, signal);
}

// ── Community Benefit District Boundaries ──────────────────────────────────
// Dataset ID: c28a-f6gs (the eunk-59dy map view returns empty rows)

export interface CBDBoundary {
  community_benefit_district: string;
  multipolygon: {
    type: string;
    coordinates: number[][][][];
  };
  revenue?: number;
  established?: number;
  expiration?: string;
  sup_districts?: string;
  annual_report_url?: string;
}

export async function fetchCBDBoundaries(signal?: AbortSignal): Promise<CBDBoundary[]> {
  const params = new URLSearchParams({
    $select: 'community_benefit_district,multipolygon,revenue,established,expiration,sup_districts,annual_report_url',
    $limit: '50',
  });
  return socrataFetch<CBDBoundary>('c28a-f6gs', params, signal);
}

export async function fetchEvictions(district: string, limit = 1000, signal?: AbortSignal): Promise<EvictionNotice[]> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const dateStr = cutoff.toISOString().split('T')[0]; // "YYYY-MM-DD"

  const params = new URLSearchParams({
    $where: `supervisor_district=${district} AND file_date > '${dateStr}'`,
    $limit: String(limit),
    $order: 'file_date DESC',
  });
  return socrataFetch<EvictionNotice>('5cei-gny5', params, signal);
}
