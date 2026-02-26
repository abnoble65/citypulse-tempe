/**
 * services/DataSF.ts — CityPulse web
 *
 * Fetches SF open data via the Socrata API (unauthenticated).
 * Rate limits are sufficient for demo use without an app token.
 */

const BASE_URL = 'https://data.sfgov.org/resource';

function buildHeaders(): Record<string, string> {
  return { Accept: 'application/json' };
}

async function socrataFetch<T>(datasetId: string, params: URLSearchParams): Promise<T[]> {
  const url = `${BASE_URL}/${datasetId}.json?${params.toString()}`;
  const response = await fetch(url, { headers: buildHeaders() });

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

export async function fetchBuildingPermits(district: string, limit = 1000): Promise<BuildingPermit[]> {
  const params = new URLSearchParams({
    $where: `supervisor_district='${district}'`,
    $limit: String(limit),
    $order: 'filed_date DESC',
  });
  return socrataFetch<BuildingPermit>('i98e-djp9', params);
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

export async function fetchDevelopmentPipeline(limit = 500): Promise<DevelopmentProject[]> {
  const params = new URLSearchParams({
    $limit: String(limit),
  });
  return socrataFetch<DevelopmentProject>('6jgi-cpb4', params);
}

export interface ZoningDistrict {
  zoning_sim: string;
  districtna: string;   // was districtname in old dataset
  gen: string;
  zoning: string;
  codesectio: string;   // was codesection in old dataset
  url?: string;
}

export async function fetchZoningDistricts(limit = 200): Promise<ZoningDistrict[]> {
  const params = new URLSearchParams({ $limit: String(limit) });
  return socrataFetch<ZoningDistrict>('3i4a-hu95', params);
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
export async function fetchAssessmentStats(district: string): Promise<AssessmentAggrRow[]> {
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
  return socrataFetch<AssessmentAggrRow>('wv5m-vpq2', params);
}

/**
 * Fetch the top 20 parcels by assessed land value for the most recent roll year.
 * Sorted server-side; client will re-sort by land+improvement total.
 */
export async function fetchTopAssessedProperties(district: string): Promise<AssessmentParcel[]> {
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
  return socrataFetch<AssessmentParcel>('wv5m-vpq2', params);
}

export async function fetchEvictions(district: string, limit = 1000): Promise<EvictionNotice[]> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const dateStr = cutoff.toISOString().split('T')[0]; // "YYYY-MM-DD"

  const params = new URLSearchParams({
    $where: `supervisor_district=${district} AND file_date > '${dateStr}'`,
    $limit: String(limit),
    $order: 'file_date DESC',
  });
  return socrataFetch<EvictionNotice>('5cei-gny5', params);
}
