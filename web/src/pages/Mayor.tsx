/**
 * Mayor.tsx — CityPulse Mayor's Office News page.
 *
 * Reads from the mayor_news Supabase table (populated by scripts/ingestMayorNews.ts).
 * Filterable by topic pill and district number.
 * Auto-filters to the currently generated district on first load.
 */

import { useState, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { supabase } from "../services/supabase";
import type { DistrictConfig } from "../districts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MayorNewsItem {
  id:         number;
  title:      string;
  date:       string;       // YYYY-MM-DD
  summary:    string | null;
  ai_summary: string | null;
  url:        string | null;
  districts:  string[] | null;
  topics:     string[] | null;
  created_at: string;
}

interface MayorProps {
  districtConfig: DistrictConfig;
}

// ── Topic config ──────────────────────────────────────────────────────────────

const ALL_TOPICS = [
  "housing", "safety", "transit", "business",
  "budget", "parks", "infrastructure", "other",
] as const;

const TOPIC_CFG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  housing:        { bg: "#EBF3FF", text: "#3B6CB5", border: "#C4D9F0", icon: "🏘️" },
  safety:         { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8", icon: "🛡️" },
  transit:        { bg: "#EAF7EE", text: "#3A8A55", border: "#B8DFCA", icon: "🚌" },
  business:       { bg: "#F5EDFF", text: "#7040B5", border: "#DCC8F0", icon: "💼" },
  budget:         { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4", icon: "💰" },
  parks:          { bg: "#E8F7EF", text: "#2D7A52", border: "#A8D8BD", icon: "🌳" },
  infrastructure: { bg: "#EEF2F7", text: "#4A6580", border: "#C4D0DC", icon: "🏗️" },
  other:          { bg: "#F5F4F2", text: "#7A746D", border: "#DDD8D0", icon: "📋" },
};

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Skeleton cards ────────────────────────────────────────────────────────────

function MayorSkeletons() {
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          background: COLORS.white, borderRadius: 20, marginBottom: 16,
          padding: "clamp(18px, 3vw, 28px)",
          border: `1px solid ${COLORS.lightBorder}`,
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div className="sk" style={{ height: 22, width: 90 }} />
            <div className="sk" style={{ height: 22, width: 70 }} />
            <div className="sk" style={{ height: 22, width: 80 }} />
          </div>
          <div className="sk" style={{ height: 20, width: "80%", marginBottom: 8 }} />
          <div className="sk" style={{ height: 14, width: "100%", marginBottom: 6 }} />
          <div className="sk" style={{ height: 14, width: "92%", marginBottom: 6 }} />
          <div className="sk" style={{ height: 14, width: "75%", marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div className="sk" style={{ height: 22, width: 60 }} />
            <div className="sk" style={{ height: 22, width: 70 }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: MayorNewsItem }) {
  const topics    = item.topics   ?? [];
  const districts = item.districts ?? [];

  return (
    <div style={{
      background: COLORS.white, borderRadius: 20, marginBottom: 16,
      padding: "clamp(18px, 3vw, 28px)",
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
      transition: "box-shadow 0.2s",
    }}>
      {/* Top row: date + topic badges */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
          color: COLORS.warmGray,
        }}>
          {fmtDate(item.date)}
        </span>
        {topics.map(t => {
          const cfg = TOPIC_CFG[t] ?? TOPIC_CFG.other;
          return (
            <span key={t} style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: cfg.text, background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 6, padding: "3px 8px",
              textTransform: "capitalize",
              letterSpacing: "0.02em",
            }}>
              {cfg.icon} {t}
            </span>
          );
        })}
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "'Urbanist', sans-serif",
        fontSize: "clamp(15px, 2vw, 18px)",
        fontWeight: 800, color: COLORS.charcoal,
        lineHeight: 1.25, letterSpacing: "-0.01em",
        marginBottom: 10,
      }}>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = COLORS.orange)}
            onMouseLeave={e => (e.currentTarget.style.color = COLORS.charcoal)}
          >
            {item.title}
          </a>
        ) : item.title}
      </h3>

      {/* AI summary */}
      {item.ai_summary && (
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
          color: COLORS.midGray, marginBottom: 14,
        }}>
          {item.ai_summary}
        </p>
      )}

      {/* Footer: districts + source link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        {districts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {districts.map(d => (
              <span key={d} style={{
                fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
                color: COLORS.orange, background: COLORS.orangePale,
                borderRadius: 6, padding: "3px 8px",
              }}>
                {d === "citywide" ? "🌁 Citywide" : `D${d}`}
              </span>
            ))}
          </div>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
              color: COLORS.orange, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            Read full release →
          </a>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Mayor({ districtConfig }: MayorProps) {
  const [items,       setItems]       = useState<MayorNewsItem[] | null>(null);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);

  // Topic filter: null = all topics
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  // District filter: "all" or a district number string
  const initDistrict = districtConfig.number === "0" ? "all" : districtConfig.number;
  const [distFilter,  setDistFilter]  = useState<string>(initDistrict);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("mayor_news")
      .select("*")
      .order("date", { ascending: false })
      .limit(200);

    if (error) {
      setLoadError(error.message);
    } else {
      setItems((data ?? []) as MayorNewsItem[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const visible = (items ?? []).filter(item => {
    // Topic filter
    if (topicFilter) {
      const topics = item.topics ?? [];
      if (!topics.includes(topicFilter)) return false;
    }

    // District filter
    if (distFilter !== "all") {
      const dists = item.districts ?? [];
      // Show if tagged with this district OR citywide OR untagged
      if (
        dists.length > 0 &&
        !dists.includes(distFilter) &&
        !dists.includes("citywide")
      ) return false;
    }

    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      {/* Duotone SVG filter — charcoal shadows (#3D3832) → orange highlights (#D4643B) */}
      <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }} aria-hidden="true">
        <defs>
          <filter id="mayor-duotone" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.592" intercept="0.239" />
              <feFuncG type="linear" slope="0.173" intercept="0.220" />
              <feFuncB type="linear" slope="0.035" intercept="0.196" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* Sticky filter bar */}
      <div className="cp-sticky-bar" style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
        padding: "12px 24px",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {/* Topic pills */}
          <div style={{
            display: "flex", gap: 6, overflowX: "auto",
            paddingBottom: 8, marginBottom: 8,
            scrollbarWidth: "none",
          }}>
            {[null, ...ALL_TOPICS].map(t => {
              const isActive = topicFilter === t;
              const cfg = t ? TOPIC_CFG[t] : null;
              return (
                <button
                  key={t ?? "all"}
                  onClick={() => setTopicFilter(t)}
                  style={{
                    fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
                    background:   isActive ? (cfg?.bg ?? COLORS.orangePale) : "transparent",
                    color:        isActive ? (cfg?.text ?? COLORS.orange) : COLORS.warmGray,
                    border:       `1px solid ${isActive ? (cfg?.border ?? COLORS.orange) : COLORS.lightBorder}`,
                    borderRadius: 20,
                    padding:      "5px 14px",
                    cursor:       "pointer",
                    whiteSpace:   "nowrap",
                    transition:   "all 0.15s",
                    textTransform: "capitalize",
                  }}
                >
                  {t ? `${cfg!.icon} ${t}` : "All Topics"}
                </button>
              );
            })}
          </div>

          {/* District filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: COLORS.warmGray, textTransform: "uppercase",
              letterSpacing: "0.06em", flexShrink: 0,
            }}>
              District
            </span>
            <div style={{
              display: "flex", gap: 5, overflowX: "auto",
              scrollbarWidth: "none",
            }}>
              {[
                { value: "all", label: "All" },
                ...["1","2","3","4","5","6","7","8","9","10","11"].map(n => ({
                  value: n, label: `D${n}`,
                })),
              ].map(opt => {
                const isActive = distFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDistFilter(opt.value)}
                    style={{
                      fontFamily:   FONTS.body, fontSize: 12, fontWeight: 700,
                      background:   isActive ? COLORS.orangePale : "transparent",
                      color:        isActive ? COLORS.orange : COLORS.warmGray,
                      border:       `1px solid ${isActive ? COLORS.orange : COLORS.lightBorder}`,
                      borderRadius: 16,
                      padding:      "4px 12px",
                      cursor:       "pointer",
                      whiteSpace:   "nowrap",
                      transition:   "all 0.15s",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(32px, 5vw, 52px) 24px" }}>

        {/* ── Mayor header ─────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          gap: "clamp(20px, 4vw, 36px)",
          marginBottom: 28, flexWrap: "wrap",
        }}>
          {/* Duotone portrait */}
          <div style={{
            width: 120, height: 120, borderRadius: "50%",
            overflow: "hidden", flexShrink: 0,
            boxShadow: "0 4px 24px rgba(212,100,59,0.22)",
            border: `2.5px solid ${COLORS.orange}`,
          }}>
            <img
              src="/images/mayor-lurie.jpg"
              alt="Mayor Daniel Lurie"
              style={{
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center top",
                display: "block",
                filter: "url(#mayor-duotone)",
              }}
            />
          </div>

          {/* Name + context */}
          <div>
            <div style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: COLORS.orange, textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 6,
            }}>
              Mayor of San Francisco
            </div>
            <h1 style={{
              fontFamily: "'Urbanist', sans-serif",
              fontSize: "clamp(26px, 4vw, 38px)",
              fontWeight: 800, color: COLORS.charcoal,
              letterSpacing: "-0.02em", lineHeight: 1.05,
              marginBottom: 8,
            }}>
              Daniel Lurie
            </h1>
            <p style={{
              fontFamily: FONTS.body, fontSize: 13,
              color: COLORS.warmGray, lineHeight: 1.5,
            }}>
              Elected November 2024 · Took office January 8, 2025
            </p>
          </div>
        </div>

        <hr style={{
          border: "none",
          borderTop: `1px solid ${COLORS.lightBorder}`,
          margin: "0 0 32px",
        }} />

        <SectionLabel text="Mayor's Office" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em",
          marginBottom: 6,
        }}>
          News from the Mayor's Office
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
          marginBottom: 32,
        }}>
          {isLoading
            ? "Loading press releases…"
            : `${visible.length} press release${visible.length !== 1 ? "s" : ""}${
                topicFilter || distFilter !== "all"
                  ? " matching current filters"
                  : ""
              }`}
        </p>

        {/* Loading */}
        {isLoading && <MayorSkeletons />}

        {/* Error */}
        {!isLoading && loadError && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8",
            borderRadius: 16, padding: "28px 24px", textAlign: "center",
            marginBottom: 24,
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: "#B44040", marginBottom: 10,
            }}>
              Could not load press releases
            </p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
              lineHeight: 1.6, marginBottom: 20,
            }}>
              {loadError}
            </p>
            <button
              onClick={load}
              style={{
                background: COLORS.orange, color: COLORS.white, border: "none",
                borderRadius: 24, padding: "10px 24px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty — table exists but no rows */}
        {!isLoading && !loadError && items !== null && items.length === 0 && (
          <div style={{
            background: COLORS.white, borderRadius: 20,
            border: `1px solid ${COLORS.lightBorder}`,
            padding: "48px 32px", textAlign: "center",
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 10,
            }}>
              No press releases yet
            </p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
              lineHeight: 1.65, marginBottom: 4,
            }}>
              Run the ingestion script to populate this table:
            </p>
            <code style={{
              fontFamily: "monospace", fontSize: 13,
              background: COLORS.cream, padding: "6px 14px",
              borderRadius: 8, display: "inline-block",
              color: COLORS.charcoal,
            }}>
              npx tsx scripts/ingestMayorNews.ts
            </code>
          </div>
        )}

        {/* Empty — filters produced no results */}
        {!isLoading && !loadError && items !== null && items.length > 0 && visible.length === 0 && (
          <div style={{
            background: COLORS.white, borderRadius: 20,
            border: `1px solid ${COLORS.lightBorder}`,
            padding: "40px 32px", textAlign: "center",
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 8,
            }}>
              No results match these filters
            </p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray, lineHeight: 1.6,
            }}>
              Try clearing the topic or district filter.
            </p>
          </div>
        )}

        {/* News cards */}
        {!isLoading && visible.map(item => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
