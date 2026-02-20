import { useLocation, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { parseBriefingSections, type DistrictData } from '../services/briefing';

export default function Briefing() {
  const { state } = useLocation() as { state?: { briefingText?: string; aggregatedData?: DistrictData } };
  const navigate = useNavigate();
  const briefingText = state?.briefingText ?? '';
  const aggregatedData = state?.aggregatedData;
  const sections = parseBriefingSections(briefingText);

  return (
    <div style={{ minHeight: '100vh', background: '#1B4F72' }}>
      <NavBar briefingText={briefingText} aggregatedData={aggregatedData} />

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/CityPulse_Logo1_Fun.png" alt="CityPulse" style={{ width: '280px' }} />
        </div>

        {/* Section label */}
        <div style={{ marginBottom: '24px' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(46,134,193,0.2)',
              border: '1px solid rgba(46,134,193,0.35)',
              color: '#2E86C1',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '4px 12px',
              borderRadius: '20px',
              marginBottom: '12px',
            }}
          >
            District 3 Intelligence
          </span>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            The Briefing
          </h1>
        </div>

        {/* Content card */}
        {sections.briefing ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '28px 32px',
            }}
          >
            <p
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '15px',
                lineHeight: 1.75,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {sections.briefing}
            </p>
          </div>
        ) : (
          <EmptyState onHome={() => navigate('/')} />
        )}

        {/* Next section link */}
        {sections.briefing && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => navigate('/charts', { state: { briefingText, aggregatedData } })}
              style={{
                background: '#2E86C1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Charts →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onHome }: { onHome: () => void }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '48px 32px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px', marginBottom: '20px' }}>
        No briefing data. Generate one from the home page.
      </p>
      <button
        onClick={onHome}
        style={{
          background: '#2E86C1',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Go to Home
      </button>
    </div>
  );
}
