import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { CityPulseLogo } from "../components/Icons";
import { DISTRICTS, DEFAULT_DISTRICT } from "../districts";
import type { DistrictConfig } from "../districts";

interface HomeProps {
  onNavigate: (page: string) => void;
  onGenerate: (district: DistrictConfig) => void;
  loading: boolean;
  error: string | null;
}

const LOADING_MESSAGES = [
  "Connecting to DataSF…",
  "Pulling live permit data…",
  "Analyzing development pipeline…",
  "Generating AI briefing…",
  "Compiling charts…",
  "Almost ready…",
];

const DISTRICT_LIST = Object.values(DISTRICTS);

export function Home({ onGenerate, loading, error }: HomeProps) {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictConfig>(DEFAULT_DISTRICT);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!loading) { setMsgIndex(0); return; }
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.cream,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
      position: "relative",
    }}>
      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(250,248,245,0.92)",
          backdropFilter: "blur(6px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            animation: "pulse-glow 2s ease-in-out infinite",
            marginBottom: 36,
          }}>
            <CityPulseLogo size={80} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: COLORS.orange, opacity: 0.3,
                animation: `dot-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
              }} />
            ))}
          </div>

          <p style={{
            fontFamily: FONTS.body, fontSize: 16, fontWeight: 600,
            color: COLORS.charcoal, textAlign: "center", minHeight: 24,
          }}>
            {LOADING_MESSAGES[msgIndex]}
          </p>
          <p style={{
            fontFamily: FONTS.body, fontSize: 13, fontWeight: 500,
            color: COLORS.warmGray, marginTop: 10,
          }}>
            This may take a few seconds
          </p>

          <div style={{
            width: "min(240px, 80vw)", height: 4, background: COLORS.lightBorder,
            borderRadius: 2, marginTop: 24, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, ${COLORS.orange}, ${COLORS.orangeSoft})`,
              borderRadius: 2,
              animation: "progress-sweep 14s ease-in-out forwards",
            }} />
          </div>

          <style>{`
            @keyframes pulse-glow {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 20px rgba(212,100,59,0.15)); }
              50% { transform: scale(1.06); filter: drop-shadow(0 6px 28px rgba(212,100,59,0.3)); }
            }
            @keyframes dot-bounce {
              0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
              40% { opacity: 1; transform: scale(1.2); }
            }
            @keyframes progress-sweep {
              0% { width: 0%; }
              20% { width: 25%; }
              50% { width: 55%; }
              80% { width: 85%; }
              100% { width: 98%; }
            }
          `}</style>
        </div>
      )}

      <div style={{
        marginBottom: 40,
        filter: "drop-shadow(0 6px 24px rgba(212,100,59,0.2))",
      }}>
        <CityPulseLogo size={72} />
      </div>

      <h1 style={{
        fontFamily: FONTS.heading,
        fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 800,
        color: COLORS.charcoal, textAlign: "center",
        lineHeight: 1.05, letterSpacing: "-0.02em",
        marginBottom: 16, maxWidth: 600,
      }}>
        CityPulse
        <br />
        <span style={{ color: COLORS.orange }}>San Francisco</span>
      </h1>

      <p style={{
        color: COLORS.midGray, fontSize: 17,
        textAlign: "center", maxWidth: 440,
        lineHeight: 1.6, marginBottom: 44, fontFamily: FONTS.body,
      }}>
        Live permit, planning, and development intelligence across all 11 SF Supervisor Districts.
      </p>

      {/* District selector */}
      <div style={{ width: "100%", maxWidth: 860, marginBottom: 36 }}>
        <p style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 14, textAlign: "center",
        }}>
          Select a Supervisor District
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(155px, 100%), 1fr))",
          gap: 10,
        }}>
          {DISTRICT_LIST.map(d => {
            const isSelected = selectedDistrict.number === d.number;
            return (
              <button
                key={d.number}
                onClick={() => setSelectedDistrict(d)}
                disabled={loading}
                style={{
                  background: isSelected ? COLORS.orangePale : COLORS.white,
                  border: `1.5px solid ${isSelected ? COLORS.orange : COLORS.lightBorder}`,
                  borderRadius: 16,
                  padding: "16px 14px",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                  boxShadow: isSelected
                    ? "0 4px 16px rgba(212,100,59,0.12)"
                    : "0 1px 4px rgba(0,0,0,0.04)",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <div style={{
                  fontFamily: "'Urbanist', sans-serif",
                  fontSize: 26, fontWeight: 800,
                  color: isSelected ? COLORS.orange : COLORS.charcoal,
                  lineHeight: 1, marginBottom: 2,
                  letterSpacing: "-0.02em",
                }}>{d.number}</div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10,
                  fontWeight: 700, color: isSelected ? COLORS.orange : COLORS.warmGray,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  marginBottom: 5,
                }}>District</div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 11,
                  color: isSelected ? COLORS.charcoal : COLORS.warmGray,
                  lineHeight: 1.45, fontWeight: 500,
                }}>
                  {d.neighborhoods.map(n => n.name).join(" · ")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onGenerate(selectedDistrict)}
        disabled={loading}
        style={{
          background: loading ? COLORS.warmGray : COLORS.orange,
          color: COLORS.white, border: "none", borderRadius: 32,
          padding: "16px 40px", fontSize: 16, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: FONTS.heading,
          boxShadow: loading ? "none" : "0 4px 20px rgba(212,100,59,0.25)",
          transition: "transform 0.2s, box-shadow 0.2s, background 0.3s",
          letterSpacing: "0.01em", opacity: loading ? 0.6 : 1,
        }}>
        {loading ? "Generating…" : `Generate ${selectedDistrict.label} Briefing →`}
      </button>

      {error && (
        <div style={{
          marginTop: 20, background: "#FDEEEE", border: "1px solid #F0C8C8",
          borderRadius: 12, padding: "12px 20px", color: "#B44040",
          fontSize: 13, fontFamily: FONTS.body, maxWidth: 440, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
