import React, { useMemo } from 'react'
import type { BuildingEntity, FieldStatus } from '../../types/building'
import { useMapStore } from '../../store/mapStore'
import { syncBuilding } from '../../services/nextspaceSyncService'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FieldStatus, { label: string; color: string; bg: string }> = {
  available:   { label: 'ready',    color: '#0F6E56', bg: '#E1F5EE' },
  ai_derived:  { label: 'ai',       color: '#0C447C', bg: '#E6F1FB' },
  pending:     { label: 'sprint 7', color: '#854F0B', bg: '#FAEEDA' },
  not_sourced: { label: 'gap',      color: '#5F5E5A', bg: '#F1EFE8' },
}

const READINESS_COLOR: Record<string, string> = {
  PRIME: '#1D9E75',
  HIGH:  '#BA7517',
  WATCH: '#D85A30',
  LOW:   '#888780',
}

// ── Field groups — matches BuildingEntity sections ─────────────────────────────

const FIELD_GROUPS: { label: string; fields: (keyof BuildingEntity)[] }[] = [
  {
    label: 'Identity',
    fields: ['building_id', 'apn', 'address', 'building_name'],
  },
  {
    label: 'Geometry',
    fields: ['height_meters', 'floor_count', 'footprint_sqm'],
  },
  {
    label: 'Regulation',
    fields: ['zoning_code', 'zoning_height_limit', 'building_use', 'secondary_use', 'building_class', 'occupancy_type'],
  },
  {
    label: 'Civic intelligence',
    fields: ['permit_count', 'last_renovated', 'assessed_value', 'ownership_type', 'energy_use_intensity', 'sustainability_rating'],
  },
  {
    label: 'Environmental',
    fields: ['flood_risk', 'heat_island_index', 'solar_potential'],
  },
  {
    label: 'AI signals',
    fields: ['readiness_score', 'readiness_label', 'redevelopment_potential', 'economic_activity_index', 'sustainability_score', 'carbon_emissions'],
  },
  {
    label: 'Provenance',
    fields: ['schema_version', 'completeness_pct', 'nextspace_ready', 'last_updated'],
  },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FieldStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 500,
      padding: '1px 6px',
      borderRadius: 3,
      background: cfg.bg,
      color: cfg.color,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function FieldRow({
  fieldKey,
  value,
  status,
}: {
  fieldKey: string
  value: unknown
  status: FieldStatus
}) {
  const display = value === null || value === undefined
    ? null
    : typeof value === 'boolean'
    ? value ? 'true' : 'false'
    : Array.isArray(value)
    ? value.join(', ')
    : String(value)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 16px',
      borderBottom: '1px solid var(--color-border-tertiary)',
      minHeight: 30,
    }}>
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: STATUS_CONFIG[status].color,
        flexShrink: 0,
      }} />
      <span style={{
        flex: 1,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {fieldKey}
      </span>
      {display && (
        <span style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          maxWidth: 110,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {display}
        </span>
      )}
      <StatusBadge status={status} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

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
      available:   all.filter((s) => s === 'available').length,
      ai_derived:  all.filter((s) => s === 'ai_derived').length,
      pending:     all.filter((s) => s === 'pending').length,
      not_sourced: all.filter((s) => s === 'not_sourced').length,
    }
  }, [building])

  const readyCount = counts.available + counts.ai_derived
  const rlColor = READINESS_COLOR[building.readiness_label] ?? '#888780'

  async function handleSync() {
    setSyncing(true)
    queueForSync(building.building_id)
    await syncBuilding(building)
    setSyncing(false)
    setSyncDone(true)
    setTimeout(() => setSyncDone(false), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--color-border-tertiary)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, color: 'var(--color-text-primary)' }}>
          {building.address}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
          APN {building.apn} ·{' '}
          <span style={{ color: rlColor, fontWeight: 500 }}>{building.readiness_label}</span>
          {' · '}{building.readiness_score}% ready
        </div>

        {/* Completeness bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          <span>Data completeness</span>
          <span style={{ color: rlColor }}>{building.completeness_pct}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--color-border-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${building.completeness_pct}%`, background: rlColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Chips + controls */}
      <div style={{
        display: 'flex',
        gap: 5,
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-border-tertiary)',
        flexShrink: 0,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {Object.entries(counts).map(([st, n]) => {
          const cfg = STATUS_CONFIG[st as FieldStatus]
          return (
            <span key={st} style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>
              {n} {cfg.label}
            </span>
          )
        })}
        <button
          onClick={togglePendingFields}
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            padding: '2px 7px',
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          {showPendingFields ? 'hide gaps' : 'show gaps'}
        </button>
      </div>

      {/* Field list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {FIELD_GROUPS.map((group) => {
          const rows = group.fields
            .map((f) => ({
              key: f as string,
              value: building[f],
              status: building.field_status[f as string] ?? 'not_sourced',
            }))
            .filter((r) => showPendingFields || r.status === 'available' || r.status === 'ai_derived')

          if (rows.length === 0) return null

          return (
            <React.Fragment key={group.label}>
              <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                padding: '5px 16px',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
                background: 'var(--color-background-secondary)',
                borderBottom: '1px solid var(--color-border-tertiary)',
              }}>
                {group.label}
              </div>
              {rows.map((r) => (
                <FieldRow key={r.key} fieldKey={r.key} value={r.value} status={r.status} />
              ))}
            </React.Fragment>
          )
        })}
      </div>

      {/* Sync footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--color-border-tertiary)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flex: 1 }}>
          {readyCount} of {Object.keys(building.field_status).length} fields ready
        </span>
        <button
          onClick={handleSync}
          disabled={syncing || !building.nextspace_ready}
          style={{
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 6,
            border: syncDone ? '1.5px solid #1D9E75' : '1.5px solid var(--color-border-primary)',
            background: syncDone ? '#1D9E75' : 'transparent',
            color: syncDone ? '#fff' : building.nextspace_ready ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            cursor: building.nextspace_ready ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {syncing ? 'Syncing…' : syncDone ? `✓ ${readyCount} sent` : '↑ Send to Nextspace'}
        </button>
      </div>
    </div>
  )
}
