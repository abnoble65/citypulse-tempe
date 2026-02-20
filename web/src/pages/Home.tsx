import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateBriefing } from '../services/briefing';

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
      {/* Logo / brand */}
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            background: '#2E86C1',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            padding: '4px 12px',
            borderRadius: '20px',
            marginBottom: '16px',
          }}
        >
          SF District 3
        </span>
        <img
          src="/CityPulse_Logo1_Fun.png"
          alt="CityPulse"
          style={{ width: '180px', display: 'block', margin: '0 auto' }}
        />
      </div>

      {/* Card */}
      <div
        style={{
          marginTop: '40px',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '36px 40px',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
          Pulls live permit data, development pipeline, and zoning context from DataSF, then generates
          a narrative district intelligence briefing via Claude.
        </p>

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
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
            'Generate Briefing'
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

      {/* Footer hint */}
      <p style={{ marginTop: '32px', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
        Powered by DataSF · Claude claude-sonnet-4-6
      </p>
    </div>
  );
}
