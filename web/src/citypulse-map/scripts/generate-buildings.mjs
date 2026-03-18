/**
 * generate-buildings.mjs
 *
 * Queries DataSF and ArcGIS to generate sf-buildings.json
 * for all commercial/office parcels in downtown SF.
 *
 * Run: node scripts/generate-buildings.mjs
 * Output: public/data/sf-buildings.json
 */

import { writeFileSync } from 'fs'

// Downtown SF bounding box
const BOUNDS = {
  xmin: -122.4050,
  ymin: 37.7880,
  xmax: -122.3920,
  ymax: 37.7970,
}

const ARCGIS_URL = 'https://services8.arcgis.com/SeelVoY3qN5dU7fD/arcgis/rest/services/Parcels___Active_and_Retired/FeatureServer/0/query'
const ASSESSOR_URL = 'https://data.sfgov.org/resource/wv5m-vpq2.json'

async function fetchParcels() {
  console.log('Fetching downtown parcels from ArcGIS...')
  const geometry = JSON.stringify({
    xmin: BOUNDS.xmin, ymin: BOUNDS.ymin,
    xmax: BOUNDS.xmax, ymax: BOUNDS.ymax,
    spatialReference: { wkid: 4326 }
  })
  const url = new URL(ARCGIS_URL)
  url.searchParams.set('geometry', geometry)
  url.searchParams.set('geometryType', 'esriGeometryEnvelope')
  url.searchParams.set('inSR', '4326')
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  url.searchParams.set('outFields', 'blklot,from_addre,street_nam,street_typ,zoning_cod,zoning_dis,Shape__Area')
  url.searchParams.set('where', "(zoning_cod LIKE 'C-3%' OR zoning_cod LIKE 'C-2%' OR zoning_cod LIKE 'NCT%' OR zoning_cod LIKE 'RC%' OR zoning_cod LIKE 'RH%' OR zoning_cod LIKE 'RM%') AND Shape__Area > 500")
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultRecordCount', '500')
  url.searchParams.set('f', 'json')

  const res = await fetch(url.toString())
  const data = await res.json()
  if (data.error) throw new Error(`ArcGIS error: ${JSON.stringify(data.error)}`)
  console.log(`  Found ${data.features?.length ?? 0} parcels`)
  return data.features ?? []
}

async function fetchAssessorData(blklots) {
  console.log('Fetching assessor data from DataSF...')
  const results = {}
  for (let i = 0; i < blklots.length; i += 50) {
    const batch = blklots.slice(i, i + 50)
    const where = batch.map(b => `'${b}'`).join(',')
    const url = `${ASSESSOR_URL}?$where=parcel_number IN (${where})&$select=parcel_number,property_area,year_property_built,use_definition,property_class_code,number_of_units,number_of_stories,assessed_improvement_value,assessed_land_value,zoning_code,construction_type&$limit=50`
    const res = await fetch(url)
    const rows = await res.json()
    if (Array.isArray(rows)) rows.forEach(r => { results[r.parcel_number] = r })
    process.stdout.write(`  ${Math.min(i + 50, blklots.length)}/${blklots.length}\r`)
  }
  console.log(`\n  Got assessor data for ${Object.keys(results).length} parcels`)
  return results
}


function centroid(rings) {
  const ring = rings[0]
  const n = ring.length - 1
  let lngSum = 0, latSum = 0
  for (let i = 0; i < n; i++) {
    lngSum += ring[i][0]
    latSum += ring[i][1]
  }
  return { lng: lngSum / n, lat: latSum / n }
}

async function fetchBuildingHeights(blklots) {
  console.log('Fetching building heights from SF Building Footprints...')
  const results = {}

  // Convert blklot to mblr format: 0263011 → SF0263011
  const mblrToBlklot = {}
  const mblrs = blklots.map(b => {
    const mblr = `SF${b}`
    mblrToBlklot[mblr] = b
    return mblr
  })

  for (let i = 0; i < mblrs.length; i += 50) {
    const batch = mblrs.slice(i, i + 50)
    const where = batch.map(m => `'${m}'`).join(',')
    const url = `https://data.sfgov.org/resource/ynuv-fyni.json?$where=mblr IN (${where})&$select=mblr,hgt_median_m,hgt_maxcm&$limit=50`
    const res = await fetch(url)
    const rows = await res.json()
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        const blklot = mblrToBlklot[r.mblr]
        if (blklot) results[blklot] = r
      })
    }
    process.stdout.write(`  ${Math.min(i + 50, mblrs.length)}/${mblrs.length}\r`)
  }

  console.log(`\n  Got height data for ${Object.keys(results).length} parcels`)
  return results
}

// Height derivation is now inline in main()

function readinessScore(assessor, heightM) {
  let score = 45
  if (heightM) score += 15           // LiDAR height is high value
  if (assessor?.year_property_built) score += 8
  if (assessor?.use_definition) score += 8
  if (assessor?.zoning_code) score += 8
  if (assessor?.assessed_improvement_value) score += 8
  if (assessor?.property_class_code) score += 8
  return Math.min(score, 100)
}

