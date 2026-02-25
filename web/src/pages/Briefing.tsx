import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections, generateBriefingFromData } from "../services/briefing";
import type { DistrictData } from "../services/briefing";
import { NeighborhoodHero } from "../components/NeighborhoodHero";

interface BriefingProps {
  briefingText: string;
  aggregatedData: DistrictData | null;
  onNavigate: (page: string) => void;
}

export function Briefing({ briefingText, aggregatedData, onNavigate }: BriefingProps) {
  const [filter, setFilter]           = useState("All District 3");
  const [localText, setLocalText]     = useState(briefingText);
  const [isGenerating, setIsGenerating] = useState(false);

  // When a new district-wide briefing arrives (user re-generated from Home),
  // reset to it and clear any neighborhood filter.
  useEffect(() => {
    setLocalText(briefingText);
    setFilter("All District 3");
  }, [briefingText]);

  // Re-generate when the neighborhood filter changes.
  useEffect(() => {
    if (!aggregatedData) return;

    const neighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip !== null);

    if (!neighborhood) {
      // "All District 3" — restore the full district briefing.
      setLocalText(briefingText);
      return;
    }

    setIsGenerating(true);
    generateBriefingFromData(aggregatedData, { zip: neighborhood.zip!, name: neighborhood.name })
      .then(text => setLocalText(text))
      .catch(err => console.error("[Briefing] neighborhood generation failed:", err))
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]); // intentionally only re-run when filter changes, not on every prop update

  const sections = parseBriefingSections(localText);

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

  // Use zip-scoped permit stats when a neighborhood is selected.
  const ps = activeNeighborhood
    ? (aggregatedData.permit_summary.by_zip?.[activeNeighborhood.zip!] ?? aggregatedData.permit_summary)
    : aggregatedData.permit_summary;
  const pip = aggregatedData.pipeline_summary;

  const stats = [
    { num: ps.total.toLocaleString(),                                         label: "Active Permits",   bg: COLORS.orangePale },
    { num: `$${(ps.total_estimated_cost_usd / 1_000_000).toFixed(1)}M`,      label: "Est. Total Value", bg: COLORS.softAmber  },
    { num: pip.net_pipeline_units.toLocaleString(),                           label: "Pipeline Units",   bg: COLORS.softGreen  },
  ];

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <NeighborhoodHero selected={filter} aggregatedData={aggregatedData} />
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
            <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "26px 22px" }}>
              <div style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800, color: COLORS.charcoal,
                letterSpacing: "-0.02em",
              }}>{s.num}</div>
              <div style={{ fontSize: 13, color: COLORS.midGray, marginTop: 6, fontFamily: FONTS.body, fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: COLORS.white,
          borderRadius: 20, padding: "40px",
          border: `1px solid ${isGenerating ? COLORS.orange : COLORS.lightBorder}`,
          fontFamily: FONTS.body,
          fontSize: 15.5, lineHeight: 1.8,
          color: COLORS.charcoal,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          transition: "border 0.3s",
          position: "relative",
        }}>
          {isGenerating && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 14,
              zIndex: 2,
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={COLORS.orange} strokeWidth="3"
                  strokeDasharray="66" strokeDashoffset="50" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate"
                    from="0 18 18" to="360 18 18" dur="0.75s" repeatCount="indefinite" />
                </circle>
              </svg>
              <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: COLORS.charcoal }}>
                Analyzing {ps.total > 0 ? `${ps.total.toLocaleString()} permits` : "permit data"} in {locationLabel}…
              </div>
            </div>
          )}
          {sections.briefing ? (
            <p style={{ whiteSpace: "pre-wrap", opacity: isGenerating ? 0.4 : 1, transition: "opacity 0.3s" }}>
              {sections.briefing}
            </p>
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
