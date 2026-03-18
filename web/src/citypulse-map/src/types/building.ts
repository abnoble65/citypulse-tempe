/**
 * Mirrors the BuildingEntity interface from web/src/lib/entity/buildingEntity.ts
 * Sprint 6 schema_version: "1.0"
 *
 * The map module imports from this shared type. When the pipeline output
 * is served via API the response will deserialise into this shape.
 */

export type ReadinessLabel = 'PRIME' | 'HIGH' | 'WATCH' | 'LOW'
export type FieldStatus = 'available' | 'pending' | 'not_sourced' | 'ai_derived'

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface FieldMeta {
  value: string | number | null
  status: FieldStatus
  source?: string
}

export interface BuildingEntity {
  // ── Identity ──────────────────────────────────────────────────────────
  building_id: string           // CC3D primary key
  apn: string                   // SF Assessor Parcel Number (stripped, e.g. 0667001)
  address: string
  building_name: string | null

  // ── Geometry ──────────────────────────────────────────────────────────
  longitude: number
  latitude: number
  height_meters: number | null
  floor_count: number | null
  footprint_sqm: number | null
  parcel_geometry: GeoJSONPolygon | null

  // ── Regulation ────────────────────────────────────────────────────────
  zoning_code: string | null
  zoning_height_limit: number | null   // metres
  building_use: string | null
  secondary_use: string | null
  building_class: string | null
  occupancy_type: string | null

  // ── Civic Intelligence ────────────────────────────────────────────────
  permit_count: number | null
  last_renovated: number | null        // year
  assessed_value: number | null        // USD
  ownership_type: string | null
  energy_use_intensity: number | null  // kBtu/sqft/yr
  sustainability_rating: string | null // A–D

  // ── Environmental (Sprint 7) ──────────────────────────────────────────
  flood_risk: number | null
  heat_island_index: number | null
  solar_potential: number | null

  // ── AI Signals ────────────────────────────────────────────────────────
  readiness_score: number              // 0–100
  readiness_label: ReadinessLabel
  redevelopment_potential: number | null
  economic_activity_index: number | null
  sustainability_score: number | null
  carbon_emissions: number | null      // MT CO₂e/yr

  // ── Provenance ────────────────────────────────────────────────────────
  schema_version: '1.0'
  data_sources: string[]
  last_updated: string                 // ISO date
  completeness_pct: number
  nextspace_ready: boolean

  // Field-level status map — used by AttributeInspector
  field_status: Record<string, FieldStatus>
}
