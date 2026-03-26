/**
 * services/DataSF.ts — CityPulse web
 *
 * Fetches SF open data via the Socrata API (unauthenticated).
 * Rate limits are sufficient for demo use without an app token.
 */

// DataSF/Socrata API calls stubbed for Tempe fork — returns empty arrays.
// Original SF implementation removed. Will be replaced with ArcGIS data layer.

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

export async function fetchBuildingPermits(_district?: string, _limit?: number, _signal?: AbortSignal): Promise<BuildingPermit[]> {
  return [];
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

export async function fetchDevelopmentPipeline(_limit?: number, _signal?: AbortSignal): Promise<DevelopmentProject[]> {
  return [];
}

export interface ZoningDistrict {
  zoning_sim: string;
  districtna: string;   // was districtname in old dataset
  gen: string;
  zoning: string;
  codesectio: string;   // was codesection in old dataset
  url?: string;
}

export async function fetchZoningDistricts(_limit?: number, _signal?: AbortSignal): Promise<ZoningDistrict[]> {
  return [];
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

export async function fetchAssessmentStats(_district?: string, _signal?: AbortSignal): Promise<AssessmentAggrRow[]> {
  return [];
}

export async function fetchTopAssessedProperties(_district?: string, _signal?: AbortSignal): Promise<AssessmentParcel[]> {
  return [];
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

export async function fetchAffordableHousingPipeline(_district?: string, _signal?: AbortSignal): Promise<AffordableHousingProject[]> {
  return [];
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

export async function fetch311Requests(_district?: string, _limit?: number, _signal?: AbortSignal): Promise<ThreeOneOneRequest[]> {
  return [];
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

export async function fetchCBDBoundaries(_signal?: AbortSignal): Promise<CBDBoundary[]> {
  return [];
}

export async function fetchEvictions(_district?: string, _limit?: number, _signal?: AbortSignal): Promise<EvictionNotice[]> {
  return [];
}
