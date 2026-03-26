import { COLORS, FONTS } from "../theme";
import { CityPulseLogo } from "../components/Icons";
import { DEFAULT_DISTRICT } from "../districts";
import type { DistrictConfig } from "../districts";

interface HomeProps {
  onNavigate: (page: string) => void;
  onGenerate: (district: DistrictConfig) => void;
  loading:    boolean;
  error:      string | null;
}

const SUGGESTION_CHIPS = [
  "What's being built near Tempe Town Lake?",
  "Show recent multifamily permits",
  "Where is development accelerating?",
];

export function Home({ onGenerate, loading, error }: HomeProps) {
  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.cream,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "80px 24px 60px",
    }}>
      <div style={{ marginBottom: 40, filter: "drop-shadow(0 6px 24px rgba(232,97,26,0.2))" }}>
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
        <span style={{ color: COLORS.orange }}>Tempe</span>
      </h1>

      <p style={{
        color: COLORS.midGray, fontSize: 17,
        textAlign: "center", maxWidth: 440,
        lineHeight: 1.6, marginBottom: 48, fontFamily: FONTS.body,
      }}>
        Live permit, planning, and development intelligence for Tempe, AZ.
      </p>

      <button
        onClick={() => onGenerate(DEFAULT_DISTRICT)}
        disabled={loading}
        style={{
          background: loading ? COLORS.warmGray : "#E8611A",
          color: COLORS.white, border: "none", borderRadius: 32,
          padding: "18px 48px", fontSize: 18, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "'Urbanist', sans-serif",
          boxShadow: loading ? "none" : "0 6px 28px rgba(232,97,26,0.3)",
          transition: "transform 0.2s, box-shadow 0.2s, background 0.3s",
          letterSpacing: "0.01em", opacity: loading ? 0.6 : 1,
        }}>
        {loading ? "Generating…" : "Generate Tempe Briefing →"}
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

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 10,
        justifyContent: "center", marginTop: 36, maxWidth: 520,
      }}>
        {SUGGESTION_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => onGenerate(DEFAULT_DISTRICT)}
            disabled={loading}
            style={{
              background: COLORS.white,
              border: `1px solid ${COLORS.lightBorder}`,
              borderRadius: 20, padding: "10px 18px",
              fontSize: 13, fontWeight: 500,
              color: COLORS.charcoal,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: FONTS.body,
              transition: "all 0.15s ease",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
