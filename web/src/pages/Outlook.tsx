import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections } from "../services/briefing";

interface OutlookProps {
  briefingText: string;
  onNavigate: (page: string) => void;
}

export function Outlook({ briefingText, onNavigate }: OutlookProps) {
  const sections = parseBriefingSections(briefingText);

  if (!briefingText) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "48px 32px" }}>
          <p style={{ color: COLORS.midGray, fontSize: 15, fontFamily: FONTS.body, marginBottom: 24 }}>
            No briefing data yet. Generate one from the home page.
          </p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white, border: "none",
            borderRadius: 24, padding: "12px 28px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: FONTS.heading,
          }}>← Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="The Outlook" />
        <h2 style={{
          fontFamily: FONTS.heading,
          fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 36,
          fontStyle: "italic",
        }}>
          What to watch in the months ahead.
        </h2>
        <div style={{
          background: COLORS.white, borderRadius: 20, padding: "40px",
          border: `1px solid ${COLORS.lightBorder}`,
          fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 1.8,
          color: COLORS.charcoal, marginBottom: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          whiteSpace: "pre-wrap",
        }}>
          {sections.outlook}
        </div>

        <div style={{
          background: COLORS.orangePale, borderRadius: 20, padding: "44px",
          textAlign: "center", border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 26, fontWeight: 700,
            marginBottom: 12, color: COLORS.charcoal, fontStyle: "italic",
          }}>Want fresh intelligence?</div>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, color: COLORS.midGray,
            marginBottom: 28, fontWeight: 500,
          }}>Generate a new briefing with the latest data.</p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white,
            border: "none", borderRadius: 28,
            padding: "14px 36px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: FONTS.heading,
            boxShadow: "0 4px 16px rgba(212,100,59,0.2)",
          }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
