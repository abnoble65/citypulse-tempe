import { useEffect, useRef, useMemo, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMapStore, type ViewMode } from '../../store/mapStore'
import { useBuildings, useEnrichedBuildings, useBuildingById, buildingsToGeoJSON } from '../../hooks/useBuildings'
import { useMapUrl } from '../../hooks/useMapUrl'
import { AttributeInspector } from './AttributeInspector'
import { UnknownParcelPanel } from './UnknownParcelPanel'
import type { BuildingEntity } from '../../types/building'

// ── Mapbox token ───────────────────────────────────────────────────────────────
// Phase 1: set VITE_MAPBOX_TOKEN in .env.local
// Phase 3: rotate to a restricted token scoped to your domain
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

// ── Constants ──────────────────────────────────────────────────────────────────
const SOURCE_ID   = 'citypulse-buildings'
const LAYER_ID    = 'buildings-extrusion'
const SF_CENTER: [number, number] = [-122.398, 37.791]
const SF_ZOOM     = 14.5

const PARCEL_SOURCE_ID   = 'arcgis-parcels'
const PARCEL_OUTLINE_ID  = 'arcgis-parcel-lines'
const PARCEL_FILL_ID     = 'arcgis-parcel-fill'
const ARCGIS_PARCELS_URL = 'https://services8.arcgis.com/SeelVoY3qN5dU7fD/arcgis/rest/services/Parcels___Active_and_Retired/FeatureServer/0/query'

// Maps readiness label → colour.
// Used in a Mapbox match expression — if the label changes in BuildingEntity,
// update it here too.
const READINESS_COLORS = [
  'match',
  ['get', 'readiness_label'],
  'PRIME', '#1D9E75',
  'HIGH',  '#BA7517',
  'WATCH', '#D85A30',
  /* default */ '#888780',    // LOW
] as mapboxgl.Expression

// Selected building gets a blue highlight
function buildColorExpression(selectedId: string | null): mapboxgl.Expression {
  if (!selectedId) return READINESS_COLORS
  return [
    'case',
    ['==', ['get', 'building_id'], selectedId],
    '#185FA5',   // blue — selected
    READINESS_COLORS,
  ] as mapboxgl.Expression
}

// ── View mode → pitch / bearing ────────────────────────────────────────────────
const VIEW_CAMERA: Record<ViewMode, { pitch: number; bearing: number }> = {
  '2d':   { pitch:  0, bearing:  0 },
  '3d':   { pitch: 70, bearing: -8 },
}

// ── ArcGIS point query for unknown parcels ──────────────────────────────────
async function queryParcelAtPoint(lng: number, lat: number) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'blklot,from_addre,to_addre,street_nam,street_typ,land_use,shape_area',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const url = `https://services8.arcgis.com/SeelVoY3qN5dU7fD/arcgis/rest/services/Parcels___Active_and_Retired/FeatureServer/0/query?${params}`

  try {
    const res = await fetch(url)
    const fc = await res.json()
    const feature = fc?.features?.[0]
    if (!feature) return

    const attrs = feature.properties
    const blklot = attrs.blklot
    const address = `${attrs.from_addre} ${attrs.street_nam} ${attrs.street_typ}`

    // Check if this parcel matches a known building
    const known = useMapStore.getState().buildings?.find(b => b.apn === blklot)
    if (known) {
      useMapStore.getState().selectBuilding(known.building_id, known)
      return
    }

    // Show lightweight unknown parcel panel
    useMapStore.getState().selectUnknownParcel({
      blklot,
      address,
      land_use: attrs.land_use,
      shape_area: attrs.shape_area,
      geometry: feature.geometry,
    })
  } catch (err) {
    console.warn('[MapView] Parcel query failed:', err)
  }
}

// ── Fetch all ArcGIS parcels visible in the current viewport ─────────────────
let parcelFetchTimeout: ReturnType<typeof setTimeout> | null = null
let lastSelectedParcelId: string | null = null

