import { useState, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "../theme";
import { renderMarkdownBlock } from "../components/MarkdownText";
import { linkifyText } from "../utils/linkifyBriefing";
import { SectionLabel } from "../components/SectionLabel";
import { generateBriefingFromData, generateBriefingOverview, getCachedBriefingOverview } from "../services/briefing";
import type { DistrictData, TempePermitSummary } from "../services/briefing";
import { supabase } from "../services/supabase";
import type { DistrictConfig } from "../districts";
import { useLanguage } from "../contexts/LanguageContext";

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
  districtConfig: DistrictConfig;
  onNavigate: (page: string) => void;
  tempeSummary?: TempePermitSummary | null;
}

function formatOverviewTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate();
  return sameDay
    ? `Updated today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : `Updated ${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

export function Briefing({ briefingText, aggregatedData, districtConfig, onNavigate, tempeSummary }: BriefingProps) {
  const { language } = useLanguage();
  const [filter, setFilter]             = useState(districtConfig.allLabel);
  const [localText, setLocalText]       = useState(briefingText);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]         = useState<string | null>(null);
  const [latestHearing, setLatestHearing] = useState<string | null>(null);

  // Linkifier for auto-linking addresses, neighborhoods, dollar amounts
  const briefingLinkify = useCallback(
    (text: string) => linkifyText(text, onNavigate),
    [onNavigate],
  );

  // Overview state — instant from cache, async if missing
  const [overview, setOverview]                   = useState<string | null>(null);
  const [overviewGeneratedAt, setOverviewGeneratedAt] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading]     = useState(false);

  // Fetch the most recent Planning Commission hearing date once on mount.
  useEffect(() => {
    Promise.resolve(
      supabase
        .from("hearings")
        .select("hearing_date")
        .order("hearing_date", { ascending: false })
        .limit(1)
    )
      .then(({ data }) => {
        setLatestHearing(data?.[0]?.hearing_date ?? null);
      })
      .catch(() => {});
  }, []);

  // Overview — instant from cache, async otherwise. Re-runs when data or filter changes.
  useEffect(() => {
    if (!aggregatedData) return;
    const neighborhood = districtConfig.neighborhoods.find(n => n.name === filter);
    const focus = neighborhood ? { zip: neighborhood.zip, name: neighborhood.name } : undefined;

    const cached = getCachedBriefingOverview(districtConfig, focus, language);
    if (cached) {
      setOverview(cached.overview);
      setOverviewGeneratedAt(cached.generatedAt);
      return;
    }

    setOverviewLoading(true);
    generateBriefingOverview(aggregatedData, districtConfig, focus, language)
      .then(({ overview: o, generatedAt }) => {
        setOverview(o);
        setOverviewGeneratedAt(generatedAt);
      })
      .catch(err => console.error("[Briefing] overview generation failed:", err))
      .finally(() => setOverviewLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, aggregatedData, language]);

  // When a new district-wide briefing arrives (new generation or district change),
  // reset to it and clear any neighborhood filter.
  useEffect(() => {
    setLocalText(briefingText);
    setFilter(districtConfig.allLabel);
    setGenError(null);
    setOverview(null);
    setOverviewGeneratedAt(null);
  }, [briefingText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-generate when the neighborhood filter changes.
  useEffect(() => {
    if (!aggregatedData) return;

    const neighborhood = districtConfig.neighborhoods.find(n => n.name === filter);

    if (!neighborhood) {
      // "All District N" — restore the full district briefing.
      setLocalText(briefingText);
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    generateBriefingFromData(aggregatedData, districtConfig, { zip: neighborhood.zip, name: neighborhood.name }, language)
      .then(text => setLocalText(text))
      .catch(err => {
        console.error("[Briefing] neighborhood generation failed:", err);
        setGenError("Unable to generate briefing right now. Please try again.");
      })
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, language]); // intentionally only re-run when filter or language changes

  /** Pulsing placeholders shown while the AI is writing the briefing. */
  function BriefingSkeletons({ bgColors }: { bgColors: string[] }) {
    return (
      <>
        {/* Stat card skeletons */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
          gap: 14, marginBottom: 44,
        }}>
          {bgColors.map((bg, i) => (
            <div key={i} style={{ background: bg, borderRadius: 16, padding: "22px 18px" }}>
              <div className="sk-lt" style={{ height: 34, width: "60%", marginBottom: 10 }} />
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

  if (!aggregatedData && !tempeSummary) {
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

  const activeNeighborhood = districtConfig.neighborhoods.find(n => n.name === filter);
  const locationLabel = activeNeighborhood ? activeNeighborhood.name : districtConfig.label;

  // Tempe stats from ArcGIS permit data
  const stats = tempeSummary
    ? [
        { num: tempeSummary.totalPermits.toLocaleString(),                                  label: "Permits (90 days)", bg: COLORS.orangePale },
        { num: `$${(tempeSummary.totalEstimatedValue / 1_000_000).toFixed(1)}M`,            label: "Est. Total Value",  bg: COLORS.softAmber  },
        { num: tempeSummary.mixedUseCount.toLocaleString(),                                 label: "Mixed-Use",         bg: COLORS.softGreen  },
      ]
    : aggregatedData
      ? [
          { num: aggregatedData.permit_summary.total.toLocaleString(),                                         label: "Active Permits",   bg: COLORS.orangePale },
          { num: `$${(aggregatedData.permit_summary.total_estimated_cost_usd / 1_000_000).toFixed(1)}M`,      label: "Est. Total Value", bg: COLORS.softAmber  },
          { num: aggregatedData.pipeline_summary.net_pipeline_units.toLocaleString(),                           label: "Pipeline Units",   bg: COLORS.softGreen  },
        ]
      : [];

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>
        <SectionLabel text="The Briefing" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.12, letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          Tempe Intelligence Briefing

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

        {/* Neighborhood generation error */}
        {!isGenerating && genError && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8",
            borderRadius: 16, padding: "20px 24px", marginBottom: 24,
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{
                fontFamily: "'Urbanist', sans-serif", fontSize: 15, fontWeight: 700,
                color: "#B44040", marginBottom: 4,
              }}>Failed to generate neighborhood briefing</div>
              <p style={{ fontFamily: FONTS.body, fontSize: 13, color: "#B44040", margin: 0, lineHeight: 1.55 }}>
                {genError}
              </p>
            </div>
          </div>
        )}

        {isGenerating ? (
          <BriefingSkeletons bgColors={stats.map(s => s.bg)} />
        ) : (
          <>
            <div style={{
              display: "grid",
              // Mobile: 2 columns; desktop (≥540px): 3 columns
              gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
              gap: 14, marginBottom: 44,
            }}>
              {stats.map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "22px 18px" }}>
                  <div style={{
                    fontFamily: "'Urbanist', sans-serif",
                    fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 800, color: COLORS.charcoal,
                    letterSpacing: "-0.02em",
                  }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: COLORS.midGray, marginTop: 6, fontFamily: FONTS.body, fontWeight: 500 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Overview — morning-briefing paragraph */}
            {(overviewLoading || overview) && (
              <div style={{
                background: COLORS.orangePale,
                borderRadius: 20, padding: "clamp(20px, 5vw, 36px)",
                border: `1px solid rgba(212,100,59,0.18)`,
                marginBottom: 20,
              }}>
                {overviewLoading && !overview ? (
                  <>
                    <div className="sk" style={{ height: 15, width: "96%", marginBottom: 10 }} />
                    <div className="sk" style={{ height: 15, width: "88%", marginBottom: 10 }} />
                    <div className="sk" style={{ height: 15, width: "74%" }} />
                  </>
                ) : (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      marginBottom: 14,
                    }}>
                      <div style={{ width: 3, height: 20, borderRadius: 2, background: "#E8652D", flexShrink: 0 }} />
                      <span style={{
                        fontFamily: "'Urbanist', sans-serif", fontSize: 18,
                        fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.01em",
                      }}>Tempe Overview</span>
                    </div>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 15.5,
                      color: COLORS.charcoal,
                    }}>
                      {renderMarkdownBlock(overview!, briefingLinkify)}
                    </div>
                    {overviewGeneratedAt && (
                      <p style={{
                        fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                        marginTop: 12, marginBottom: 0, opacity: 0.75,
                      }}>
                        {formatOverviewTimestamp(overviewGeneratedAt)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {localText.trim() && (
              <div style={{
                background: COLORS.white,
                borderRadius: 20, padding: "clamp(20px, 5vw, 40px)",
                border: `1px solid ${COLORS.lightBorder}`,
                fontFamily: FONTS.body,
                fontSize: 15.5, lineHeight: 1.8,
                color: COLORS.charcoal,
                boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
              }}>
                {renderMarkdownBlock(localText, briefingLinkify)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
