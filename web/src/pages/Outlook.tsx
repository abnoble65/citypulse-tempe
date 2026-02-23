import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections } from "../services/briefing";

interface OutlookProps {
  briefingText: string;
  onNavigate: (page: string) => void;
}

function WatchItem({ title, date, detail, impact }: {
  title: string; date: string; detail: string; impact: string;
}) {
  return (
    <div style={{ padding: "24px 0", borderBottom: `1px solid ${COLORS.lightBorder}` }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: 16, marginBottom: 10, flexWrap: "wrap",
      }}>
        <h3 style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 18,
          fontWeight: 700, color: COLORS.charcoal, lineHeight: 1.3,
        }}>{title}</h3>
        <span style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
          color: COLORS.orange, background: COLORS.orangePale,
          borderRadius: 6, padding: "4px 12px",
          whiteSpace: "nowrap", flexShrink: 0,
        }}>{date}</span>
      </div>
      <p style={{
        fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.75,
        color: COLORS.midGray, marginBottom: 10,
      }}>{detail}</p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
          color: COLORS.charcoal, flexShrink: 0, marginTop: 1,
          letterSpacing: "0.03em",
        }}>IMPACT →</span>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.6,
          color: COLORS.charcoal, fontWeight: 500,
        }}>{impact}</p>
      </div>
    </div>
  );
}

function RiskCard({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div style={{
      background: COLORS.cream, borderRadius: 16, padding: "24px 28px",
      border: `1px solid ${COLORS.lightBorder}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h4 style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 16,
          fontWeight: 700, color: COLORS.charcoal,
        }}>{title}</h4>
      </div>
      <p style={{
        fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7, color: COLORS.midGray,
      }}>{detail}</p>
    </div>
  );
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

        {/* ── THE OUTLOOK ────────────────────────── */}
        <SectionLabel text="The Outlook" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36,
        }}>
          What to watch in the months ahead.
        </h2>

        {/* AI-generated outlook */}
        <div style={{
          background: COLORS.white, borderRadius: 20, padding: "40px 44px",
          border: `1px solid ${COLORS.lightBorder}`,
          fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 1.8,
          color: COLORS.charcoal, marginBottom: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          whiteSpace: "pre-wrap",
        }}>
          {sections.outlook}
        </div>

        {/* ── EVENTS TO WATCH ────────────────────── */}
        <SectionLabel text="Key Events" />
        <div style={{
          background: COLORS.white, borderRadius: 20, padding: "28px 44px",
          border: `1px solid ${COLORS.lightBorder}`,
          marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <WatchItem
            title="350 Bush Street — Planning Commission Hearing"
            date="Mar 2026"
            detail="The largest office-to-residential conversion proposed in District 3 at 180 feet and 210 units. Widely viewed as a bellwether case — approval would accelerate similar filings along the Bush-Kearny corridor; denial could slow the entire conversion pipeline."
            impact="Sets precedent for conversion project height, density, and affordable housing requirements. Shadow analysis for St. Mary's Square still pending."
          />
          <WatchItem
            title="600 Stockton Street — Environmental Review Publication"
            date="Apr 2026"
            detail="The preliminary environmental review for this mixed-use project is expected to be published. Community groups have signaled intent to challenge the traffic analysis."
            impact="Could extend the project timeline by 6–12 months if environmental challenges are filed. Affects three adjacent small businesses during construction."
          />
          <WatchItem
            title="Planning Commission — Cumulative Impact Policy Discussion"
            date="May 2026"
            detail="The Commission has scheduled a policy discussion on whether to require cumulative impact assessments when multiple large projects are proposed within a defined radius."
            impact="If adopted, would add a new review layer for projects in high-activity zones. Could slow approvals but address infrastructure and quality-of-life concerns."
          />
          <WatchItem
            title="Fed Interest Rate Decision"
            date="Jun 2026"
            detail="At least two developers in the District 3 pipeline have indicated project timelines are contingent on a rate cut. Current financing costs make marginal conversion projects unviable without lower rates or increased city subsidies."
            impact="A rate hold or increase could pause 3–5 pipeline projects. A cut of 25+ basis points would likely trigger a wave of new filings within 60 days."
          />
        </div>

        {/* ── RISKS & DOWNSIDE SCENARIOS ──────── */}
        <SectionLabel text="Risks & Downside Scenarios" />
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16, marginBottom: 24,
        }}>
          <RiskCard icon="📉" title="Pipeline Stall"
            detail="If interest rates remain elevated and the 350 Bush hearing produces restrictive conditions, the conversion pipeline could lose 40–60% of its current projects, leaving District 3 with persistent office vacancy and no clear path to residential growth."
          />
          <RiskCard icon="🏗️" title="Construction Overload"
            detail="If all current pipeline projects advance simultaneously, the district faces 18–24 months of concentrated construction activity. Without coordinated management, this could strain infrastructure and disrupt businesses and residents."
          />
          <RiskCard icon="🏘️" title="Displacement Pressure"
            detail="Renovation activity in Chinatown and Nob Hill continues to raise displacement concerns. Even well-intentioned seismic retrofits can trigger rent increases or unit reconfigurations that reduce affordable housing stock."
          />
          <RiskCard icon="🚇" title="Transit Capacity Gap"
            detail="Current Muni service on key District 3 routes is operating near peak capacity. Adding 600+ residential units without supplemental transit planning could push these routes past functional limits."
          />
        </div>

        {/* ── GET INVOLVED ──────────── */}
        <SectionLabel text="Get Involved" />
        <div style={{
          background: COLORS.softBlue, borderRadius: 20, padding: "36px 44px",
          marginBottom: 32, border: "1px solid #C8D8E8",
        }}>
          <h3 style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 22,
            fontWeight: 800, color: COLORS.charcoal, marginBottom: 16,
          }}>
            How to stay informed and participate
          </h3>
          <div style={{ fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.8, color: COLORS.midGray }}>
            <p style={{ marginBottom: 14 }}>
              <strong style={{ color: COLORS.charcoal }}>Attend Commission Hearings:</strong> Planning Commission meetings are open to the public and accept in-person and written testimony. High-impact sessions are flagged in the Commission page.
            </p>
            <p style={{ marginBottom: 14 }}>
              <strong style={{ color: COLORS.charcoal }}>Submit Public Comment:</strong> Comments can be filed on any active permit through the SF Planning Department portal. Written comments submitted at least 48 hours before a hearing are included in the Commission's packet.
            </p>
            <p style={{ marginBottom: 14 }}>
              <strong style={{ color: COLORS.charcoal }}>Monitor Permit Activity:</strong> CityPulse tracks all active permits in District 3. Regenerate this briefing periodically to stay current on new filings and status changes.
            </p>
            <p>
              <strong style={{ color: COLORS.charcoal }}>Contact Your Supervisor:</strong> The District 3 Supervisor's office can provide updates on district-level policy discussions and connect residents with neighborhood liaison staff.
            </p>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────── */}
        <div style={{
          background: COLORS.orangePale, borderRadius: 20, padding: "44px",
          textAlign: "center", border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 26,
            fontWeight: 800, marginBottom: 12, color: COLORS.charcoal,
          }}>Want fresh intelligence?</div>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, color: COLORS.midGray,
            marginBottom: 28, fontWeight: 500,
          }}>Generate a new briefing with the latest data.</p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white, border: "none",
            borderRadius: 28, padding: "14px 36px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
            boxShadow: "0 4px 16px rgba(212,100,59,0.2)",
          }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
