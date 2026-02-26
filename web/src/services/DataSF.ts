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
