export const DISTRICT_3_NEIGHBORHOODS = [
  { name: 'North Beach / Telegraph Hill', zip: '94133', icon: '⛵' },
  { name: 'Financial District / Jackson Square', zip: '94111', icon: '🏦' },
  { name: 'Chinatown / Nob Hill', zip: '94108', icon: '🏮' },
  { name: 'Russian Hill', zip: '94109', icon: '🌉' },
] as const;

interface Props {
  activeZip: string | null;
  onChange: (zip: string | null) => void;
}

export default function NeighborhoodFilterBar({ activeZip, onChange }: Props) {
  return (
    <div
      style={{
        background: '#154360',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {/* All District 3 pill */}
      <button
        onClick={() => onChange(null)}
        style={{
          background: activeZip === null ? '#2E86C1' : 'rgba(255,255,255,0.07)',
          color: activeZip === null ? '#fff' : 'rgba(255,255,255,0.6)',
          border: activeZip === null ? 'none' : '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          padding: '5px 14px',
          fontSize: '12px',
          fontWeight: activeZip === null ? 700 : 400,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          letterSpacing: '0.3px',
        }}
      >
        All District 3
      </button>

      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>|</span>

      {DISTRICT_3_NEIGHBORHOODS.map((n) => {
        const active = activeZip === n.zip;
        return (
          <button
            key={n.zip}
            onClick={() => onChange(n.zip)}
            style={{
              background: active ? 'rgba(46,134,193,0.25)' : 'rgba(255,255,255,0.05)',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
              border: active ? '1px solid rgba(46,134,193,0.5)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '13px' }}>{n.icon}</span>
            <span>{n.name.split(' / ')[0]}</span>
            <span style={{ opacity: 0.5, fontSize: '10px' }}>{n.zip}</span>
          </button>
        );
      })}
    </div>
  );
}