function readinessLabel(score) {
  if (score >= 80) return 'PRIME'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'WATCH'
  return 'LOW'
}

async function main() {
  const parcels = await fetchParcels()
  const blklots = parcels.map(p => p.attributes.blklot).filter(Boolean)

  const [assessorData, heightData] = await Promise.all([
    fetchAssessorData(blklots),
    fetchBuildingHeights(blklots),
  ])

  console.log('Building entity records...')
  const buildings = parcels.map((p, idx) => {
    const attrs = p.attributes
    const blklot = attrs.blklot
    const assessor = assessorData[blklot] ?? {}
    const heightRecord = heightData[blklot] ?? {}
    const { lng, lat } = centroid(p.geometry.rings)

    const heightRaw = heightRecord?.hgt_median_m
    const heightM = heightRaw ? Math.round(parseFloat(heightRaw))
      : assessor?.number_of_stories ? Math.round(parseFloat(assessor.number_of_stories) * 4)
      : null
    const floorCount = assessor?.number_of_stories
      ? Math.round(parseFloat(assessor.number_of_stories))
      : heightM ? Math.round(heightM / 4)
      : null
    const footprintSqm = heightRecord?.shape_area
      ? Math.round(parseFloat(heightRecord.shape_area) * 0.0929)
      : attrs.Shape__Area ? Math.round(attrs.Shape__Area * 0.0929)
      : null

    const address = `${attrs.from_addre} ${attrs.street_nam} ${attrs.street_typ}`.trim()
    const score = readinessScore(assessor, heightM)

    const fieldStatus = {
      building_id: 'available', apn: 'available',
      address: 'available', building_name: 'not_sourced',
      longitude: 'available', latitude: 'available',
      height_meters: heightM ? 'available' : 'pending',
      floor_count: floorCount ? 'available' : 'pending',
      footprint_sqm: footprintSqm ? 'available' : 'pending',
      parcel_geometry: 'available',
      zoning_code: assessor?.zoning_code ? 'available' : 'pending',
      zoning_height_limit: 'pending',
      building_use: assessor?.use_definition ? 'available' : 'pending',
      secondary_use: 'pending', building_class: 'pending',
      occupancy_type: 'pending',
      permit_count: 'pending',
      last_renovated: assessor?.year_property_built ? 'available' : 'pending',
      assessed_value: assessor?.assessed_improvement_value ? 'available' : 'pending',
      ownership_type: 'pending',
      energy_use_intensity: 'pending', sustainability_rating: 'pending',
      flood_risk: 'pending', heat_island_index: 'pending', solar_potential: 'pending',
      redevelopment_potential: 'ai_derived', economic_activity_index: 'ai_derived',
      sustainability_score: 'ai_derived', carbon_emissions: 'ai_derived',
      readiness_score: 'ai_derived', readiness_label: 'ai_derived',
      schema_version: 'available', completeness_pct: 'available',
      nextspace_ready: 'available', last_updated: 'available',
    }

    return {
      building_id: `CC3D-${blklot}`,
      apn: blklot,
      address,
      building_name: null,
      longitude: parseFloat(lng.toFixed(6)),
      latitude: parseFloat(lat.toFixed(6)),
      height_meters: heightM,
      floor_count: floorCount,
      footprint_sqm: footprintSqm,
      parcel_geometry: null,
      zoning_code: assessor?.zoning_code ?? null,
      zoning_height_limit: null,
      building_use: assessor?.use_definition ?? attrs.zoning_cod ?? null,
      secondary_use: null, building_class: null, occupancy_type: null,
      permit_count: null,
      last_renovated: assessor?.year_property_built ? parseInt(assessor.year_property_built) : null,
      assessed_value: assessor?.assessed_improvement_value ? parseInt(assessor.assessed_improvement_value) : null,
      ownership_type: null,
      energy_use_intensity: null, sustainability_rating: null,
      flood_risk: null, heat_island_index: null, solar_potential: null,
      redevelopment_potential: null, economic_activity_index: null,
      sustainability_score: null, carbon_emissions: null,
      readiness_score: score,
      readiness_label: readinessLabel(score),
      schema_version: '1.0',
      data_sources: ['ArcGIS Parcels', 'SF Assessor', 'SF Building Footprints'],
      last_updated: new Date().toISOString().split('T')[0],
      completeness_pct: score,
      nextspace_ready: score >= 60,
      field_status: fieldStatus,
    }
  })

  const output = JSON.stringify(buildings, null, 2)
  writeFileSync('public/data/sf-buildings.json', output)
  console.log(`\n✓ Generated ${buildings.length} buildings → public/data/sf-buildings.json`)
  console.log(`  PRIME: ${buildings.filter(b => b.readiness_label === 'PRIME').length}`)
  console.log(`  HIGH:  ${buildings.filter(b => b.readiness_label === 'HIGH').length}`)
  console.log(`  WATCH: ${buildings.filter(b => b.readiness_label === 'WATCH').length}`)
  console.log(`  LOW:   ${buildings.filter(b => b.readiness_label === 'LOW').length}`)
}

main().catch(console.error)
