import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";

interface OutlookProps {
  onNavigate: (page: string) => void;
}

export function Outlook({ onNavigate }: OutlookProps) {
  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="The Outlook" />
        <h2 style={{
          fontFamily: FONTS.heading,
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 700, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.01em",
          marginBottom: 36,
          fontStyle: "italic",
        }}>
          What to watch in the months ahead.
        </h2>
        <div style={{
          background: COLORS.white, borderRadius: 20,
          padding: "40px",
          border: `1px solid ${COLORS.lightBorder}`,
          fontFamily: FONTS.body,
          fontSize: 15.5, lineHeight: 1.8,
          color: COLORS.charcoal,
          marginBottom: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <p style={{ marginBottom: 18 }}>
            District 3's development trajectory will be shaped by three factors over the next quarter: the Planning Commission's stance on conversion projects, interest rate decisions affecting construction financing, and the pace of downtown office leasing recovery.
          </p>
          <p>
            Watch for the 350 Bush Street hearing in March — it's likely to set a precedent for similar conversion applications. If approved, expect a wave of filings along the Bush-Kearny corridor.
          </p>
        </div>

        <div style={{
          background: COLORS.orangePale, borderRadius: 20,
          padding: "44px",
          textAlign: "center",
          border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div style={{
            fontFamily: FONTS.heading,
            fontSize: 26, fontWeight: 700,
            marginBottom: 12, color: COLORS.charcoal,
            fontStyle: "italic",
          }}>Want fresh intelligence?</div>
          <p style={{
            fontFamily: FONTS.body,
            fontSize: 15, color: COLORS.midGray,
            marginBottom: 28, fontWeight: 500,
          }}>Generate a new briefing with the latest data.</p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white,
            border: "none", borderRadius: 28,
            padding: "14px 36px", fontSize: 15,
            fontWeight: 700, cursor: "pointer",
            fontFamily: FONTS.heading,
            boxShadow: "0 4px 16px rgba(212,100,59,0.2)",
          }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
