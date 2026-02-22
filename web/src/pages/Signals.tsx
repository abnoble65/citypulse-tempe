import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";

export function Signals() {
  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="The Signal" />
        <div style={{
          background: COLORS.softAmber, borderRadius: 20,
          padding: "44px",
          marginBottom: 28,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <h2 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800, lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: 20,
            color: COLORS.charcoal,
          }}>
            Office-to-residential conversions signal a structural shift in downtown land use.
          </h2>
          <p style={{
            fontFamily: FONTS.body,
            fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray,
          }}>
            Three major conversion projects filed in the past 90 days suggest that property owners are responding to persistent office vacancy rates. This trend could reshape the Financial District's residential density within five years.
          </p>
        </div>

        <SectionLabel text="Zoning Context" />
        <div style={{
          background: COLORS.white, borderRadius: 20,
          padding: "44px",
          border: `1px solid ${COLORS.lightBorder}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <h2 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800, color: COLORS.charcoal,
            lineHeight: 1.15, letterSpacing: "-0.02em",
            marginBottom: 20,
          }}>
            C-3-O and RC-4 districts dominate the active permit landscape.
          </h2>
          <p style={{
            fontFamily: FONTS.body,
            fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray,
          }}>
            The downtown office district (C-3-O) and high-density residential-commercial (RC-4) zones account for 67% of all filed permits. Recent zoning amendments have expanded allowable uses in these districts, supporting the conversion trend.
          </p>
        </div>
      </div>
    </div>
  );
}
