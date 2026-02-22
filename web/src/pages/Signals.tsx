import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections } from "../services/briefing";

interface SignalsProps {
  briefingText: string;
  onNavigate: (page: string) => void;
}

export function Signals({ briefingText, onNavigate }: SignalsProps) {
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
        <SectionLabel text="The Signal" />
        <div style={{
          background: COLORS.softAmber, borderRadius: 20, padding: "44px",
          marginBottom: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <h2 style={{
            fontFamily: FONTS.heading,
            fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700, lineHeight: 1.15,
            letterSpacing: "-0.01em", marginBottom: 20,
            color: COLORS.charcoal, fontStyle: "italic",
          }}>
            What the data is signalling for District 3.
          </h2>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray, whiteSpace: "pre-wrap",
          }}>
            {sections.signal}
          </p>
        </div>

        <SectionLabel text="Zoning Context" />
        <div style={{
          background: COLORS.white, borderRadius: 20, padding: "44px",
          border: `1px solid ${COLORS.lightBorder}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <h2 style={{
            fontFamily: FONTS.heading,
            fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700, color: COLORS.charcoal,
            lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 20,
            fontStyle: "italic",
          }}>
            Zoning and land use context.
          </h2>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray, whiteSpace: "pre-wrap",
          }}>
            {sections.zoningContext}
          </p>
        </div>
      </div>
    </div>
  );
}
