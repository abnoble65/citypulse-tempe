/**
 * MorningGlance.tsx — Daily digest page, route /pulse
 *
 * Apple News+ inspired card-stack layout with scroll-snap on mobile.
 * Each section is a full-screen card; flicking scrolls to the next card.
 * Data flow is unchanged — same caches, same auto-generation.
 */

import { useState, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "../theme";
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

// ── Types ───────────────────────────────────────────────────────────────────────

interface MorningGlanceProps {
  aggregatedData: DistrictData | null;
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────────

const BOOKMARK_KEY = "citypulse_mg_bookmarks";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function firstSentences(text: string, n: number): string {
  const re = /(?<=[.!?])\s+/g;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    count++;
    if (count >= n) return text.slice(0, match.index + 1).trim();
  }
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

function loadBookmarks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

// ── Severity badge ──────────────────────────────────────────────────────────────

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
      padding: "4px 10px", borderRadius: 12,
      fontSize: 11, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase" as const,
      fontFamily: FONTS.body, display: "inline-block",
    }}>
      {level}
    </span>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v11M8.5 6.5L12 3l3.5 3.5" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 10H5a1 1 0 00-1 1v9a1 1 0 001 1h14a1 1 0 001-1v-9a1 1 0 00-1-1h-2"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14a1 1 0 011 1v17l-7-4.5L5 21V4a1 1 0 011-1z"/>
    </svg>
  );
}

// ── Card wrapper ────────────────────────────────────────────────────────────────

function Card({ children, isMobile, style }: {
  children: React.ReactNode;
  isMobile: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 20,
      padding: isMobile ? "28px 22px 22px" : "32px 28px",
      boxShadow: "0 2px 20px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "column",
      ...(isMobile ? {
        scrollSnapAlign: "start" as const,
        scrollSnapStop: "always" as const,
        // height fills visible area (nav=92px, tab=56px+safe-area) minus 52px peek of next card
        minHeight: "calc(100dvh - 92px - 56px - env(safe-area-inset-bottom, 0px) - 52px)",
        marginBottom: 12,
        flexShrink: 0,
      } : {
        marginBottom: 16,
      }),
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Card skeleton ───────────────────────────────────────────────────────────────

function CardSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 20,
      padding: isMobile ? "28px 22px 22px" : "32px 28px",
      boxShadow: "0 2px 20px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 12,
      ...(isMobile ? {
        scrollSnapAlign: "start" as const,
        scrollSnapStop: "always" as const,
        minHeight: "calc(100dvh - 92px - 56px - env(safe-area-inset-bottom, 0px) - 52px)",
        marginBottom: 12, flexShrink: 0,
      } : { marginBottom: 16 }),
    }}>
      <div className="sk" style={{ height: 10, width: "28%", borderRadius: 6 }} />
      <div className="sk" style={{ height: 12, width: "42%", borderRadius: 6, marginTop: 4 }} />
      <div style={{ height: 20 }} />
      {[1, 0.92, 0.84, 0.96, 0.72].map((w, i) => (
        <div key={i} className="sk" style={{
          height: 14, width: `${w * 100}%`, borderRadius: 6,
          animationDelay: `${i * 0.07}s`,
        }} />
      ))}
    </div>
  );
}

// ── Card eyebrow ────────────────────────────────────────────────────────────────

function Eyebrow({ text }: { text: string }) {
  return (
    <p style={{
      fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
      color: COLORS.orange, letterSpacing: "0.12em",
      textTransform: "uppercase", margin: "0 0 16px",
    }}>
      {text}
    </p>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────────

function StatCard({ num, label, bg }: { num: string | null; label: string; bg: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 16,
      padding: "18px 16px 14px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {num != null ? (
        <div style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(22px, 5.5vw, 30px)", fontWeight: 800,
          color: COLORS.charcoal, letterSpacing: "-0.02em", lineHeight: 1,
        }}>
          {num}
        </div>
      ) : (
        <div className="sk" style={{ height: 30, width: "55%", borderRadius: 6 }} />
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

// ── Nav link button ─────────────────────────────────────────────────────────────

function NavLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", padding: 0,
      fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
      color: COLORS.orange, cursor: "pointer",
      minWidth: 0, minHeight: 0,
    }}>
      {label} →
    </button>
  );
}

