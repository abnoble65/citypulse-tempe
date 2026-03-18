/**
 * CC3D → CityPulse Canonical Entity Field Mapping
 * Sprint 6 — Phase 2 Entity Binding
 *
 * Source of truth: Kevin Devito crosswalk document (March 2026)
 *
 * This file defines:
 *   1. The raw CC3D record shape (as received from the API/scene)
 *   2. A mapping config from each CC3D field → BuildingEntity path
 *   3. Type coercion rules for each field
 *
 * Fields NOT listed here are intelligence layer attributes.
 * They come from CityPulse ingest jobs, NOT from CC3D.
 */

// ─── RAW CC3D RECORD ─────────────────────────────────────────────────────────
// Shape of a building record as returned by the CC3D / Nextspace scene API.

export interface CC3DRecord {
  // Identity
  BuildingID: string;
  APN: string | null;
  CAD_BRZNodename: string | null;
  parcel_id: string | null;
  country: string | null;
  state: string | null;
  city: string | null;

  // Physical geometry
  area: number | null;       // footprint area (m²)
  height: number | null;     // measured building height (m)
  topZ: number | null;       // top elevation / roof peak (m)
  volume: number | null;     // total building volume (m³)
  flatHeight: number | null; // flat roof section height (m)
  roofAngle: number | null;  // roof pitch (degrees)

  // Zoning / regulatory
  zoning: string | null;     // zoning classification
  gen_hght: number | null;   // general plan height limit (m)
  height1: string | null;    // SF Planning Code height control

  // Provenance
  source: string | null;         // source model file
  sourceInternalID: string | null; // internal modeling ID
  dataType: string | null;       // model type (e.g. SB = stereo build)
}

// ─── MAPPING DEFINITION ──────────────────────────────────────────────────────

export type EntityPath = string; // dot-notation path into BuildingEntity

export type CoercionType =
  | "string"
  | "number"
  | "string[]"
  | "iso_date"; // converts to ISO string if needed

export interface FieldMapping {
  /** CC3D field name (key on CC3DRecord). */
  cc3d_field: keyof CC3DRecord;
  /** Dot-notation path in the BuildingEntity target. */
  entity_path: EntityPath;
  /** Type coercion to apply. */
  type: CoercionType;
  /** Notes from the crosswalk doc. */
  notes?: string;
}

/**
 * Complete CC3D → BuildingEntity field map.
 *
 * Every CC3D field that maps directly to a BuildingEntity attribute is listed.
 * Intelligence-layer attributes are NOT listed — those come from city datasets.
 */
