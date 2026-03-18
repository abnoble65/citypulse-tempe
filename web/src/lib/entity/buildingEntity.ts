/**
 * CityPulse Canonical Building Entity Schema
 * Sprint 6 — Phase 2 Entity Binding
 *
 * Primary key: BuildingID (CC3D)
 * APN links every entity to city/parcel datasets.
 *
 * Five layers:
 *   1. Identity    — who/where (CC3D)
 *   2. Geometry    — physical form (CC3D)
 *   3. Regulation  — planning rules (CC3D + SF Planning GIS)
 *   4. Intelligence — civic data (CityPulse ingest)
 *   5. Provenance  — lineage (CC3D metadata)
 */

// ─── 1. IDENTITY ─────────────────────────────────────────────────────────────

export interface BuildingIdentity {
  /** Primary key. CC3D unique building identifier. */
  building_id: string;
  /** CC3D internal geometry node reference (alias for building_id). */
  cad_brz_nodename: string | null;
  /** Assessor Parcel Number — links to ALL city datasets. */
  apn: string | null;
  /** Parcel ID — secondary parcel link. */
  parcel_id: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

// ─── 2. GEOMETRY ─────────────────────────────────────────────────────────────

export interface BuildingGeometry {
  /** Building footprint area (m²). CC3D measured. */
  footprint_area: number | null;
  /** Measured building height (m). CC3D measured. */
  height_meters: number | null;
  /** Top elevation of building / roof peak (m). */
  roof_elevation: number | null;
  /** Total building volume (m³). Calculated from geometry. */
  volume_m3: number | null;
  /** Flat roof section height (m). Useful for rooftop solar calc. */
  roof_base_height: number | null;
  /** Roof pitch / angle (degrees). Residential slope indicator. */
  roof_pitch: number | null;
}

// ─── 3. REGULATION ───────────────────────────────────────────────────────────

export interface BuildingRegulation {
  /** Zoning classification code. From city zoning datasets. */
  zoning_code: string | null;
  /** General plan height limit (m). Planning envelope. */
  zoning_height_limit: number | null;
  /** Height regulation field. SF Planning Code. */
  zoning_height_control: string | null;
  /** Special use district designations. SF Planning GIS. */
  special_districts: string[] | null;
}

// ─── 4. INTELLIGENCE (CityPulse injected) ────────────────────────────────────

// 4a. Land use
export interface BuildingLandUse {
  /** Primary building use classification. SF Assessor. */
  building_use: string | null;
  /** Secondary land use. SF Assessor. */
  secondary_use: string | null;
  /** Occupancy type. DBI permit data. */
  occupancy_type: string | null;
  /** Building class / property class. SF Assessor. */
  building_class: string | null;
}

// 4b. History
export interface BuildingHistory {
  /** Construction year. SF Assessor. */
  year_built: number | null;
  /** Year of most recent renovation. Derived from permit history. */
  last_renovated: number | null;
  /** Full permit history records. DBI Building Permits (DataSF). */
  permit_history: PermitRecord[] | null;
}

export interface PermitRecord {
  permit_number: string;
  permit_type: string;
  filed_date: string | null;
  issued_date: string | null;
  status: string | null;
  description: string | null;
}

// 4c. Ownership & value
export interface BuildingOwnership {
  /** Ownership type (individual, corporate, public, etc.). SF Assessor. */
  ownership_type: string | null;
  /** Assessed value (USD). SF Assessor — Property Assessment Roll. */
  assessed_value: number | null;
  /** Estimated market value. Property sales records. */
  market_value: number | null;
  /** Vacancy status (occupied / vacant / partial). CoStar / commercial data. */
  vacancy_status: string | null;
}

// 4d. Sustainability & environment
export interface BuildingEnvironment {
  /** Energy use intensity (kBtu/sqft/yr). SF Energy Benchmarking. */
  energy_use_intensity: number | null;
  /** Carbon emissions estimate (metric tons CO₂e/yr). AI-derived. */
  carbon_emissions: number | null;
  /** FEMA flood zone designation. FEMA Flood Map Service. */
  flood_risk: string | null;
  /** Urban heat island index. NASA/Landsat. */
  heat_island_index: number | null;
  /** Rooftop solar generation potential (kWh/yr). NREL dataset. */
  solar_potential: number | null;
  /** Energy benchmarking / sustainability rating. SF Environment. */
  sustainability_rating: string | null;
}

// 4e. AI-derived signals (CityPulse inference engine)
export interface BuildingSignals {
  /**
   * Development readiness score (0–100).
   * Derived from: zoning + permits + hearing sentiment.
   */
  readiness_score: number | null;
  readiness_label: "PRIME" | "HIGH" | "WATCH" | "LOW" | null;
  /**
   * Permit activity signal.
   * Derived from: DBI permit velocity + recency.
   */
  permit_activity_signal: string | null;
  total_permits: number | null;
  total_hearings: number | null;
  /**
   * Redevelopment potential score (0–100).
   * Derived from: zoning envelope vs actual height.
   */
  redevelopment_potential: number | null;
  /**
   * Economic activity index.
   * Derived from: permits + hearing frequency.
   */
  economic_activity_index: number | null;
  /** Composite sustainability score (0–100). AI-derived. */
  sustainability_score: number | null;
}

// Combined intelligence layer
export interface BuildingIntelligence {
  land_use: BuildingLandUse;
  history: BuildingHistory;
  ownership: BuildingOwnership;
  environment: BuildingEnvironment;
  signals: BuildingSignals;
}

// ─── 5. PROVENANCE ───────────────────────────────────────────────────────────

export interface BuildingProvenance {
  /** CC3D source model file. */
  model_source: string | null;
  /** CC3D internal modeling ID. */
  model_internal_id: string | null;
  /** Model type (e.g. SB = stereo build). */
  model_type: string | null;
  /** Timestamp of last CC3D geometry update. */
  geometry_updated_at: string | null;
  /** Timestamp of last CityPulse intelligence update. */
  intelligence_updated_at: string | null;
  /** Data sources used to populate intelligence layer. */
  intelligence_sources: string[];
}

// ─── CANONICAL BUILDING ENTITY ───────────────────────────────────────────────

export interface BuildingEntity {
  /** Schema version — increment when structure changes. */
  schema_version: "1.0";
  identity: BuildingIdentity;
  geometry: BuildingGeometry;
  regulation: BuildingRegulation;
  intelligence: BuildingIntelligence;
  provenance: BuildingProvenance;
}

// ─── EMPTY ENTITY FACTORY ────────────────────────────────────────────────────
// Use this when creating a new entity from a CC3D record.
// Intelligence fields default to null — filled by CityPulse ingest jobs.

export function emptyBuildingEntity(
  building_id: string,
  apn: string | null = null
): BuildingEntity {
  return {
    schema_version: "1.0",
    identity: {
      building_id,
      cad_brz_nodename: null,
      apn,
      parcel_id: null,
      city: null,
      state: null,
      country: null,
    },
    geometry: {
      footprint_area: null,
      height_meters: null,
      roof_elevation: null,
      volume_m3: null,
      roof_base_height: null,
      roof_pitch: null,
    },
    regulation: {
      zoning_code: null,
      zoning_height_limit: null,
      zoning_height_control: null,
      special_districts: null,
    },
    intelligence: {
      land_use: {
        building_use: null,
        secondary_use: null,
        occupancy_type: null,
        building_class: null,
      },
      history: {
        year_built: null,
        last_renovated: null,
        permit_history: null,
      },
      ownership: {
        ownership_type: null,
        assessed_value: null,
        market_value: null,
        vacancy_status: null,
      },
      environment: {
        energy_use_intensity: null,
        carbon_emissions: null,
        flood_risk: null,
        heat_island_index: null,
        solar_potential: null,
        sustainability_rating: null,
      },
      signals: {
        readiness_score: null,
        readiness_label: null,
        permit_activity_signal: null,
        total_permits: null,
        total_hearings: null,
        redevelopment_potential: null,
        economic_activity_index: null,
        sustainability_score: null,
      },
    },
    provenance: {
      model_source: null,
      model_internal_id: null,
      model_type: null,
      geometry_updated_at: null,
      intelligence_updated_at: null,
      intelligence_sources: [],
    },
  };
}