function fetchParcelsInView(map: mapboxgl.Map) {
  if (map.getZoom() < 14) {
    ;(map.getSource(PARCEL_SOURCE_ID) as mapboxgl.GeoJSONSource)
      .setData({ type: 'FeatureCollection', features: [] })
    return
  }

  const bounds = map.getBounds()
  const geometry = {
    xmin: bounds.getWest(),
    ymin: bounds.getSouth(),
    xmax: bounds.getEast(),
    ymax: bounds.getNorth(),
    spatialReference: { wkid: 4326 }
  }

  const url = new URL(ARCGIS_PARCELS_URL)
  url.searchParams.set('geometry', JSON.stringify(geometry))
  url.searchParams.set('geometryType', 'esriGeometryEnvelope')
  url.searchParams.set('inSR', '4326')
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  url.searchParams.set('outFields', 'blklot,from_addre,street_nam,street_typ,land_use,shape_area')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultRecordCount', '200')
  url.searchParams.set('f', 'json')

  fetch(url.toString())
    .then((r) => r.json())
    .then((esriJson) => {
      if (esriJson.error) {
        console.warn('[MapView] ArcGIS error:', esriJson.error)
        return
      }
      if (!map.getSource(PARCEL_SOURCE_ID)) return
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: (esriJson.features ?? []).map((f: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: f.geometry?.rings ?? [],
          },
          properties: f.attributes,
        })),
      }
      console.log('[MapView] Parcels loaded:', geojson.features.length)
      ;(map.getSource(PARCEL_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson)
    })
    .catch((err) => console.warn('[MapView] Parcel fetch failed:', err))
}

// ── CityPulse brand tokens ───────────────────────────────────────────────────
const CP = {
  navy:    '#0F1F2E',
  teal:    '#1D9E75',
  tealDim: '#0F6E56',
  sand:    '#F5F2ED',
  stone:   '#E8E4DC',
  muted:   '#6B7280',
  prime:   '#1D9E75',
  high:    '#BA7517',
  watch:   '#D85A30',
  low:     '#888780',
}

// ── Toolbar ────────────────────────────────────────────────────────────────────
function ViewToggle() {
  const { viewMode, setViewMode, readinessFilter, setReadinessFilter } = useMapStore()
  const is3d = viewMode === '3d'

  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: 14,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Brand header pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: CP.navy,
        borderRadius: 8,
        padding: '7px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: CP.teal,
        }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          CityPulse
        </span>
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
        {/* 2D/3D toggle */}
        <button
          onClick={() => setViewMode(is3d ? '2d' : '3d')}
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 5,
            padding: '2px',
            cursor: 'pointer',
            gap: 2,
          }}
        >
          {(['2d', '3d'] as const).map(m => (
            <span
              key={m}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 4,
                background: viewMode === m ? CP.teal : 'transparent',
                color: viewMode === m ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
              }}
            >
              {m.toUpperCase()}
            </span>
          ))}
        </button>
      </div>

      {/* Readiness filter pills */}
      <div style={{
        display: 'flex',
        gap: 4,
        background: 'rgba(255,255,255,0.92)',
        borderRadius: 8,
        padding: '5px 8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(8px)',
      }}>
        {(['PRIME', 'HIGH', 'WATCH', 'LOW'] as const).map((r) => {
          const color = { PRIME: CP.prime, HIGH: CP.high, WATCH: CP.watch, LOW: CP.low }[r]
          const active = readinessFilter === r
          return (
            <button
              key={r}
              onClick={() => setReadinessFilter(readinessFilter === r ? 'all' : r)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 600,
                border: 'none',
                borderRadius: 5,
                background: active ? color : 'transparent',
                color: active ? '#fff' : CP.muted,
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.03em',
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: active ? '#fff' : color,
                flexShrink: 0,
              }} />
              {r}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { label: 'PRIME', color: CP.prime, sub: '≥ 80' },
    { label: 'HIGH',  color: CP.high,  sub: '60–79' },
    { label: 'WATCH', color: CP.watch, sub: '40–59' },
    { label: 'LOW',   color: CP.low,   sub: '< 40'  },
  ]
  return (
    <div style={{
      position: 'absolute',
      bottom: 36,
      left: 14,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
      padding: '8px 10px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      zIndex: 10,
    }}>
      <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: CP.muted, marginBottom: 6 }}>
        Readiness score
      </div>
      {items.map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: i.color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: i.color, width: 38 }}>{i.label}</span>
          <span style={{ fontSize: 10, color: CP.muted }}>{i.sub}</span>
        </div>
      ))}
    </div>
  )
}

