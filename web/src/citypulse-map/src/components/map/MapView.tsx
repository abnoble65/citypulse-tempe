import { useEffect, useRef, useMemo, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMapStore, type ViewMode } from '../../store/mapStore'
import { useBuildings, useEnrichedBuildings, useBuildingById, buildingsToGeoJSON } from '../../hooks/useBuildings'
import { useMapUrl } from '../../hooks/useMapUrl'
import { AttributeInspector } from './AttributeInspector'
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
  '2.5d': { pitch: 45, bearing: -8 },
  '3d':   { pitch: 70, bearing: -8 },
  'flat': { pitch:  0, bearing: -8 },
}

// ── Toolbar ────────────────────────────────────────────────────────────────────
function ViewToggle() {
  const { viewMode, setViewMode, readinessFilter, setReadinessFilter } = useMapStore()

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    border: '1px solid var(--color-border-secondary)',
    borderRadius: 4,
    background: active ? 'var(--color-text-primary)' : 'var(--color-background-primary)',
    color:       active ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
  })

  const filterStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 500,
    border: `1.5px solid ${active ? color : 'var(--color-border-secondary)'}`,
    borderRadius: 4,
    background: active ? color : 'var(--color-background-primary)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    cursor: 'pointer',
  })

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      zIndex: 10,
    }}>
      {/* View mode */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-background-primary)', borderRadius: 6, padding: 4, border: '1px solid var(--color-border-tertiary)' }}>
        {(['2.5d', '3d', 'flat'] as ViewMode[]).map((m) => (
          <button key={m} style={btnStyle(viewMode === m)} onClick={() => setViewMode(m)}>{m}</button>
        ))}
      </div>
      {/* Readiness filter */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['PRIME', 'HIGH', 'WATCH', 'LOW'] as const).map((r) => {
          const colors = { PRIME: '#1D9E75', HIGH: '#BA7517', WATCH: '#D85A30', LOW: '#888780' }
          return (
            <button
              key={r}
              style={filterStyle(readinessFilter === r, colors[r])}
              onClick={() => setReadinessFilter(readinessFilter === r ? 'all' : r)}
            >
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
    { label: 'PRIME', color: '#1D9E75', sub: '≥ 80' },
    { label: 'HIGH',  color: '#BA7517', sub: '60–79' },
    { label: 'WATCH', color: '#D85A30', sub: '40–59' },
    { label: 'LOW',   color: '#888780', sub: '< 40'  },
  ]
  return (
    <div style={{
      position: 'absolute',
      bottom: 32,
      left: 12,
      background: 'var(--color-background-primary)',
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 8,
      padding: '8px 12px',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>
        Readiness
      </div>
      {items.map((i) => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: i.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: i.color }}>{i.label}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{i.sub}</span>
        </div>
      ))}
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
      style: 'mapbox://styles/mapbox/light-v11',
      center: SF_CENTER,
      zoom: SF_ZOOM,
      pitch: VIEW_CAMERA['2.5d'].pitch,
      bearing: VIEW_CAMERA['2.5d'].bearing,
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

      // Click on empty space — deselect
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] })
        if (!features.length) selectBuilding(null, null)
      })

      // Cursor
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
    if (!map) return
    map.easeTo({ ...VIEW_CAMERA[viewMode], duration: 600 })
  }, [viewMode])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Map canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        <ViewToggle />
        <Legend />

        {isEnriching && !isLoading && (
          <div style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)',
            borderRadius: 6,
            padding: '5px 14px',
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            zIndex: 20,
          }}>
            Fetching parcel boundaries from DataSF…
          </div>
        )}

        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
          }}>
            Loading SF buildings…
          </div>
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
        width: displayBuilding ? 320 : 0,
        overflow: 'hidden',
        transition: 'width 0.3s ease',
        borderLeft: '1px solid var(--color-border-tertiary)',
        background: 'var(--color-background-primary)',
      }}>
        {displayBuilding && <AttributeInspector building={displayBuilding} />}
      </div>
    </div>
  )
}
