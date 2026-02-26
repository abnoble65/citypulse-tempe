import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { parseBriefingSections, generateBriefingFromData } from "../services/briefing";
import type { DistrictData } from "../services/briefing";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { supabase } from "../services/supabase";

/** Format an ISO date string (YYYY-MM-DD or ISO timestamp) as "Feb 25, 2026" */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // Parse just the date part as local to avoid UTC-shift
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

interface BriefingProps {
  briefingText: string;
  aggregatedData: DistrictData | null;
  onNavigate: (page: string) => void;
}

export function Briefing({ briefingText, aggregatedData, onNavigate }: BriefingProps) {
  const [filter, setFilter]           = useState("All District 3");
  const [localText, setLocalText]     = useState(briefingText);
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestHearing, setLatestHearing] = useState<string | null>(null);

  // Fetch the most recent Planning Commission hearing date once on mount.
  useEffect(() => {
    supabase
      .from("hearings")
      .select("hearing_date")
      .order("hearing_date", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setLatestHearing(data?.[0]?.hearing_date ?? null);
      });
  }, []);

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

  /** Pulsing placeholders shown while the AI is writing the briefing. */
  function BriefingSkeletons({ bgColors }: { bgColors: string[] }) {
    return (
      <>
        {/* Stat card skeletons */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 14, marginBottom: 44,
        }}>
          {bgColors.map((bg, i) => (
            <div key={i} style={{ background: bg, borderRadius: 16, padding: "26px 22px" }}>
              <div className="sk-lt" style={{ height: 38, width: "60%", marginBottom: 10 }} />
              <div className="sk-lt" style={{ height: 13, width: "72%" }} />
            </div>
          ))}
        </div>
        {/* Text body skeleton */}
        <div style={{
          background: COLORS.white, borderRadius: 20,
          padding: "clamp(20px, 5vw, 40px)",
          border: `1px solid ${COLORS.orange}`,
        }}>
          {[92, 100, 88, 100, 76, 100, 84, 58].map((w, i) => (
            <div key={i} className="sk" style={{ height: 14, width: `${w}%`, marginBottom: i < 7 ? 11 : 0 }} />
          ))}
          <div style={{ marginTop: 28 }} />
          {[96, 100, 82, 100, 90, 46].map((w, i) => (
            <div key={i} className="sk" style={{ height: 14, width: `${w}%`, marginBottom: i < 5 ? 11 : 0 }} />
          ))}
        </div>
      </>
    );
  }

  if (!aggregatedData) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "48px 32px", maxWidth: 380 }}>
          <p style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
            color: COLORS.charcoal, marginBottom: 12,
          }}>
            Unable to load briefing data
          </p>
          <p style={{ color: COLORS.midGray, fontSize: 14, fontFamily: FONTS.body, lineHeight: 1.65, marginBottom: 28 }}>
            Check your connection and try again, or generate a new briefing from the home page.
          </p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white, border: "none",
            borderRadius: 24, padding: "12px 28px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
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
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>
        <SectionLabel text="The Briefing" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.12, letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          {locationLabel} urban intelligence, powered by live DataSF data.
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
          marginBottom: 32, lineHeight: 1.5,
        }}>
          {aggregatedData?.date_range.end && (
            <>Permit data through {fmtDate(aggregatedData.date_range.end)}</>
          )}
          {aggregatedData?.date_range.end && latestHearing && " · "}
          {latestHearing && (
            <>Commission hearings through {fmtDate(latestHearing)}</>
          )}
        </p>

        {isGenerating ? (
          <BriefingSkeletons bgColors={stats.map(s => s.bg)} />
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
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
              borderRadius: 20, padding: "clamp(20px, 5vw, 40px)",
              border: `1px solid ${COLORS.lightBorder}`,
              fontFamily: FONTS.body,
              fontSize: 15.5, lineHeight: 1.8,
              color: COLORS.charcoal,
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
            }}>
              {sections.briefing ? (
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {sections.briefing}
                </p>
              ) : (
                <p style={{ color: COLORS.warmGray, fontStyle: "italic" }}>
                  Briefing content unavailable — the AI response may not have followed the expected format.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
