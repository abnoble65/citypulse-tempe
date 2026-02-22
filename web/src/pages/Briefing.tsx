import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";

export function Briefing() {
  const [filter, setFilter] = useState("All District 3");

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="The Briefing" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.12, letterSpacing: "-0.02em",
          marginBottom: 36,
        }}>
          Development activity holds steady as commercial permits lead the quarter.
        </h2>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 14, marginBottom: 44,
        }}>
          {[
            { num: "817", label: "Active Permits", bg: COLORS.orangePale },
            { num: "$52M", label: "Est. Total Value", bg: COLORS.softAmber },
            { num: "23", label: "Pipeline Projects", bg: COLORS.softGreen },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 16,
              padding: "26px 22px",
            }}>
              <div style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800, color: COLORS.charcoal,
                letterSpacing: "-0.02em",
              }}>{s.num}</div>
              <div style={{
                fontSize: 13, color: COLORS.midGray,
                marginTop: 6, fontFamily: FONTS.body,
                fontWeight: 500,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: COLORS.white,
          borderRadius: 20, padding: "40px",
          border: `1px solid ${COLORS.lightBorder}`,
          fontFamily: FONTS.body,
          fontSize: 15.5, lineHeight: 1.8,
          color: COLORS.charcoal,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <p style={{ marginBottom: 20 }}>
            District 3 continues to show resilient development activity this quarter, with 817 active building permits representing an estimated $52 million in construction value. Commercial projects dominate the filed permits, particularly along the Bush Street and Kearny Street corridors.
          </p>
          <p style={{ marginBottom: 20 }}>
            The Financial District and Jackson Square subarea leads with 38% of all new filings, driven by office-to-residential conversion projects that align with the city's ongoing downtown recovery strategy. North Beach maintains steady residential renovation activity.
          </p>
          <p>
            Three large-scale mixed-use developments in the pipeline — at 350 Bush, 600 Stockton, and 1 Grant — are expected to enter the review phase in Q2, potentially adding significant density to the district's eastern edge.
          </p>
        </div>
      </div>
    </div>
  );
}