// ── Action row (share + bookmark) ───────────────────────────────────────────────

function ActionRow({ cardId, shareTitle, shareText, sharePath, bookmarks,
  onToggleBookmark, navLabel, navPage, onNavigate }: {
  cardId: string;
  shareTitle: string;
  shareText: string;
  sharePath: string;
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  navLabel: string;
  navPage: string;
  onNavigate: (page: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isBookmarked = bookmarks.has(cardId);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${sharePath}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `CityPulse: ${shareTitle}`, text: shareText, url });
        return;
      }
    } catch { /* user cancelled */ }
    try {
      await navigator.clipboard.writeText(`CityPulse: ${shareTitle} — ${shareText}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied */ }
  }, [shareTitle, shareText, sharePath]);

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    background: "none", border: "none",
    fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
    cursor: "pointer", padding: "6px 8px", borderRadius: 8,
    minWidth: 0, minHeight: 0, transition: "opacity 0.1s",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderTop: `1px solid ${COLORS.lightBorder}`,
      paddingTop: 14, marginTop: "auto",
    }}>
      <div style={{ display: "flex", gap: 2 }}>
        <button onClick={handleShare} style={{ ...btnStyle, color: COLORS.midGray }}>
          <ShareIcon />
          {copied ? "Copied!" : "Share"}
        </button>
        <button onClick={() => onToggleBookmark(cardId)}
          style={{ ...btnStyle, color: isBookmarked ? COLORS.orange : COLORS.midGray }}>
          <BookmarkIcon filled={isBookmarked} />
          {isBookmarked ? "Saved" : "Save"}
        </button>
      </div>
      <NavLink label={navLabel} onClick={() => onNavigate(navPage)} />
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────

export function MorningGlance({ aggregatedData, districtConfig, onNavigate }: MorningGlanceProps) {

  // ── Mobile detection ──────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── AI data ───────────────────────────────────────────────────────────────────
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
  }, [aggregatedData]);

  // ── Resident quote ────────────────────────────────────────────────────────────
  const [quote, setQuote]           = useState<string | null>(null);
  const [quoteAttrib, setQuoteAttrib] = useState<string | null>(null);

  useEffect(() => {
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
      } catch { /* no quotes */ }
    })();
  }, [districtConfig.number]);

  // ── Bookmarks ─────────────────────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const ps  = aggregatedData?.permit_summary;
  const pip = aggregatedData?.pipeline_summary;
  const ev  = aggregatedData?.eviction_summary;
  const aff = aggregatedData?.affordable_housing_summary;

  const QUICK_LINKS = [
    { label: "Full Briefing", page: "Briefing",   emoji: "📋" },
    { label: "All Signals",   page: "Signals",    emoji: "📡" },
    { label: "Commission",    page: "Commission", emoji: "🏛️" },
  ];

  // ── Container styles ──────────────────────────────────────────────────────────
  // Mobile: fixed-height snap container sitting below the sticky nav (92px) and
  // above the fixed bottom tab (56px + safe-area). Body scroll is disabled on /pulse.
  // Desktop: normal centred scroll with max-width.
  const stackStyle: React.CSSProperties = isMobile
    ? {
        height: "calc(100dvh - 92px)",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        padding: "12px 12px 0",
        // Ensure last card can scroll fully above the fixed bottom tab
        paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 12px)",
        boxSizing: "border-box",
        background: COLORS.cream,
      }
    : {
        maxWidth: 600,
        margin: "0 auto",
        padding: "24px 16px 56px",
        background: COLORS.cream,
        minHeight: "100vh",
      };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: COLORS.cream }}>
      <style>{`
        /* Hide scrollbar in WebKit */
        .mg-stack::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="mg-stack" style={stackStyle}>

        {/* ── CARD 1: MORNING OVERVIEW ─────────────────────────────────────── */}
        {overviewLoading && !overview ? (
          <CardSkeleton isMobile={isMobile} />
        ) : (
          <Card isMobile={isMobile}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", marginBottom: 28,
            }}>
              <div>
                <p style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
                  color: COLORS.orange, letterSpacing: "0.12em",
                  textTransform: "uppercase", margin: "0 0 8px",
                }}>
                  {todayFormatted()}
                </p>
                <h1 style={{
                  fontFamily: "'Urbanist', sans-serif",
                  fontSize: "clamp(26px, 7vw, 36px)", fontWeight: 800,
                  color: COLORS.charcoal, lineHeight: 1.1,
                  letterSpacing: "-0.02em", margin: 0,
                }}>
                  {getGreeting()},<br />{districtConfig.label}.
                </h1>
              </div>
              <CityPulseLogo size={34} />
            </div>

            {/* Overview body */}
            <div style={{
              background: COLORS.cream, borderRadius: 16,
              padding: "18px 20px",
              border: "1px solid rgba(212,100,59,0.12)",
              flex: 1,
            }}>
              {overview ? (
                <>
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.78,
                    color: COLORS.charcoal, margin: "0 0 14px",
                  }}>
                    {firstSentences(overview, 3)}
                  </p>
                  <NavLink label="See full briefing" onClick={() => onNavigate("Briefing")} />
                </>
              ) : (
                <p style={{
                  fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
                  lineHeight: 1.65, margin: 0, fontStyle: "italic",
                }}>
                  Generate a briefing from the home page to see today's overview.
                </p>
              )}
            </div>

            {/* Scroll hint */}
            {isMobile && (
              <p style={{
                fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                textAlign: "center", margin: "14px 0 0", opacity: 0.55,
                letterSpacing: "0.04em",
              }}>
                Swipe for more ↓
              </p>
            )}
          </Card>
        )}

        {/* ── CARD 2: KEY NUMBERS ──────────────────────────────────────────── */}
        <Card isMobile={isMobile}>
          <Eyebrow text="Key Numbers" />
          <h2 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 800,
            color: COLORS.charcoal, lineHeight: 1.15,
            letterSpacing: "-0.02em", margin: "0 0 20px",
          }}>
            {districtConfig.label} at a glance.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <StatCard num={ps ? ps.total.toLocaleString() : null}
              label="Active Permits" bg={COLORS.orangePale} />
            <StatCard num={pip ? pip.net_pipeline_units.toLocaleString() : null}
              label="Pipeline Units" bg={COLORS.softAmber} />
            <StatCard num={ev ? ev.total.toLocaleString() : null}
              label="Eviction Notices" bg={COLORS.softBlue} />
            <StatCard num={aff ? `${Math.round(aff.affordable_ratio * 100)}%` : null}
              label="Affordable Ratio" bg={COLORS.softGreen} />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            borderTop: `1px solid ${COLORS.lightBorder}`,
            paddingTop: 14, marginTop: 16,
          }}>
            <NavLink label="See all charts" onClick={() => onNavigate("Charts")} />
          </div>
        </Card>

        {/* ── CARD 3: TOP SIGNAL ───────────────────────────────────────────── */}
        {signalsLoading && !topSignal ? (
          <CardSkeleton isMobile={isMobile} />
        ) : topSignal ? (
          <Card isMobile={isMobile}>
            <Eyebrow text="Top Signal" />
            <SeverityBadge level={topSignal.severity} />
            <h2 style={{
              fontFamily: "'Urbanist', sans-serif",
              fontSize: "clamp(20px, 4.5vw, 27px)", fontWeight: 800,
              color: COLORS.charcoal, lineHeight: 1.2,
              letterSpacing: "-0.01em", margin: "12px 0 12px",
            }}>
              {topSignal.title}
            </h2>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.75,
              color: COLORS.midGray, margin: 0, flex: 1,
            }}>
              {topSignal.body}
            </p>
            {topSignal.concern && (
              <div style={{
                background: COLORS.cream, borderRadius: 12,
                padding: "14px 16px", marginTop: 16,
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>⚡</span>
                <p style={{
                  fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.65,
                  color: COLORS.charcoal, fontWeight: 500, margin: 0,
                }}>
                  {topSignal.concern}
                </p>
              </div>
            )}
            <ActionRow
              cardId={`signal:${topSignal.title.slice(0, 32)}`}
              shareTitle={topSignal.title}
              shareText={`${topSignal.body.slice(0, 140)}...`}
              sharePath="/signals"
              bookmarks={bookmarks}
              onToggleBookmark={toggleBookmark}
              navLabel="See all signals"
              navPage="Signals"
              onNavigate={onNavigate}
            />
          </Card>
        ) : null}

        {/* ── CARD 4: TOP CONCERN ──────────────────────────────────────────── */}
        {concernsLoading && !topConcern ? (
          <CardSkeleton isMobile={isMobile} />
        ) : topConcern ? (
          <Card isMobile={isMobile}>
            <Eyebrow text="Top Concern" />
            <SeverityBadge level={topConcern.severity} />
            <h2 style={{
              fontFamily: "'Urbanist', sans-serif",
              fontSize: "clamp(20px, 4.5vw, 27px)", fontWeight: 800,
              color: COLORS.charcoal, lineHeight: 1.2,
              letterSpacing: "-0.01em", margin: "12px 0 12px",
            }}>
              {topConcern.headline}
            </h2>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.75,
              color: COLORS.midGray, margin: 0, flex: 1,
            }}>
              {topConcern.evidence}
            </p>
            <ActionRow
              cardId={`concern:${topConcern.headline.slice(0, 32)}`}
              shareTitle={topConcern.headline}
              shareText={`${topConcern.evidence.slice(0, 140)}...`}
              sharePath="/outlook"
              bookmarks={bookmarks}
              onToggleBookmark={toggleBookmark}
              navLabel="See full outlook"
              navPage="Outlook"
              onNavigate={onNavigate}
            />
          </Card>
        ) : null}

        {/* ── CARD 5: RESIDENT QUOTE ───────────────────────────────────────── */}
        {quote && (
          <Card isMobile={isMobile}>
            <Eyebrow text="From the Public Record" />
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ width: "100%" }}>
                <span style={{
                  display: "block",
                  fontFamily: "'Georgia', serif",
                  fontSize: 80, lineHeight: 0.75,
                  color: COLORS.orange, marginBottom: 20,
                  userSelect: "none",
                }}>
                  "
                </span>
                <p style={{
                  fontFamily: FONTS.body, fontSize: 17, lineHeight: 1.75,
                  color: COLORS.charcoal, fontStyle: "italic",
                  margin: "0 0 16px",
                }}>
                  {quote}
                </p>
                {quoteAttrib && (
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
                    margin: 0,
                  }}>
                    — {quoteAttrib}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── CARD 6: YOU'RE CAUGHT UP ─────────────────────────────────────── */}
        <Card isMobile={isMobile}>
          <div style={{
            flex: 1,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center", gap: 6,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: COLORS.softGreen,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 8,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12L10 17L19 7"
                  stroke={COLORS.green} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{
              fontFamily: "'Urbanist', sans-serif",
              fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 800,
              color: COLORS.charcoal, margin: 0, letterSpacing: "-0.02em",
            }}>
              You're caught up.
            </h2>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
              margin: "4px 0 0", lineHeight: 1.5,
            }}>
              Here's what to explore next.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {QUICK_LINKS.map(({ label, page, emoji }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                style={{
                  flex: 1, background: COLORS.cream, color: COLORS.charcoal,
                  border: `1px solid ${COLORS.lightBorder}`,
                  borderRadius: 16, padding: "14px 8px",
                  cursor: "pointer", fontFamily: FONTS.body,
                  fontSize: 11, fontWeight: 700, lineHeight: 1.3,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 6,
                  minWidth: 0, minHeight: 0,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: 22 }}>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}
