import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { CityPulseLogo } from "../components/Icons";

interface HomeProps {
  onNavigate: (page: string) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
}

export function Home({ onGenerate, loading, error }: HomeProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.cream }}>
      {/* ── Hero ── */}
      <div style={{
        position: "relative",
        height: "100vh",
        minHeight: 560,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Background image */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/splash.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }} />
        {/* Dark gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(30,24,18,0.45) 0%, rgba(30,24,18,0.72) 100%)",
        }} />

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "0 24px", textAlign: "center",
        }}>
          <div style={{
            marginBottom: 32,
            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))",
          }}>
            <CityPulseLogo size={68} bg="#FFFFFF" fg={COLORS.orange} />
          </div>

          <h1 style={{
            fontFamily: FONTS.heading,
            fontSize: "clamp(42px, 7vw, 76px)",
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            marginBottom: 16,
            maxWidth: 640,
            textShadow: "0 2px 20px rgba(0,0,0,0.3)",
          }}>
            Urban Intelligence
            <br />
            <span style={{ color: "#F0B07A" }}>District 3</span>
          </h1>

          <p style={{
            color: "rgba(255,255,255,0.78)",
            fontSize: 17,
            maxWidth: 440,
            lineHeight: 1.65,
            marginBottom: 44,
            fontFamily: FONTS.body,
            textShadow: "0 1px 6px rgba(0,0,0,0.25)",
          }}>
            AI-powered civic briefings from live San Francisco permit, pipeline, and planning data.
          </p>

          <button
            onClick={onGenerate}
            disabled={loading}
            style={{
              background: loading ? "rgba(212,100,59,0.7)" : COLORS.orange,
              color: COLORS.white,
              border: "none", borderRadius: 32,
              padding: "16px 44px",
              fontSize: 16, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: FONTS.heading,
              boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
              letterSpacing: "0.01em",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Generating briefing…
              </>
            ) : (
              "Generate District 3 Briefing →"
            )}
          </button>

          {error && (
            <div style={{
              marginTop: 20,
              background: "rgba(253,238,238,0.95)",
              border: "1px solid #F0C8C8",
              borderRadius: 12,
              padding: "12px 20px",
              color: "#B44040",
              fontSize: 13,
              fontFamily: FONTS.body,
              maxWidth: 440,
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Scroll hint */}
        <div style={{
          position: "absolute", bottom: 32,
          color: "rgba(255,255,255,0.45)",
          fontSize: 12, fontFamily: FONTS.body,
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>scroll to explore ↓</div>
      </div>

      {/* ── Neighborhood cards ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "72px 24px 80px",
      }}>
        <p style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.1em", textTransform: "uppercase",
          fontFamily: FONTS.body, marginBottom: 16,
        }}>Covered neighborhoods</p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
          gap: 14, width: "100%", maxWidth: 720,
        }}>
          {NEIGHBORHOODS.slice(1).map((n, i) => (
            <div key={n.name}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: COLORS.white,
                borderRadius: 18, padding: "28px 20px",
                border: `1.5px solid ${hovered === i ? COLORS.orange : COLORS.lightBorder}`,
                transition: "all 0.25s ease",
                cursor: "default",
                textAlign: "center",
                boxShadow: hovered === i
                  ? "0 8px 24px rgba(212,100,59,0.1)"
                  : "0 2px 8px rgba(0,0,0,0.03)",
              }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                <n.Icon size={42} color={hovered === i ? COLORS.orange : COLORS.warmGray} />
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700, lineHeight: 1.3,
                fontFamily: FONTS.heading, color: COLORS.charcoal,
              }}>{n.name}</div>
              <div style={{
                fontSize: 12, marginTop: 6,
                fontFamily: FONTS.body, color: COLORS.warmGray, fontWeight: 500,
              }}>{n.zip}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
