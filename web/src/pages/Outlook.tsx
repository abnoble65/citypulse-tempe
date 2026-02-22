import { useLocation, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { parseBriefingSections, type DistrictData } from '../services/briefing';

export default function Outlook() {
  const { state } = useLocation() as { state?: { briefingText?: string; aggregatedData?: DistrictData } };
  const navigate = useNavigate();
  const briefingText = state?.briefingText ?? '';
  const aggregatedData = state?.aggregatedData;
  const sections = parseBriefingSections(briefingText);

  return (
    <div style={{ minHeight: '100vh', background: '#1B4F72' }}>
      <NavBar briefingText={briefingText} aggregatedData={aggregatedData} />

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>
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
            The Outlook
          </h1>
        </div>

        {sections.outlook ? (
          <>
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
                {sections.outlook}
              </p>
            </div>

            {/* Generate new briefing */}
            <div
              style={{
                marginTop: '28px',
                background: 'rgba(46,134,193,0.1)',
                border: '1px solid rgba(46,134,193,0.2)',
                borderRadius: '14px',
                padding: '24px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: '15px', margin: '0 0 4px' }}>
                  Want fresh intelligence?
                </p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
                  Run a new briefing to pull the latest DataSF data.
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                style={{
                  background: '#2E86C1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                New Briefing
              </button>
            </div>

            {/* Back nav */}
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => navigate('/signals', { state: { briefingText, aggregatedData } })}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Signals &amp; Zoning
              </button>
            </div>
          </>
        ) : (
          <EmptyState onHome={() => navigate('/')} />
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
