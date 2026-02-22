import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateBriefing } from '../services/briefing';
import { DISTRICT_3_NEIGHBORHOODS } from '../components/NeighborhoodFilterBar';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const { text: briefingText, data: aggregatedData } = await generateBriefing();
      navigate('/briefing', { state: { briefingText, aggregatedData } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1B4F72',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <img
          src="/CityPulse_Logo1_Fun.png"
          alt="CityPulse"
          style={{ width: '380px', display: 'block', margin: '0 auto' }}
        />
      </div>

      <div style={{ maxWidth: '520px', width: '100%' }}>
        {/* Neighborhood preview cards */}
        <p
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: '10px',
            textAlign: 'center',
          }}
        >
          SF District 3 Neighborhoods
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          {DISTRICT_3_NEIGHBORHOODS.map((n) => (
            <div
              key={n.zip}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px 14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{n.icon}</span>
              <span
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '12px',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {n.name}
              </span>
              <span
                style={{
                  color: 'rgba(255,255,255,0.25)',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                }}
              >
                {n.zip}
              </span>
            </div>
          ))}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px 24px',
            background: loading ? 'rgba(46,134,193,0.5)' : '#2E86C1',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.15s ease',
          }}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Generating briefing…
            </>
          ) : (
            'Generate District 3 Briefing'
          )}
        </button>

        {error && (
          <div
            style={{
              marginTop: '16px',
              background: 'rgba(231,76,60,0.15)',
              border: '1px solid rgba(231,76,60,0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#E74C3C',
              fontSize: '13px',
              textAlign: 'left',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <p style={{ marginTop: '32px', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
        Powered by DataSF · Claude claude-sonnet-4-6
      </p>
    </div>
  );
}
