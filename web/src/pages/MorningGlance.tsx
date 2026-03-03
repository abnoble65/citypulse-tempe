/**
 * MorningGlance.tsx — Daily digest page, route /pulse
 *
 * PWA launch screen. Reads AI caches for instant display, then auto-generates
 * any missing content in parallel when aggregatedData is available.
 * Stats from aggregatedData (auto-loaded by App.tsx when landing on /pulse).
 */

import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { CityPulseLogo } from "../components/Icons";
import { supabase } from "../services/supabase";
import {
  getCachedBriefingOverview,
  getCachedSignals,
  getCachedConcerns,
  generateBriefingOverview,
  generateSignals,
  generatePublicConcerns,
} from "../services/briefing";
import type { DistrictData, Signal, PublicConcern } from "../services/briefing";
import type { DistrictConfig } from "../districts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MorningGlanceProps {
  aggregatedData: DistrictData | null;
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Return the first `n` sentences of `text` (splits on ". " / "! " / "? "). */
function firstSentences(text: string, n: number): string {
  const re = /(?<=[.!?])\s+/g;
  let count = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    count++;
    if (count >= n) {
      return text.slice(0, match.index + 1).trim();
    }
    lastIndex = match.index;
  }
  // Fewer than n sentences — return whole text
  void lastIndex;
  return text.trim();
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Severity badge ─────────────────────────────────────────────────────────────

const SEV: Record<string, { bg: string; text: string }> = {
  high:     { bg: "#FDE8E8", text: "#C0392B" },
  medium:   { bg: COLORS.softAmber, text: COLORS.amber },
  low:      { bg: COLORS.softGreen, text: COLORS.green },
  critical: { bg: "#FDE8E8", text: "#C0392B" },
  alert:    { bg: COLORS.softAmber, text: COLORS.amber },
  watch:    { bg: COLORS.softGreen, text: COLORS.green },
};

