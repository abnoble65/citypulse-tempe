import { useQuery } from '@tanstack/react-query'
import type { BuildingEntity } from '../types/building'
import { enrichBuildingsWithParcels } from '../services/parcelIngest'

/**
 * Phase 1: loads from a static JSON file in /public/data/.
 * Phase 2: swap BUILDINGS_URL to the live pipeline API endpoint.
 * Phase 3: add queryFn params for filters, bbox, pagination.
 *
 * TanStack Query handles caching, background refresh, and loading states
 * identically in all three phases — only the fetch function changes.
 */

const BUILDINGS_URL = '/data/sf-buildings.json'
const STALE_TIME    = 15 * 60 * 1000  // 15 min — matches pipeline refresh cadence

async function fetchBuildings(): Promise<BuildingEntity[]> {
  const res = await fetch(BUILDINGS_URL)
  if (!res.ok) throw new Error(`Buildings fetch failed: ${res.status}`)
  return res.json()
}

export function useBuildings() {
  return useQuery<BuildingEntity[], Error>({
    queryKey: ['buildings'],
    queryFn: fetchBuildings,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  })
}

/**
 * Loads buildings then enriches them with real parcel geometry from DataSF.
 * Uses useBuildings as the base query, then runs enrichBuildingsWithParcels
 * as a dependent query so the map renders immediately with generated footprints
 * and swaps in real parcels once DataSF responds.
 */
export function useEnrichedBuildings() {
  const { data: buildings, ...rest } = useBuildings()

  return useQuery<BuildingEntity[], Error>({
    queryKey: ['buildings', 'enriched'],
    queryFn: () => enrichBuildingsWithParcels(buildings!),
    enabled: !!buildings && buildings.length > 0,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  })
}

export function useBuildingById(id: string | null) {
  const { data: buildings, ...rest } = useBuildings()
  const building = id
    ? (buildings?.find((b) => b.building_id === id) ?? null)
    : null
  return { data: building, ...rest }
}

/**
 * Converts the buildings array into a GeoJSON FeatureCollection
 * ready for Mapbox fill-extrusion source.
 *
 * Called inside MapView — memoised with useMemo so Mapbox only
 * re-ingests data when buildings actually change.
 */
function generateFootprint(lng: number, lat: number, footprintSqm: number | null): GeoJSON.Polygon {
  const sideDeg = Math.sqrt(footprintSqm ?? 1000) * 0.000009
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - sideDeg, lat - sideDeg],
      [lng + sideDeg, lat - sideDeg],
      [lng + sideDeg, lat + sideDeg],
      [lng - sideDeg, lat + sideDeg],
      [lng - sideDeg, lat - sideDeg],
    ]],
  }
}

export function buildingsToGeoJSON(
  buildings: BuildingEntity[]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  // Pass 1: build features and track best height data per unique polygon.
  // Condo sub-units sharing a block polygon produce the same geoKey —
  // we keep only the first occurrence and fold in the best available height.
  const seen = new Map<string, GeoJSON.Feature<GeoJSON.Polygon>>()
  const maxHeight = new Map<string, number>()
  const maxFloors = new Map<string, number>()

  for (const b of buildings) {
    const lng = b.longitude
    const lat = b.latitude
    const geometry = b.parcel_geometry
      ? (b.parcel_geometry as GeoJSON.Polygon)
      : generateFootprint(lng, lat, b.footprint_sqm)

    const geoKey = JSON.stringify(geometry.coordinates[0]?.[0])

    // Track best height and floor_count across all sub-units
    if (b.height_meters && b.height_meters > 0) {
      maxHeight.set(geoKey, Math.max(maxHeight.get(geoKey) ?? 0, b.height_meters))
    }
    if (b.floor_count && b.floor_count > 0) {
      maxFloors.set(geoKey, Math.max(maxFloors.get(geoKey) ?? 0, b.floor_count))
    }

    if (seen.has(geoKey)) {
      const ep = seen.get(geoKey)!.properties!
      ep.unit_count = (ep.unit_count ?? 1) + 1
      if (!ep.address && b.address) {
        ep.address = b.address
        ep.building_id = b.building_id
      }
      continue
    }

    seen.set(geoKey, {
      type: 'Feature',
      id: b.building_id,
      geometry,
      properties: {
        building_id:      b.building_id,
        address:          b.address,
        readiness_label:  b.readiness_label,
        readiness_score:  b.readiness_score,
        height_meters:    0, // resolved in pass 2
        completeness_pct: b.completeness_pct,
        nextspace_ready:  b.nextspace_ready,
        center_lng:       lng,
        center_lat:       lat,
        has_real_parcel:  !!b.parcel_geometry,
        unit_count:       1,
      },
    })
  }

  // Pass 2: apply height with priority fallback
  // 1. height_meters (LiDAR/real) → 2. floor_count × 3.5 → 3. 20m default
  let realHeight = 0, floorDerived = 0, defaulted = 0
  for (const [geoKey, feature] of seen) {
    const h = maxHeight.get(geoKey)
    const f = maxFloors.get(geoKey)
    if (h && h > 0) {
      feature.properties!.height_meters = h
      realHeight++
    } else if (f && f > 0) {
      feature.properties!.height_meters = Math.round(f * 3.5)
      floorDerived++
    } else {
      feature.properties!.height_meters = 20
      defaulted++
    }
  }

  const features = Array.from(seen.values())
  console.log(
    `[buildingsToGeoJSON] ${buildings.length} buildings → ${features.length} unique footprints` +
    ` | height: ${realHeight} real, ${floorDerived} from floors, ${defaulted} default`
  )
  return { type: 'FeatureCollection', features }
}
