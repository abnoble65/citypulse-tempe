# CityPulse Map Module

2.5D / 3D Nextspace preview layer for the CityPulse dashboard.
Phase 1 of 3 — internal QA tool. See phase plan for Phase 2 (client demo) and Phase 3 (end user).

## Setup

```bash
npm install
cp .env.example .env.local
# Add VITE_MAPBOX_TOKEN to .env.local
npm run dev
```

## Adding building data (Phase 1)

Place a `sf-buildings.json` file in `public/data/`. The file must be an array of `BuildingEntity` objects — the same shape produced by the Sprint 6 pipeline.

Minimal example for one building:

```json
[
  {
    "building_id": "CC3D-0667001",
    "apn": "0667001",
    "address": "101 California St",
    "building_name": "101 California",
    "longitude": -122.3983,
    "latitude": 37.7931,
    "height_meters": 183.0,
    "floor_count": 48,
    "footprint_sqm": 2400,
    "zoning_code": "C-3-O",
    "zoning_height_limit": 244,
    "building_use": "Office",
    "secondary_use": "Retail",
    "building_class": "Class A",
    "occupancy_type": "B (Business)",
    "permit_count": 14,
    "last_renovated": 2019,
    "assessed_value": 387000000,
    "ownership_type": "Corporate",
    "energy_use_intensity": 62.4,
    "sustainability_rating": "B",
    "flood_risk": null,
    "heat_island_index": null,
    "solar_potential": null,
    "redevelopment_potential": 28,
    "economic_activity_index": 74,
    "sustainability_score": 61,
    "carbon_emissions": 1840,
    "readiness_score": 88,
    "readiness_label": "PRIME",
    "schema_version": "1.0",
    "data_sources": ["SF Assessor", "DBI", "Planning GIS", "SF Energy Benchmarking"],
    "last_updated": "2026-03-16",
    "completeness_pct": 88,
    "nextspace_ready": true,
    "field_status": {
      "building_id": "available",
      "apn": "available",
      "address": "available",
      "building_name": "available",
      "height_meters": "available",
      "floor_count": "available",
      "footprint_sqm": "available",
      "zoning_code": "available",
      "zoning_height_limit": "available",
      "building_use": "available",
      "secondary_use": "available",
      "building_class": "available",
      "occupancy_type": "available",
      "permit_count": "available",
      "last_renovated": "available",
      "assessed_value": "available",
      "ownership_type": "available",
      "energy_use_intensity": "available",
      "sustainability_rating": "available",
      "flood_risk": "pending",
      "heat_island_index": "pending",
      "solar_potential": "pending",
      "redevelopment_potential": "ai_derived",
      "economic_activity_index": "ai_derived",
      "sustainability_score": "ai_derived",
      "carbon_emissions": "ai_derived",
      "readiness_score": "ai_derived",
      "readiness_label": "ai_derived",
      "schema_version": "available",
      "completeness_pct": "available",
      "nextspace_ready": "available",
      "last_updated": "available"
    }
  }
]
```

## Architecture notes

| File | Role |
|------|------|
| `store/mapStore.ts` | Zustand — selection, view mode, sync queue |
| `hooks/useBuildings.ts` | TanStack Query — fetch, cache, GeoJSON conversion |
| `hooks/useMapUrl.ts` | URL sync — ?building=ID for shareable links |
| `components/map/MapView.tsx` | Mapbox GL JS — fill-extrusion, click, camera |
| `components/map/AttributeInspector.tsx` | Side panel — field status, sync trigger |
| `services/nextspaceSyncService.ts` | Sync stub — logs Phase 1, real API Phase 2 |
| `types/building.ts` | BuildingEntity — mirrors Sprint 6 schema |

## Phase 2 activation checklist

When Kevin provides scene credentials:

1. Add `VITE_NEXTSPACE_SCENE_ID`, `VITE_CC3D_API_BASE`, `VITE_CC3D_API_KEY` to `.env.local`
2. Uncomment the `fetch()` block in `nextspaceSyncService.ts`
3. Swap `BUILDINGS_URL` in `useBuildings.ts` to the live pipeline API endpoint
4. Done — no component changes needed

## Colour reference

| Label | Score | Hex |
|-------|-------|-----|
| PRIME | ≥ 80  | #1D9E75 |
| HIGH  | 60–79 | #BA7517 |
| WATCH | 40–59 | #D85A30 |
| LOW   | < 40  | #888780 |
| Selected | — | #185FA5 |
