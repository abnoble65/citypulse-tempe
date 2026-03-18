import React, { useMemo, useState } from 'react'
import type { BuildingEntity, FieldStatus } from '../../types/building'
import { useMapStore } from '../../store/mapStore'
import { syncBuilding } from '../../services/nextspaceSyncService'

const CP = {
  navy:  '#0F1F2E',
  teal:  '#1D9E75',
  sand:  '#F5F2ED',
  stone: '#E8E4DC',
  muted: '#6B7280',
  prime: '#1D9E75',
  high:  '#BA7517',
  watch: '#D85A30',
  low:   '#888780',
}

const STATUS_CONFIG: Record<FieldStatus, { label: string; color: string; bg: string }> = {
  available:   { label: 'ready', color: '#0F6E56', bg: '#E1F5EE' },
  ai_derived:  { label: 'AI',    color: '#0C447C', bg: '#E6F1FB' },
  pending:     { label: 'S7',    color: '#854F0B', bg: '#FAEEDA' },
  not_sourced: { label: 'gap',   color: '#5F5E5A', bg: '#F1EFE8' },
}

const READINESS_COLOR: Record<string, string> = {
  PRIME: CP.prime, HIGH: CP.high, WATCH: CP.watch, LOW: CP.low,
}

const FIELD_GROUPS: { label: string; fields: (keyof BuildingEntity)[] }[] = [
  { label: 'Identity',      fields: ['building_id', 'apn', 'address', 'building_name'] },
  { label: 'Geometry',      fields: ['height_meters', 'floor_count', 'footprint_sqm'] },
  { label: 'Regulation',    fields: ['zoning_code', 'zoning_height_limit', 'building_use', 'secondary_use', 'building_class', 'occupancy_type'] },
  { label: 'Civic',         fields: ['permit_count', 'last_renovated', 'assessed_value', 'ownership_type', 'energy_use_intensity', 'sustainability_rating'] },
  { label: 'Environmental', fields: ['flood_risk', 'heat_island_index', 'solar_potential'] },
  { label: 'AI signals',    fields: ['readiness_score', 'readiness_label', 'redevelopment_potential', 'economic_activity_index', 'sustainability_score', 'carbon_emissions'] },
  { label: 'Provenance',    fields: ['schema_version', 'completeness_pct', 'nextspace_ready', 'last_updated'] },
]

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (key === 'assessed_value') return `${Number(value).toLocaleString()}`
  if (key === 'height_meters') return `${value}m`
  if (key === 'zoning_height_limit') return `${value}m`
  if (key === 'energy_use_intensity') return `${value} kBtu/ft²`
  if (key === 'carbon_emissions') return `${Number(value).toLocaleString()} MT CO₂`
  if (key === 'footprint_sqm') return `${Number(value).toLocaleString()} m²`
  if (key === 'redevelopment_potential' || key === 'completeness_pct') return `${value}%`
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function SectionCard({
  label, fields, building, showPending, defaultOpen = true
}: {
  label: string
  fields: (keyof BuildingEntity)[]
  building: BuildingEntity
  showPending: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const rows = fields
    .map(f => ({
      key: f as string,
      value: building[f],
      status: (building.field_status[f as string] ?? 'not_sourced') as FieldStatus,
    }))
    .filter(r => showPending || r.status === 'available' || r.status === 'ai_derived')

  if (rows.length === 0) return null

  return (
    <div style={{
      margin: '0 10px 8px',
      background: '#fff',
      borderRadius: 8,
      border: '1px solid #E8E4DC',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 10px',
          background: open ? CP.navy : '#F5F2ED',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: open ? '#fff' : CP.navy,
          flex: 1,
          textAlign: 'left',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 9,
          color: open ? 'rgba(255,255,255,0.5)' : CP.muted,
          fontWeight: 500,
        }}>
          {rows.length} fields {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Rows */}
      {open && (
        <div>
          {rows.map((r, i) => {
            const cfg = STATUS_CONFIG[r.status]
            const display = formatValue(r.key, r.value)
            const isEmpty = !display
            return (
              <div
                key={r.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 10px',
                  gap: 8,
                  background: i % 2 === 0 ? '#fff' : '#FAFAF9',
                  borderTop: '1px solid #F0ECE6',
                }}
              >
                <div style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: cfg.color,
                  flexShrink: 0,
                }} />
                <span style={{
                  flex: 1,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: isEmpty ? '#aaa' : CP.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {r.key}
                </span>
                <span style={{
                  fontSize: 11,
                  color: isEmpty ? '#ccc' : CP.navy,
                  fontWeight: isEmpty ? 400 : 500,
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}>
                  {display || '—'}
                </span>
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: cfg.bg,
                  color: cfg.color,
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface AttributeInspectorProps {
  building: BuildingEntity
}

export function AttributeInspector({ building }: AttributeInspectorProps) {
  const { showPendingFields, togglePendingFields, queueForSync } = useMapStore()
  const [syncing, setSyncing] = React.useState(false)
  const [syncDone, setSyncDone] = React.useState(false)

  const counts = useMemo(() => {
    const all = Object.values(building.field_status)
    return {
      available:   all.filter(s => s === 'available').length,
      ai_derived:  all.filter(s => s === 'ai_derived').length,
      pending:     all.filter(s => s === 'pending').length,
      not_sourced: all.filter(s => s === 'not_sourced').length,
    }
  }, [building])

  const readyCount = counts.available + counts.ai_derived
  const rlColor = READINESS_COLOR[building.readiness_label] ?? CP.low

  async function handleSync() {
    setSyncing(true)
    queueForSync(building.building_id)
    await syncBuilding(building)
    setSyncing(false)
    setSyncDone(true)
    setTimeout(() => setSyncDone(false), 3000)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: CP.sand,
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* Header card */}
      <div style={{
        background: CP.navy,
        padding: '14px 14px 12px',
        flexShrink: 0,
      }}>
        {/* Readiness badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 10,
            background: rlColor,
            color: '#fff',
          }}>
            {building.readiness_label}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
            {building.apn}
          </span>
        </div>

        {/* Building name */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          {building.building_name || building.address}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
          {building.address}
        </div>

        {/* Completeness bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>Data completeness</span>
          <span style={{ color: rlColor, fontWeight: 700 }}>{building.completeness_pct}%</span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${building.completeness_pct}%`, background: rlColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[
            { n: counts.available,   label: 'ready', color: '#1D9E75', bg: 'rgba(29,158,117,0.15)' },
            { n: counts.ai_derived,  label: 'AI',    color: '#378ADD', bg: 'rgba(55,138,221,0.15)' },
            { n: counts.pending,     label: 'S7',    color: '#BA7517', bg: 'rgba(186,117,23,0.15)' },
            { n: counts.not_sourced, label: 'gap',   color: '#888780', bg: 'rgba(136,135,128,0.15)' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1,
              background: s.bg,
              borderRadius: 5,
              padding: '4px 6px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.n}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        background: CP.stone,
        borderBottom: '1px solid #DDD9D0',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: CP.muted, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Field attributes
        </span>
        <button
          onClick={togglePendingFields}
          style={{
            fontSize: 9,
            padding: '2px 8px',
            border: `1px solid ${CP.muted}`,
            borderRadius: 10,
            background: 'transparent',
            color: CP.muted,
            cursor: 'pointer',
            letterSpacing: '0.03em',
          }}
        >
          {showPendingFields ? 'Hide gaps' : 'Show gaps'}
        </button>
      </div>

      {/* Scrollable cards */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 }}>
        {FIELD_GROUPS.map((g, i) => (
          <SectionCard
            key={g.label}
            label={g.label}
            fields={g.fields}
            building={building}
            showPending={showPendingFields}
            defaultOpen={i < 2}
          />
        ))}
      </div>

      {/* Sync footer */}
      <div style={{
        padding: '10px 10px',
        background: CP.stone,
        borderTop: '1px solid #DDD9D0',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: CP.navy }}>{readyCount} fields ready</div>
          <div style={{ fontSize: 9, color: CP.muted }}>of {Object.keys(building.field_status).length} total</div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !building.nextspace_ready}
          style={{
            padding: '7px 16px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 7,
            border: 'none',
            background: syncDone ? CP.teal : building.nextspace_ready ? CP.navy : '#ccc',
            color: '#fff',
            cursor: building.nextspace_ready ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {syncing ? 'Syncing…' : syncDone ? `✓ ${readyCount} sent` : '↑ Send to Nextspace'}
        </button>
      </div>
    </div>
  )
}
