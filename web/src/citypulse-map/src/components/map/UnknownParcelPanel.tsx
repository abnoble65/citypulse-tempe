import type { UnknownParcel } from '../../types/building'

function sendPrompt(message: string) {
  console.log('[UnknownParcelPanel] prompt:', message)
  // TODO: wire to CityPulse ingest pipeline
}

export function UnknownParcelPanel({ parcel }: { parcel: UnknownParcel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{parcel.address}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
          BLKLOT {parcel.blklot}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          Not yet in CityPulse
        </div>
      </div>
      <div style={{ padding: '8px 16px', flex: 1 }}>
        {parcel.land_use && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 3 }}>Land use</div>
            <div style={{ fontSize: 12 }}>{parcel.land_use}</div>
          </div>
        )}
        {parcel.shape_area && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 3 }}>Parcel area</div>
            <div style={{ fontSize: 12 }}>{Math.round(parcel.shape_area).toLocaleString()} sq ft</div>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border-tertiary)' }}>
        <button
          onClick={() => sendPrompt(`Add BLKLOT ${parcel.blklot} at ${parcel.address} to CityPulse`)}
          style={{
            width: '100%',
            padding: '6px 14px',
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 6,
            border: '1.5px solid #1D9E75',
            background: 'transparent',
            color: '#1D9E75',
            cursor: 'pointer',
          }}
        >
          + Add to CityPulse
        </button>
      </div>
    </div>
  )
}
