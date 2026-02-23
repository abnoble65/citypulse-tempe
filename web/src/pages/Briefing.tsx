import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections } from "../services/briefing";
import type { DistrictData } from "../services/briefing";
import { NeighborhoodHero } from "../components/NeighborhoodHero";

interface BriefingProps {
  briefingText: string;
  aggregatedData: DistrictData | null;
  onNavigate: (page: string) => void;
}

export function Briefing({ briefingText, aggregatedData, onNavigate }: BriefingProps) {
  const [filter, setFilter] = useState("All District 3");
  const sections = parseBriefingSections(briefingText);
  const ps = aggregatedData?.permit_summary;
  const pip = aggregatedData?.pipeline_summary;

  if (!aggregatedData) {
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

  const activeNeighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip);
  const locationLabel = activeNeighborhood ? activeNeighborhood.name : "District 3";

  const stats = [
    { num: ps ? ps.total.toLocaleString() : "—", label: "Active Permits", bg: COLORS.orangePale },
    { num: ps ? `$${(ps.total_estimated_cost_usd / 1_000_000).toFixed(0)}M` : "—", label: "Est. Total Value", bg: COLORS.softAmber },
    { num: pip ? pip.net_pipeline_units.toLocaleString() : "—", label: "Pipeline Units", bg: COLORS.softGreen },
  ];

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <NeighborhoodHero selected={filter} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="The Briefing" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.12, letterSpacing: "-0.02em",
          marginBottom: 36,
        }}>
          {locationLabel} urban intelligence, powered by live DataSF data.
        </h2>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 14, marginBottom: 44,
        }}>
          {stats.map(s => (
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
          {sections.briefing ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{sections.briefing}</p>
          ) : (
            <p style={{ color: COLORS.warmGray, fontStyle: "italic" }}>
              Briefing content unavailable — the AI response may not have followed the expected format.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