// ── Loading overlay ──────────────────────────────────────────────────────────
function LoadingOverlay({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const bars = [18, 28, 22, 36, 24, 32, 20, 26, 30, 16, 34, 22]

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(10,14,20,0.92)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }}>
      <style>{`
        @keyframes logoBreath {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.97); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(29,158,117,0.7); }
          50% { opacity: 0.8; transform: scale(1.3); box-shadow: 0 0 0 6px rgba(29,158,117,0); }
        }
        @keyframes barRise {
          0%, 100% { transform: scaleY(0.6); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes scanLine {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(500%); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(29,158,117,0.4); }
          50% { box-shadow: 0 0 12px rgba(29,158,117,0.8); }
        }
      `}</style>

      {/* Scan line effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(29,158,117,0.3), transparent)',
          animation: 'scanLine 3s ease-in-out infinite',
        }} />
      </div>

      {/* Logo — breathing pulse */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 36,
        animation: 'logoBreath 2s ease-in-out infinite',
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#1D9E75',
          animation: 'dotPulse 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          CityPulse
        </span>
      </div>

      {/* Animated skyline bars */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        marginBottom: 32,
        height: 44,
      }}>
        {bars.map((h, i) => {
          const isEnriched = total > 0 && i < (count / total) * bars.length
          const color = i % 3 === 0 ? '#1D9E75' : i % 3 === 1 ? '#BA7517' : 'rgba(255,255,255,0.15)'
          return (
            <div
              key={i}
              style={{
                width: 9,
                height: h,
                borderRadius: '2px 2px 0 0',
                background: isEnriched ? color : 'rgba(255,255,255,0.12)',
                transformOrigin: 'bottom',
                animation: `barRise 1.4s ease-in-out ${i * 0.1}s infinite`,
                transition: 'background 0.5s ease',
              }}
            />
          )
        })}
      </div>

      {/* Progress bar with glow */}
      <div style={{
        width: 260,
        marginBottom: 14,
        animation: 'fadeInUp 0.5s ease forwards',
      }}>
        <div style={{
          height: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.max(pct, 3)}%`,
            background: '#1D9E75',
            borderRadius: 2,
            transition: 'width 0.4s ease',
            animation: 'progressGlow 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Status text */}
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 5,
        letterSpacing: '0.02em',
        animation: 'fadeInUp 0.6s ease forwards',
      }}>
        {count === 0
          ? 'Connecting to data sources'
          : count < total
          ? `Enriching parcel boundaries — ${count} of ${total}`
          : 'Finalizing intelligence layer'
        }
      </div>
      <div style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: '0.04em',
      }}>
        {total > 0 ? `${pct}%` : 'Loading'}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function MapView() {
  useMapUrl()

  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const popupRef     = useRef<mapboxgl.Popup | null>(null)

  const {
    selectedBuildingId,
    selectedBuilding,
    selectBuilding,
    unknownParcel,
    viewMode,
    readinessFilter,
  } = useMapStore()

  const { data: buildings, isLoading, isFetching: isEnriching, error } = useEnrichedBuildings()
  const { data: hydratedBuilding } = useBuildingById(selectedBuildingId)

  // Keep inspector showing whichever is more current
  const displayBuilding: BuildingEntity | null = hydratedBuilding ?? selectedBuilding

  // GeoJSON — recomputed when buildings change or parcel geometry arrives
  const parcelKey = buildings
    ?.map(b => b.parcel_geometry ? b.building_id : '')
    .join(',') ?? ''

  const geojson = useMemo(
    () => buildings ? buildingsToGeoJSON(buildings) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parcelKey]
  )

  // Filter expression — null means show all
  const filterExpr: mapboxgl.Expression | null = useMemo(() => {
    if (readinessFilter === 'all') return null
    return ['==', ['get', 'readiness_label'], readinessFilter]
  }, [readinessFilter])

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: SF_CENTER,
      zoom: SF_ZOOM,
      pitch: 45,
      bearing: -8,
      antialias: true,
    })

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    map.on('load', () => {
      // Remove Mapbox default building layer to avoid overlap
      if (map.getLayer('building')) {
        map.removeLayer('building')
      }

      // ── Source ────────────────────────────────────────────────────────
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        generateId: false,
      })

      // ── Fill-extrusion layer ──────────────────────────────────────────
      map.addLayer({
        id: LAYER_ID,
        type: 'fill-extrusion',
        source: SOURCE_ID,
        paint: {
          'fill-extrusion-color':   READINESS_COLORS,
          'fill-extrusion-height':  ['get', 'height_meters'],
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.85,
        },
      })

      // ── ArcGIS parcel layer — all parcels in viewport ─────────────────
      map.addSource(PARCEL_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        generateId: true,
      })

      // Fill — invisible but captures clicks
      map.addLayer({
        id: PARCEL_FILL_ID,
        type: 'fill',
        source: PARCEL_SOURCE_ID,
        paint: {
          'fill-color': '#1D9E75',
          'fill-opacity': [
            'case',
            ['==', ['get', 'blklot'], ''],
            0,
            0.05,
          ],
        },
      })

      // Outline — visible parcel boundaries
      map.addLayer({
        id: PARCEL_OUTLINE_ID,
        type: 'line',
        source: PARCEL_SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#185FA5',
            '#888780',
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            14, 0.4,
            16, 0.8,
            18, 1.5,
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            13, 0,
            14, 0.6,
            16, 1,
          ],
        },
      })

      // Make sure CityPulse buildings render on top
      map.moveLayer(LAYER_ID)

      // Fetch parcels on load and after map moves
      fetchParcelsInView(map)
      map.on('moveend', () => {
        if (parcelFetchTimeout) clearTimeout(parcelFetchTimeout)
        parcelFetchTimeout = setTimeout(() => fetchParcelsInView(map), 300)
      })

      // ── Click handler ─────────────────────────────────────────────────
      map.on('click', LAYER_ID, (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const props = feature.properties as {
          building_id: string
          address: string
          readiness_label: string
          readiness_score: number
        }

        selectBuilding(props.building_id, null)

        // Fly to clicked building
        map.flyTo({
          center: [e.lngLat.lng, e.lngLat.lat] as [number, number],
          zoom: Math.max(map.getZoom(), 15.5),
          speed: 0.8,
        })
      })

      // Click on empty space — query ArcGIS for any parcel at this point
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] })

        // If clicked a known building, already handled by LAYER_ID click
        if (features.length) return

        // Otherwise query ArcGIS for any parcel at this point
        queryParcelAtPoint(e.lngLat.lng, e.lngLat.lat)
      })

      // ── Parcel fill click — select known building or show unknown panel ─
      map.on('click', PARCEL_FILL_ID, async (e) => {
        const feature = e.features?.[0]
        if (!feature) return

        const attrs = feature.properties as {
          blklot: string
          from_addre: string
          to_addre: string
          street_nam: string
          street_typ: string
          land_use: string
          shape_area: number
        }

        // Clear previous selection highlight
        if (lastSelectedParcelId) {
          map.setFeatureState(
            { source: PARCEL_SOURCE_ID, id: lastSelectedParcelId },
            { selected: false }
          )
        }
        lastSelectedParcelId = feature.id as string
        map.setFeatureState(
          { source: PARCEL_SOURCE_ID, id: feature.id as string },
          { selected: true }
        )

        const address = `${attrs.from_addre} ${attrs.street_nam} ${attrs.street_typ}`

        // Check if this matches a known CityPulse building
        const buildings = useMapStore.getState().buildings
        const known = buildings?.find(b => b.apn === attrs.blklot)
        if (known) {
          selectBuilding(known.building_id, known)
          return
        }

        // Show unknown parcel panel
        useMapStore.getState().selectUnknownParcel({
          blklot: attrs.blklot,
          address,
          land_use: attrs.land_use ?? null,
          shape_area: attrs.shape_area ?? null,
          geometry: feature.geometry,
        })
      })

      // Cursor on parcel hover
      map.on('mouseenter', PARCEL_FILL_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', PARCEL_FILL_ID, () => {
        map.getCanvas().style.cursor = ''
      })

      // Cursor on building hover
      map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = '' })

      // Address tooltip on hover
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -10],
        className: 'cp-popup',
      })

      map.on('mousemove', LAYER_ID, (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { address: string; readiness_label: string; readiness_score: number }
        const color = { PRIME: '#1D9E75', HIGH: '#BA7517', WATCH: '#D85A30', LOW: '#888780' }[p.readiness_label] ?? '#888'
        popupRef.current
          ?.setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-size:11px;font-family:var(--font-sans,sans-serif);padding:4px 0">
              <div style="font-weight:500;color:#111;margin-bottom:2px">${p.address}</div>
              <div style="color:${color};font-size:10px;font-weight:500">${p.readiness_label} · ${p.readiness_score}%</div>
            </div>
          `)
          .addTo(map)
      })

      map.on('mouseleave', LAYER_ID, () => { popupRef.current?.remove() })
    })

    mapRef.current = map
    ;(window as any).__cpMap = map
    return () => { map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update data when buildings load ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !geojson) return

    const applyData = () => {
      if (map.getSource(SOURCE_ID)) {
        ;(map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson)
      }
    }

    if (map.loaded()) {
      applyData()
    } else {
      map.once('load', applyData)
    }
  }, [geojson])

  // ── Highlight selected building ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(LAYER_ID)) return
    map.setPaintProperty(LAYER_ID, 'fill-extrusion-color', buildColorExpression(selectedBuildingId))
  }, [selectedBuildingId])

  // ── Apply readiness filter ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(LAYER_ID)) return
    map.setFilter(LAYER_ID, filterExpr ?? undefined)
  }, [filterExpr])

  // ── View mode camera ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(LAYER_ID)) return
    map.easeTo({ ...VIEW_CAMERA[viewMode], duration: 600 })
    map.setPaintProperty(
      LAYER_ID,
      'fill-extrusion-height',
      viewMode === '2d' ? 0 : ['get', 'height_meters']
    )
  }, [viewMode])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Map canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        <ViewToggle />
        <Legend />

        {(isLoading || isEnriching) && (
          <LoadingOverlay
            count={buildings?.filter(b => b.parcel_geometry !== null).length ?? 0}
            total={buildings?.length ?? 0}
          />
        )}

        {error && (
          <div style={{
            position: 'absolute',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#FCEBEB',
            color: '#A32D2D',
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #F7C1C1',
          }}>
            Failed to load buildings: {error.message}
          </div>
        )}
      </div>

      {/* Inspector panel */}
      <div style={{
        width: (displayBuilding || unknownParcel) ? 320 : 0,
        overflow: 'hidden',
        transition: 'width 0.3s ease',
        borderLeft: '1px solid var(--color-border-tertiary)',
        background: 'var(--color-background-primary)',
      }}>
        {displayBuilding
          ? <AttributeInspector building={displayBuilding} />
          : unknownParcel
          ? <UnknownParcelPanel parcel={unknownParcel} />
          : null
        }
      </div>
    </div>
  )
}