export const CC3D_FIELD_MAP: FieldMapping[] = [

  // ── Identity ──────────────────────────────────────────────────────────────
  {
    cc3d_field: "BuildingID",
    entity_path: "identity.building_id",
    type: "string",
    notes: "Primary key. Required — must be present on every record.",
  },
  {
    cc3d_field: "CAD_BRZNodename",
    entity_path: "identity.cad_brz_nodename",
    type: "string",
    notes: "Internal geometry node reference. Alias for building_id.",
  },
  {
    cc3d_field: "APN",
    entity_path: "identity.apn",
    type: "string",
    notes: "Primary parcel link. Used to join ALL city datasets.",
  },
  {
    cc3d_field: "parcel_id",
    entity_path: "identity.parcel_id",
    type: "string",
    notes: "Secondary parcel identifier.",
  },
  {
    cc3d_field: "country",
    entity_path: "identity.country",
    type: "string",
  },
  {
    cc3d_field: "state",
    entity_path: "identity.state",
    type: "string",
  },
  {
    cc3d_field: "city",
    entity_path: "identity.city",
    type: "string",
  },

  // ── Geometry ──────────────────────────────────────────────────────────────
  {
    cc3d_field: "area",
    entity_path: "geometry.footprint_area",
    type: "number",
    notes: "Building footprint area. Measured directly by CC3D.",
  },
  {
    cc3d_field: "height",
    entity_path: "geometry.height_meters",
    type: "number",
    notes: "Core geometry metric.",
  },
  {
    cc3d_field: "topZ",
    entity_path: "geometry.roof_elevation",
    type: "number",
    notes: "Top elevation / roof peak. Often equal to height.",
  },
  {
    cc3d_field: "volume",
    entity_path: "geometry.volume_m3",
    type: "number",
    notes: "Calculated from CC3D geometry.",
  },
  {
    cc3d_field: "flatHeight",
    entity_path: "geometry.roof_base_height",
    type: "number",
    notes: "Flat roof section height. Useful for rooftop solar.",
  },
  {
    cc3d_field: "roofAngle",
    entity_path: "geometry.roof_pitch",
    type: "number",
    notes: "Roof pitch in degrees. Residential slope indicator.",
  },

  // ── Regulation ────────────────────────────────────────────────────────────
  {
    cc3d_field: "zoning",
    entity_path: "regulation.zoning_code",
    type: "string",
    notes: "From city zoning datasets embedded in CC3D.",
  },
  {
    cc3d_field: "gen_hght",
    entity_path: "regulation.zoning_height_limit",
    type: "number",
    notes: "General plan height limit. Planning envelope.",
  },
  {
    cc3d_field: "height1",
    entity_path: "regulation.zoning_height_control",
    type: "string",
    notes: "San Francisco Planning Code height regulation field.",
  },

  // ── Provenance ────────────────────────────────────────────────────────────
  {
    cc3d_field: "source",
    entity_path: "provenance.model_source",
    type: "string",
    notes: "Source model file. Version control reference.",
  },
  {
    cc3d_field: "sourceInternalID",
    entity_path: "provenance.model_internal_id",
    type: "string",
    notes: "Internal CC3D modeling ID. Production reference.",
  },
  {
    cc3d_field: "dataType",
    entity_path: "provenance.model_type",
    type: "string",
    notes: "Model type. Example: SB = stereo build.",
  },
];

// ─── INTELLIGENCE FIELDS NOT IN CC3D ─────────────────────────────────────────
// These are documented here for reference.
// They are populated by CityPulse ingest jobs, not this mapping.

export const INTELLIGENCE_FIELDS_TO_INJECT = [
  // P1 — Sprint 6 (city open data via Socrata)
  { field: "intelligence.land_use.building_use",     source: "SF Assessor Property Characteristics" },
  { field: "intelligence.land_use.secondary_use",    source: "SF Assessor Property Characteristics" },
  { field: "intelligence.land_use.building_class",   source: "SF Assessor Property Characteristics" },
  { field: "intelligence.land_use.occupancy_type",   source: "DBI Permit Data" },
  { field: "intelligence.history.year_built",        source: "SF Assessor Property Characteristics" },
  { field: "intelligence.history.last_renovated",    source: "DBI Building Permits" },
  { field: "intelligence.history.permit_history",    source: "DBI Building Permits" },
  { field: "intelligence.ownership.ownership_type",  source: "SF Assessor Parcel Records" },
  { field: "intelligence.ownership.assessed_value",  source: "SF Assessor Property Assessment Roll" },

  // P2 — Sprint 7 (external / environmental datasets)
  { field: "intelligence.environment.flood_risk",         source: "FEMA Flood Map Service" },
  { field: "intelligence.environment.heat_island_index",  source: "NASA / Landsat" },
  { field: "intelligence.environment.solar_potential",    source: "NREL Solar Rooftop Dataset" },
  { field: "intelligence.environment.energy_use_intensity", source: "SF Energy Benchmarking" },
  { field: "intelligence.environment.sustainability_rating", source: "SF Energy Benchmarking" },

  // P3 — pending service selection
  { field: "intelligence.ownership.market_value",    source: "Property sales records / First American DataTree" },
  { field: "intelligence.ownership.vacancy_status",  source: "CoStar / commercial real estate data" },

  // AI-derived (CityPulse inference engine)
  { field: "intelligence.signals.redevelopment_potential",  source: "CityPulse AI — zoning vs height" },
  { field: "intelligence.signals.economic_activity_index",  source: "CityPulse AI — permits + hearings" },
  { field: "intelligence.signals.sustainability_score",     source: "CityPulse AI — energy + roof + solar" },
  { field: "intelligence.environment.carbon_emissions",     source: "CityPulse AI — energy + building data" },
] as const;
