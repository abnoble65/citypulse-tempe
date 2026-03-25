/**
 * DataSF API service — CityPulse
 *
 * Three data-fetching functions that query San Francisco's Socrata-based open
 * data portal (data.sfgov.org) and return structured JSON for Supervisor
 * District 3.
 *
 * Authentication
 * ──────────────
 * The DataSF app token is read from process.env.DATASF_APP_TOKEN and sent as
 * the X-App-Token HTTP header (recommended over the $$app_token query param).
 *
 * Expo / React Native note: environment variables are tree-shaken at bundle
 * time by Metro. Variables without the EXPO_PUBLIC_ prefix are stripped from
 * client bundles. To keep the token available at runtime, either:
 *   • rename to EXPO_PUBLIC_DATASF_APP_TOKEN and update the reference below, OR
 *   • read it server-side in an Expo API Route (app/api/*.ts) and proxy calls
 *     through your own backend.
 * The token is low-risk (rate-limiting only, not authentication), so the
 * EXPO_PUBLIC_ approach is fine for this use case.
 */

// DataSF/Socrata API calls stubbed for Tempe fork — returns empty arrays.
// Original SF implementation removed. Will be replaced with ArcGIS data layer.

// ── 1. Building Permits (i98e-djp9) ──────────────────────────────────────────
//
// Dataset:  https://data.sfgov.org/d/i98e-djp9
// Filter:   supervisor_district = '3'  (text field)
// Default order: most-recently filed first

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

/**
 * Fetches building permits filed in Supervisor District 3.
 *
 * @param limit  Maximum rows to return (default 1 000, Socrata cap 50 000).
 * @returns      Array of BuildingPermit records ordered by filed_date DESC.
 */
export async function fetchBuildingPermits(limit = 1000): Promise<BuildingPermit[]> {
  return [];
}

// ── 2. SF Development Pipeline (k55i-dnjd) ───────────────────────────────────
//
// Dataset:  https://data.sfgov.org/d/k55i-dnjd
// Filter:   sd22 = 3  (numeric field, 2022 supervisor district boundaries)
// Default order: most-recently updated first

export interface DevelopmentProject {
  nameaddr: string;
  blklot: string;
  planning_area?: string;
  nhood41?: string;
  zoning_district?: string;
  /** Supervisor District (2022 redistricting boundaries). */
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

/**
 * Fetches active and completed development projects in Supervisor District 3.
 *
 * @param limit  Maximum rows to return (default 500).
 * @returns      Array of DevelopmentProject records ordered by current_status_date DESC.
 */
export async function fetchDevelopmentPipeline(limit = 500): Promise<DevelopmentProject[]> {
  return [];
}

// ── 3. Zoning Districts (ibu8-4ccn) ──────────────────────────────────────────
//
// Dataset:  https://data.sfgov.org/d/ibu8-4ccn
// Filter:   within_box(the_geom, minLat, minLon, maxLat, maxLon)
//
// This dataset stores zoning-boundary polygons; it has no supervisor_district
// attribute column. Filtering is done spatially using Socrata's within_box()
// SoQL function against the District 3 bounding box defined above.

export interface ZoningDistrict {
  /** Simplified zoning code (e.g. "RH-2", "NCT-3", "C-3-O"). */
  zoning_sim: string;
  /** Human-readable district name. */
  districtname: string;
  /** General plan land-use category. */
  gen: string;
  /** Full zoning designation. */
  zoning: string;
  /** Planning code section that governs this zone. */
  codesection: string;
  /** URL to the Planning Department zone description. */
  url?: string;
  /** Commercial hours of operation restriction, if applicable. */
  commercial_hours_of_operation?: string;
  /** Date the record was last edited. */
  last_edit?: string;
}

/**
 * Fetches zoning districts whose boundaries overlap Supervisor District 3.
 *
 * Because the dataset contains no supervisor_district column, results are
 * filtered spatially: only zoning polygons that intersect the District 3
 * bounding box are returned. The set may include a small number of boundary
 * zones from adjacent districts.
 *
 * @param limit  Maximum rows to return (default 200).
 * @returns      Array of ZoningDistrict records ordered by zoning_sim ASC.
 */
export async function fetchZoningDistricts(limit = 200): Promise<ZoningDistrict[]> {
  return [];
}
