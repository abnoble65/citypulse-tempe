import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { CityPulseLogo } from "../components/Icons";

interface HomeProps {
  onNavigate: (page: string) => void;
  onGenerate: () => void;
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

export function Home({ onGenerate, loading, error }: HomeProps) {
  const [hovered, setHovered] = useState<number | null>(null);
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
          {/* Pulsing logo */}
          <div style={{
            animation: "pulse-glow 2s ease-in-out infinite",
            marginBottom: 36,
          }}>
            <CityPulseLogo size={80} />
          </div>

          {/* Animated dots */}
          <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: COLORS.orange, opacity: 0.3,
                animation: `dot-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
              }} />
            ))}
          </div>

          {/* Status message */}
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

          {/* Progress bar */}
          <div style={{
            width: 240, height: 4, background: COLORS.lightBorder,
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
        Urban Intelligence
        <br />
        <span style={{ color: COLORS.orange }}>District 3</span>
      </h1>

      <p style={{
        color: COLORS.midGray, fontSize: 17,
        textAlign: "center", maxWidth: 440,
        lineHeight: 1.6, marginBottom: 52, fontFamily: FONTS.body,
      }}>
        AI-powered civic briefings from live San Francisco permit, pipeline, and planning data.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
        gap: 14, width: "100%", maxWidth: 720, marginBottom: 52,
      }}>
        {NEIGHBORHOODS.slice(1).map((n, i) => (
          <div key={n.name}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: COLORS.white, borderRadius: 18, padding: "28px 20px",
              border: `1.5px solid ${hovered === i ? COLORS.orange : COLORS.lightBorder}`,
              transition: "all 0.25s ease", cursor: "default", textAlign: "center",
              boxShadow: hovered === i ? "0 8px 24px rgba(212,100,59,0.1)" : "0 2px 8px rgba(0,0,0,0.03)",
            }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
              <n.Icon size={42} color={hovered === i ? COLORS.orange : COLORS.warmGray} />
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, lineHeight: 1.3,
              fontFamily: FONTS.heading, color: COLORS.charcoal,
            }}>{n.name}</div>
            <div style={{
              fontSize: 12, marginTop: 6, fontFamily: FONTS.body,
              color: COLORS.warmGray, fontWeight: 500,
            }}>{n.zip}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onGenerate}
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
        {loading ? "Generating…" : "Generate District 3 Briefing →"}
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
