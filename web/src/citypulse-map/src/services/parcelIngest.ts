import type { BuildingEntity, GeoJSONPolygon } from '../types/building'

const PARCELS_URL = 'https://services8.arcgis.com/SeelVoY3qN5dU7fD/arcgis/rest/services/Parcels___Active_and_Retired/FeatureServer/0/query'

// Validates and normalises APN to a safe 7-char alphanumeric blklot
// Accepts formats: '0263011', '0263-011', '3709006A'
// Rejects anything with characters outside [0-9A-Za-z]
function apnToBlklot(apn: string): string | null {
  const clean = apn.replace(/-/g, '').toUpperCase()
  if (!/^[A-Z0-9]{7,8}$/.test(clean)) {
    console.warn(`[parcelIngest] Invalid APN format: ${apn}`)
    return null
  }
  return clean
}

export async function fetchParcelGeometry(apn: string): Promise<GeoJSONPolygon | null> {
  try {
    const blklot = apnToBlklot(apn)
    if (!blklot) return null

    const params = new URLSearchParams({
      where: `blklot='${blklot}'`,
      outFields: 'blklot,from_addre,street_nam,street_typ',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
    })

    const res = await fetch(`${PARCELS_URL}?${params}`)
    if (!res.ok) {
      console.warn(`[parcelIngest] ArcGIS returned ${res.status} for ${blklot}`)
      return null
    }

    const fc = await res.json()
    const feature = fc?.features?.[0]
    if (!feature?.geometry) {
      console.warn(`[parcelIngest] No geometry for ${blklot}`)
      return null
    }

    if (feature.geometry.type === 'MultiPolygon') {
      return { type: 'Polygon', coordinates: feature.geometry.coordinates[0] }
    }
    return { type: 'Polygon', coordinates: feature.geometry.coordinates }

  } catch (err) {
    console.warn(`[parcelIngest] Failed for APN ${apn}:`, err)
    return null
  }
}

export async function enrichBuildingsWithParcels(
  buildings: BuildingEntity[],
  concurrency = 5
): Promise<BuildingEntity[]> {
  const results = [...buildings]
  const queue = results
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.parcel_geometry === null || b.parcel_geometry === undefined)

  console.log(`[parcelIngest] Fetching ${queue.length} parcel boundaries from ArcGIS…`)

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async ({ b, i: idx }) => {
        const geometry = await fetchParcelGeometry(b.apn)
        if (geometry) {
          results[idx] = { ...results[idx], parcel_geometry: geometry }
          console.log(`[parcelIngest] ✓ ${b.address} (${b.apn})`)
        } else {
          console.warn(`[parcelIngest] ✗ ${b.address} (${b.apn}) — using generated footprint`)
        }
      })
    )
  }

  const fetched = results.filter((b) => b.parcel_geometry !== null).length
  console.log(`[parcelIngest] Done — ${fetched}/${buildings.length} parcels enriched`)
  return results
}

export function parcelCentroid(polygon: GeoJSONPolygon): { longitude: number; latitude: number } {
  const ring = polygon.coordinates[0]
  const n = ring.length - 1
  let lngSum = 0
  let latSum = 0
  for (let i = 0; i < n; i++) {
    lngSum += ring[i][0]
    latSum += ring[i][1]
  }
  return { longitude: lngSum / n, latitude: latSum / n }
}
