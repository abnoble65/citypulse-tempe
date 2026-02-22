import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateBriefing } from '../services/briefing';

interface Neighborhood {
  name: string;
  zip: string;
  icon: string;
  subtitle: string;
}

const NEIGHBORHOODS: Neighborhood[] = [
  { name: 'North Beach / Telegraph Hill', zip: '94133', icon: '⛵', subtitle: '94133' },
  { name: 'Financial District / Jackson Square', zip: '94111', icon: '🏦', subtitle: '94111' },
  { name: 'Chinatown / Nob Hill', zip: '94108', icon: '🏮', subtitle: '94108' },
  { name: 'Russian Hill', zip: '94109', icon: '🌉', subtitle: '94109' },
];

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);

  const selectedNeighborhood = NEIGHBORHOODS.find((n) => n.zip === selectedZip) ?? null;

  async function handleGenerate() {
    if (!selectedZip || !selectedNeighborhood) return;
    setLoading(true);
    setError(null);
    try {
      const { text: briefingText, data: aggregatedData } = await generateBriefing();
      navigate('/briefing', {
        state: { briefingText, aggregatedData, selectedZip, selectedNeighborhood: selectedNeighborhood.name },
      });
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

      {/* Neighborhood selector */}
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: '12px',
            textAlign: 'center',
          }}
        >
          Select a Neighborhood
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          {NEIGHBORHOODS.map((n) => {
            const selected = selectedZip === n.zip;
            return (
              <button
                key={n.zip}
                onClick={() => setSelectedZip(n.zip)}
                style={{
                  background: selected ? 'rgba(46,134,193,0.2)' : 'rgba(255,255,255,0.06)',
                  border: selected ? '2px solid #2E86C1' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '14px',
                  padding: '20px 16px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '28px', lineHeight: 1 }}>{n.icon}</span>
                <span
                  style={{
                    color: selected ? '#fff' : 'rgba(255,255,255,0.75)',
                    fontSize: '13px',
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  {n.name}
                </span>
                <span
                  style={{
                    color: selected ? '#2E86C1' : 'rgba(255,255,255,0.35)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                  }}
                >
                  {n.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedZip}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: !selectedZip ? 'rgba(46,134,193,0.25)' : loading ? 'rgba(46,134,193,0.5)' : '#2E86C1',
            color: !selectedZip ? 'rgba(255,255,255,0.35)' : '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: !selectedZip || loading ? 'not-allowed' : 'pointer',
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

      {/* Footer */}
      <p style={{ marginTop: '32px', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
        Powered by DataSF · Claude claude-sonnet-4-6
      </p>
    </div>
  );
}
