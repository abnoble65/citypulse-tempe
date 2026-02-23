import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections } from "../services/briefing";

interface SignalsProps {
  briefingText: string;
  onNavigate: (page: string) => void;
}

/* ─── Reusable insight card ──────────────────── */

function InsightCard({ children, bg = COLORS.white, border = true }: {
  children: React.ReactNode;
  bg?: string;
  border?: boolean;
}) {
  return (
    <div style={{
      background: bg, borderRadius: 20,
      padding: "40px 44px",
      marginBottom: 24,
      border: border ? `1px solid ${COLORS.lightBorder}` : "none",
      boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
    }}>
      {children}
    </div>
  );
}

function Callout({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      background: COLORS.cream, borderRadius: 14,
      padding: "18px 22px", marginTop: 20,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <p style={{
        fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
        color: COLORS.charcoal, fontWeight: 500,
      }}>{text}</p>
    </div>
  );
}

function ConcernItem({ level, title, detail }: {
  level: "high" | "medium" | "watch";
  title: string;
  detail: string;
}) {
  const levelConfig = {
    high:   { label: "HIGH",   bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" },
    medium: { label: "MEDIUM", bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" },
    watch:  { label: "WATCH",  bg: COLORS.softBlue, text: "#4A6FA5", border: "#C8D8E8" },
  };
  const cfg = levelConfig[level];

  return (
    <div style={{
      display: "flex", gap: 16, alignItems: "flex-start",
      padding: "20px 0",
      borderBottom: `1px solid ${COLORS.lightBorder}`,
    }}>
      <span style={{
        fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
        color: cfg.text, background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 6, padding: "4px 10px",
        whiteSpace: "nowrap", flexShrink: 0, marginTop: 2,
        letterSpacing: "0.04em",
      }}>{cfg.label}</span>
      <div>
        <div style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 16,
          fontWeight: 700, color: COLORS.charcoal, marginBottom: 6,
        }}>{title}</div>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
          color: COLORS.midGray,
        }}>{detail}</p>
      </div>
    </div>
  );
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

        {/* ── THE SIGNAL ─────────────────────────── */}
        <SectionLabel text="The Signal" />
        <InsightCard bg={COLORS.softAmber} border={false}>
          <h2 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800, lineHeight: 1.15,
            letterSpacing: "-0.02em", marginBottom: 20,
            color: COLORS.charcoal,
          }}>
            What the data is signalling for District 3.
          </h2>
          <div style={{
            fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray, whiteSpace: "pre-wrap",
          }}>
            {sections.signal}
          </div>
          <Callout
            icon="📊"
            text="Data sourced from live DataSF building permits, pipeline projects, and planning records. Regenerate to refresh with the latest activity."
          />
        </InsightCard>

        {/* ── ZONING CONTEXT ─────────────────────── */}
        <SectionLabel text="Zoning Context" />
        <InsightCard>
          <h2 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800, color: COLORS.charcoal,
            lineHeight: 1.15, letterSpacing: "-0.02em",
            marginBottom: 20,
          }}>
            Zoning and land use context.
          </h2>
          <div style={{
            fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray, whiteSpace: "pre-wrap",
          }}>
            {sections.zoningContext}
          </div>
          <Callout
            icon="⚠️"
            text="Zoning data reflects current SF Planning Department designations. Contact the Planning Department for the most recent amendments or conditional use authorizations."
          />
        </InsightCard>

        {/* ── PUBLIC CONCERNS ────────────────────── */}
        <SectionLabel text="Public Concerns" />
        <InsightCard>
          <h2 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 800, color: COLORS.charcoal,
            lineHeight: 1.15, letterSpacing: "-0.02em",
            marginBottom: 8,
          }}>
            What the data raises for residents and stakeholders.
          </h2>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
            color: COLORS.midGray, marginBottom: 8,
          }}>
            Based on current permit activity, pipeline projects, and Planning Commission hearing records, several patterns emerge that may warrant public attention.
          </p>

          <ConcernItem
            level="high"
            title="Construction Impact Clustering"
            detail="Multiple active construction permits in concentrated blocks may produce overlapping noise, dust, and traffic disruptions. Residents in adjacent buildings may experience sustained quality-of-life impacts without a coordinated construction management plan."
          />
          <ConcernItem
            level="high"
            title="Affordable Housing Displacement Risk"
            detail="Renovation permits in residential zones can involve buildings with existing rent-controlled units. Scopes of work that include unit reconfiguration may trigger tenant protection provisions. Check the Commission page for recent hearing testimony."
          />
          <ConcernItem
            level="medium"
            title="Shadow Impact on Public Spaces"
            detail="Tall projects in the district may cast new shadow on public parks and plazas. Section 295 shadow analyses are required for projects exceeding height thresholds — check active permit records for pending studies."
          />
          <ConcernItem
            level="medium"
            title="Infrastructure Capacity Strain"
            detail="Cumulative residential unit additions from pipeline projects could add significant daily transit trips to an area already operating near Muni capacity during peak hours. No supplemental transit studies may have been initiated."
          />
          <ConcernItem
            level="watch"
            title="Historic Preservation Gaps"
            detail="Permits in historic districts involving facade modifications below the threshold for Historic Preservation Commission review can cumulatively erode district character without triggering formal oversight."
          />
          <ConcernItem
            level="watch"
            title="Small Business Disruption"
            detail="Ground-floor commercial spaces at permitted renovation sites may be occupied by small businesses. Extended construction timelines can force temporary or permanent closures. The Office of Small Business offers continuity support."
          />
        </InsightCard>
      </div>
    </div>
  );
}
