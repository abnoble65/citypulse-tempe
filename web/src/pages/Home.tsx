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
    <div style={{
      minHeight: "100vh",
      background: COLORS.cream,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
    }}>
      <div style={{
        marginBottom: 40,
        filter: "drop-shadow(0 6px 24px rgba(212,100,59,0.2))",
      }}>
        <CityPulseLogo size={72} />
      </div>

      <h1 style={{
        fontFamily: FONTS.heading,
        fontSize: "clamp(40px, 7vw, 72px)",
        fontWeight: 800,
        color: COLORS.charcoal,
        textAlign: "center",
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        marginBottom: 16,
        maxWidth: 600,
      }}>
        Urban Intelligence
        <br />
        <span style={{ color: COLORS.orange }}>District 3</span>
      </h1>

      <p style={{
        color: COLORS.midGray, fontSize: 17,
        textAlign: "center", maxWidth: 440,
        lineHeight: 1.6, marginBottom: 52,
        fontFamily: FONTS.body,
      }}>
        AI-powered civic briefings from live San Francisco permit, pipeline, and planning data.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
        gap: 14, width: "100%", maxWidth: 720,
        marginBottom: 52,
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
              fontFamily: FONTS.heading,
              color: COLORS.charcoal,
            }}>{n.name}</div>
            <div style={{
              fontSize: 12, marginTop: 6,
              fontFamily: FONTS.body,
              color: COLORS.warmGray,
              fontWeight: 500,
            }}>{n.zip}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onGenerate}
        disabled={loading}
        style={{
          background: loading ? COLORS.orangeSoft : COLORS.orange,
          color: COLORS.white,
          border: "none", borderRadius: 32,
          padding: "16px 40px",
          fontSize: 16, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: FONTS.heading,
          boxShadow: "0 4px 20px rgba(212,100,59,0.25)",
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
          background: "#FDEEEE",
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
  );
}