function SeverityBadge({ level }: { level: string }) {
  const s = SEV[level] ?? { bg: COLORS.cream, text: COLORS.midGray };
  return (
    <span style={{
      background: s.bg, color: s.text,
      padding: "3px 9px", borderRadius: 12,
      fontSize: 10, fontWeight: 700,
      letterSpacing: "0.09em", textTransform: "uppercase" as const,
      fontFamily: FONTS.body,
    }}>
      {level}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ num, label, bg }: { num: string | null; label: string; bg: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 14,
      padding: "15px 14px 13px",
      display: "flex", flexDirection: "column", gap: 5,
    }}>
      {num != null ? (
        <div style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(22px, 5.5vw, 28px)", fontWeight: 800,
          color: COLORS.charcoal, letterSpacing: "-0.02em", lineHeight: 1,
        }}>
          {num}
        </div>
      ) : (
        <div className="sk" style={{ height: 28, width: "58%", borderRadius: 6 }} />
      )}
      <div style={{
        fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
        color: COLORS.midGray, lineHeight: 1.3,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Empty-cache prompt ─────────────────────────────────────────────────────────

function EmptyAI({ message, cta, page, onNavigate }: {
  message: string; cta: string; page: string; onNavigate: (p: string) => void;
}) {
  return (
    <div style={{
      background: COLORS.cream, borderRadius: 14,
      border: `1.5px dashed ${COLORS.lightBorder}`,
      padding: "16px 18px",
      display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 12,
    }}>
      <p style={{
        fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
        margin: 0, lineHeight: 1.5,
      }}>
        {message}
      </p>
      <button
        onClick={() => onNavigate(page)}
        style={{
          background: COLORS.orange, color: COLORS.white, border: "none",
          borderRadius: 20, padding: "7px 14px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          fontFamily: FONTS.body, whiteSpace: "nowrap", flexShrink: 0,
          minWidth: 0, minHeight: 0,
        }}
      >
        {cta} →
      </button>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

// ── Skeleton for AI-generated sections ────────────────────────────────────────

function AISkeleton() {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 16,
      padding: "16px 18px",
      border: `1px solid ${COLORS.lightBorder}`,
      display: "flex", flexDirection: "column", gap: 9,
    }}>
      <div className="sk" style={{ height: 12, width: "35%", borderRadius: 6 }} />
      <div className="sk" style={{ height: 15, width: "88%", borderRadius: 6, animationDelay: "0.05s" }} />
      <div className="sk" style={{ height: 13, width: "96%", borderRadius: 6, animationDelay: "0.1s" }} />
      <div className="sk" style={{ height: 13, width: "72%", borderRadius: 6, animationDelay: "0.15s" }} />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MorningGlance({ aggregatedData, districtConfig, onNavigate }: MorningGlanceProps) {
  // Lazy initializers — instant display if caches already populated
  const [overview,   setOverview]   = useState<string | null>(
    () => getCachedBriefingOverview(districtConfig)?.overview ?? null,
  );
  const [topSignal,  setTopSignal]  = useState<Signal | null>(
    () => getCachedSignals(districtConfig)?.signals?.[0] ?? null,
  );
  const [topConcern, setTopConcern] = useState<PublicConcern | null>(
    () => getCachedConcerns(districtConfig)?.concerns?.[0] ?? null,
  );
  const [overviewLoading,  setOverviewLoading]  = useState(false);
  const [signalsLoading,   setSignalsLoading]   = useState(false);
  const [concernsLoading,  setConcernsLoading]  = useState(false);

  // Auto-generate any missing AI content in parallel when data is ready
  useEffect(() => {
    if (!aggregatedData) return;

    if (!overview) {
      setOverviewLoading(true);
      generateBriefingOverview(aggregatedData, districtConfig)
        .then(({ overview: o }) => setOverview(o))
        .catch(() => {})
        .finally(() => setOverviewLoading(false));
    }

    if (!topSignal) {
      setSignalsLoading(true);
      generateSignals(aggregatedData, districtConfig)
        .then(({ signals }) => setTopSignal(signals[0] ?? null))
        .catch(() => {})
        .finally(() => setSignalsLoading(false));
    }

    if (!topConcern) {
      setConcernsLoading(true);
      generatePublicConcerns(aggregatedData, districtConfig)
        .then(({ concerns }) => setTopConcern(concerns[0] ?? null))
        .catch(() => {})
        .finally(() => setConcernsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregatedData]); // only re-run if aggregatedData reference changes

  // Single resident quote from Supabase
  const [quote, setQuote]           = useState<string | null>(null);
  const [quoteAttrib, setQuoteAttrib] = useState<string | null>(null);

  useEffect(() => {
    // Supabase FK joins return arrays — hearing is { hearing_date }[] | null
    type QuoteRow = { notable_quotes: string[] | null; hearing: { hearing_date: string | null }[] | null };
    (async () => {
      try {
        const { data } = await supabase
          .from("public_sentiment")
          .select("notable_quotes, hearing:hearing_id(hearing_date)")
          .order("id", { ascending: false })
          .limit(15);
        for (const row of (data ?? []) as QuoteRow[]) {
          const q = row.notable_quotes?.[0];
          if (q && q.trim().length > 15) {
            const d = (Array.isArray(row.hearing) ? row.hearing[0] : row.hearing)?.hearing_date;
            setQuote(q.trim());
            setQuoteAttrib(d ? `Public comment, ${formatDate(d)}` : "Public comment, Planning Commission");
            return;
          }
        }
      } catch { /* no quotes — render nothing */ }
    })();
  }, [districtConfig.number]);

  // Stats from aggregatedData
  const ps  = aggregatedData?.permit_summary;
  const pip = aggregatedData?.pipeline_summary;
  const ev  = aggregatedData?.eviction_summary;
  const aff = aggregatedData?.affordable_housing_summary;

  const QUICK_LINKS = [
    { label: "Full Briefing", page: "Briefing",   emoji: "📋" },
    { label: "All Signals",   page: "Signals",    emoji: "📡" },
    { label: "Commission",    page: "Commission", emoji: "🏛️" },
  ];

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      {/* Line-clamp utility — used on signal/concern body text */}
      <style>{`.mg-clamp2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }`}</style>

      <div style={{
        maxWidth: 600, margin: "0 auto",
        padding: "clamp(20px, 5vw, 36px) 16px 36px",
      }}>

        {/* ── 1. HEADER ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 20,
        }}>
          <div>
            <p style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: COLORS.orange, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 5,
            }}>
              {todayFormatted()}
            </p>
            <h1 style={{
              fontFamily: "'Urbanist', sans-serif",
              fontSize: "clamp(24px, 7vw, 32px)", fontWeight: 800,
              color: COLORS.charcoal, lineHeight: 1.15,
              letterSpacing: "-0.02em", margin: 0,
            }}>
              {getGreeting()},<br />{districtConfig.label}.
            </h1>
          </div>
          <CityPulseLogo size={32} />
        </div>

        {/* ── 2. TODAY'S BRIEFING ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel text="This Morning" />
          {overview ? (
            <div style={{
              background: COLORS.orangePale, borderRadius: 16,
              padding: "16px 18px",
              border: `1px solid rgba(212,100,59,0.14)`,
            }}>
              <p style={{
                fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.75,
                color: COLORS.charcoal, margin: "0 0 10px",
              }}>
                {firstSentences(overview, 3)}
              </p>
              <button
                onClick={() => onNavigate("Briefing")}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
                  color: COLORS.orange, cursor: "pointer",
                  minWidth: 0, minHeight: 0,
                }}
              >
                See full briefing →
              </button>
            </div>
          ) : overviewLoading ? (
            <div style={{
              background: COLORS.orangePale, borderRadius: 16,
              padding: "16px 18px",
              border: `1px solid rgba(212,100,59,0.14)`,
              display: "flex", flexDirection: "column", gap: 9,
            }}>
              {[1, 0.85, 0.65].map((w, i) => (
                <div key={i} className="sk" style={{
                  height: 14, width: `${w * 100}%`, borderRadius: 6,
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>
          ) : (
            <EmptyAI
              message="No data available yet — generate a briefing from the home page."
              cta="Home"
              page="Home"
              onNavigate={onNavigate}
            />
          )}
        </div>

        {/* ── 3. KEY NUMBERS ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel text="Key Numbers" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatCard
              num={ps ? ps.total.toLocaleString() : null}
              label="Active Permits"
              bg={COLORS.orangePale}
            />
            <StatCard
              num={pip ? pip.net_pipeline_units.toLocaleString() : null}
              label="Pipeline Units"
              bg={COLORS.softAmber}
            />
            <StatCard
              num={ev ? ev.total.toLocaleString() : null}
              label="Eviction Notices"
              bg={COLORS.softBlue}
            />
            <StatCard
              num={aff ? `${Math.round(aff.affordable_ratio * 100)}%` : null}
              label="Affordable Ratio"
              bg={COLORS.softGreen}
            />
          </div>
        </div>

        {/* ── 4. TOP SIGNAL ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel text="Top Signal" />
          {signalsLoading ? (
            <AISkeleton />
          ) : topSignal ? (
            <button
              onClick={() => onNavigate("Signals")}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: COLORS.white, borderRadius: 16,
                padding: "16px 18px",
                border: `1px solid ${COLORS.lightBorder}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                cursor: "pointer", minWidth: 0, minHeight: 0,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <SeverityBadge level={topSignal.severity} />
              </div>
              <div style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: 15, fontWeight: 800,
                color: COLORS.charcoal, lineHeight: 1.3, marginBottom: 7,
              }}>
                {topSignal.title}
              </div>
              <p className="mg-clamp2" style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.midGray,
                lineHeight: 1.6, margin: 0,
              }}>
                {topSignal.body}
              </p>
              <p style={{
                fontFamily: FONTS.body, fontSize: 12, color: COLORS.orange,
                fontWeight: 700, margin: "10px 0 0",
              }}>
                See all signals →
              </p>
            </button>
          ) : (
            <EmptyAI
              message="No signals available — go to Signals to generate."
              cta="Signals"
              page="Signals"
              onNavigate={onNavigate}
            />
          )}
        </div>

        {/* ── 5. TOP CONCERN ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel text="Top Concern" />
          {concernsLoading ? (
            <AISkeleton />
          ) : topConcern ? (
            <button
              onClick={() => onNavigate("Outlook")}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: COLORS.white, borderRadius: 16,
                padding: "16px 18px",
                border: `1px solid ${COLORS.lightBorder}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                cursor: "pointer", minWidth: 0, minHeight: 0,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <SeverityBadge level={topConcern.severity} />
              </div>
              <div style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: 15, fontWeight: 800,
                color: COLORS.charcoal, lineHeight: 1.3, marginBottom: 7,
              }}>
                {topConcern.headline}
              </div>
              <p className="mg-clamp2" style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.midGray,
                lineHeight: 1.6, margin: 0,
              }}>
                {topConcern.evidence}
              </p>
              <p style={{
                fontFamily: FONTS.body, fontSize: 12, color: COLORS.orange,
                fontWeight: 700, margin: "10px 0 0",
              }}>
                See full outlook →
              </p>
            </button>
          ) : (
            <EmptyAI
              message="No concerns available — go to Outlook to generate."
              cta="Outlook"
              page="Outlook"
              onNavigate={onNavigate}
            />
          )}
        </div>

        {/* ── 6. RESIDENT QUOTE ──────────────────────────────────────────────── */}
        {quote && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text="From the Public Record" />
            <div style={{
              background: COLORS.white, borderRadius: 16,
              padding: "18px 18px 16px",
              border: `1px solid ${COLORS.lightBorder}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 40, lineHeight: 1, color: COLORS.orange,
                flexShrink: 0, marginTop: -3, userSelect: "none",
              }}>
                "
              </span>
              <div>
                <p style={{
                  fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 1.7,
                  color: COLORS.charcoal, fontStyle: "italic", margin: "0 0 7px",
                }}>
                  {quote}
                </p>
                {quoteAttrib && (
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                    margin: 0,
                  }}>
                    — {quoteAttrib}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 7. QUICK LINKS ─────────────────────────────────────────────────── */}
        <div>
          <SectionLabel text="Explore" />
          <div style={{ display: "flex", gap: 10 }}>
            {QUICK_LINKS.map(({ label, page, emoji }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                style={{
                  flex: 1, background: COLORS.white, color: COLORS.charcoal,
                  border: `1px solid ${COLORS.lightBorder}`,
                  borderRadius: 14, padding: "13px 8px",
                  cursor: "pointer", fontFamily: FONTS.body,
                  fontSize: 11, fontWeight: 700, lineHeight: 1.3,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 5,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  minWidth: 0, minHeight: 0,
                }}
              >
                <span style={{ fontSize: 20 }}>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
