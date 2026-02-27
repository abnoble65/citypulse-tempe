/**
 * Parks.tsx — CityPulse Recreation & Parks Commission page.
 *
 * Reads from recpark_meetings joined with recpark_items
 * (populated by scripts/ingestRecParkMinutes.ts).
 * Shows expandable meeting cards with agenda items.
 * Filterable by topic pill and location keyword search.
 * Auto-filters to relevant topics for the current district on load.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { COLORS, FONTS } from "../theme";
import { SectionLabel } from "../components/SectionLabel";
import { supabase } from "../services/supabase";
import { generateGovHeadlines } from "../services/briefing";
import type { DistrictConfig } from "../districts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecParkItemRow {
  id:          number;
  meeting_id:  number;
  item_letter: string | null;
  title:       string;
  description: string | null;
  action:      string | null;
  vote_result: string | null;
  locations:   string[] | null;
  topics:      string[] | null;
  ai_summary:  string | null;
}

interface RecParkMeetingRow {
  id:           number;
  meeting_date: string;
  meeting_type: string | null;
  pdf_url:      string | null;
  processed_at: string | null;
  recpark_items: RecParkItemRow[] | null;
}

interface ParksProps {
  districtConfig: DistrictConfig;
}

// ── Topic config ──────────────────────────────────────────────────────────────

const ALL_TOPICS = [
  "capital improvements",
  "events",
  "policy",
  "maintenance",
  "community programs",
  "budget",
] as const;

const TOPIC_CFG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "capital improvements": { bg: "#EEF2F7", text: "#4A6580", border: "#C4D0DC", icon: "🏗️" },
  "events":               { bg: "#F5EDFF", text: "#7040B5", border: "#DCC8F0", icon: "🎪" },
  "policy":               { bg: "#F5F4F2", text: "#7A746D", border: "#DDD8D0", icon: "📋" },
  "maintenance":          { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4", icon: "🔧" },
  "community programs":   { bg: "#E8F7EF", text: "#2D7A52", border: "#A8D8BD", icon: "🌳" },
  "budget":               { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4", icon: "💰" },
};

// ── Action badge style ────────────────────────────────────────────────────────

function actionStyle(action: string | null): { bg: string; text: string; border: string } {
  if (!action) return { bg: "#F5F4F2", text: "#7A746D", border: "#DDD8D0" };
  const a = action.toLowerCase();
  if (a.includes("approved") && !a.includes("amended"))
    return { bg: "#EDF5ED", text: "#3D7A3F", border: "#C8E0C8" };
  if (a.includes("amended"))
    return { bg: "#EBF3FF", text: "#3B6CB5", border: "#C4D9F0" };
  if (a.includes("continued") || a.includes("tabled"))
    return { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" };
  if (a.includes("rejected") || a.includes("withdrawn"))
    return { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" };
  return { bg: "#F5F4F2", text: "#7A746D", border: "#DDD8D0" };
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

// ── Skeleton cards ────────────────────────────────────────────────────────────

function ParksSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          background: COLORS.white, borderRadius: 20, marginBottom: 14,
          padding: "22px 24px",
          border: `1px solid ${COLORS.lightBorder}`,
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="sk" style={{ height: 20, width: 220, marginBottom: 8, borderRadius: 6 }} />
              <div className="sk" style={{ height: 14, width: 160, borderRadius: 6 }} />
            </div>
            <div className="sk" style={{ height: 32, width: 100, borderRadius: 16 }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: RecParkItemRow }) {
  const topics    = item.topics    ?? [];
  const locations = item.locations ?? [];
  const aStyle    = actionStyle(item.action);

  return (
    <div style={{
      background: COLORS.cream, borderRadius: 14, marginBottom: 10,
      padding: "16px 18px",
      border: `1px solid ${COLORS.lightBorder}`,
    }}>
      {/* Top row: item letter + topic badges */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {item.item_letter && (
          <span style={{
            fontFamily: "monospace", fontSize: 11, fontWeight: 700,
            color: COLORS.warmGray, background: COLORS.white,
            border: `1px solid ${COLORS.lightBorder}`,
            borderRadius: 6, padding: "3px 8px",
          }}>
            ITEM {item.item_letter}
          </span>
        )}
        {topics.map(t => {
          const cfg = TOPIC_CFG[t] ?? TOPIC_CFG["policy"];
          return (
            <span key={t} style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: cfg.text, background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 6, padding: "3px 8px",
              textTransform: "capitalize",
            }}>
              {cfg.icon} {t}
            </span>
          );
        })}
      </div>

      {/* Title */}
      <p style={{
        fontFamily: "'Urbanist', sans-serif", fontSize: 15, fontWeight: 700,
        color: COLORS.charcoal, lineHeight: 1.3,
        marginBottom: (item.ai_summary || item.description) ? 8 : 10,
      }}>
        {item.title}
      </p>

      {/* AI summary */}
      {(item.ai_summary || item.description) && (
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.65,
          color: COLORS.midGray, marginBottom: 10,
        }}>
          {item.ai_summary ?? item.description}
        </p>
      )}

      {/* Footer: action + vote + locations */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {item.action && (
          <span style={{
            fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
            color: aStyle.text, background: aStyle.bg,
            border: `1px solid ${aStyle.border}`,
            borderRadius: 6, padding: "3px 8px",
          }}>
            {item.action}
          </span>
        )}
        {item.vote_result && (
          <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray }}>
            {item.vote_result}
          </span>
        )}
        {locations.map(loc => (
          <span key={loc} style={{
            fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
            color: "#2D7A52", background: "#E8F7EF",
            border: "1px solid #A8D8BD",
            borderRadius: 6, padding: "3px 8px",
          }}>
            🌳 {loc}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Meeting card ──────────────────────────────────────────────────────────────

function MeetingCard({
  meeting, topicFilter, locationQuery, isExpanded, onToggle,
}: {
  meeting:       RecParkMeetingRow;
  topicFilter:   string | null;
  locationQuery: string;
  isExpanded:    boolean;
  onToggle:      () => void;
}) {
  const allItems = meeting.recpark_items ?? [];
  const lq = locationQuery.trim().toLowerCase();

  const visibleItems = allItems.filter(item => {
    if (topicFilter && !(item.topics ?? []).includes(topicFilter)) return false;
    if (lq) {
      const locs = (item.locations ?? []).map(l => l.toLowerCase());
      const inTitle = item.title.toLowerCase().includes(lq);
      if (!locs.some(l => l.includes(lq)) && !inTitle) return false;
    }
    return true;
  });

  const isFiltered = topicFilter !== null || lq.length > 0;
  const displayCount = isFiltered ? visibleItems.length : allItems.length;

  return (
    <div style={{
      background: COLORS.white, borderRadius: 20, marginBottom: 14,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div>
          <p style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 16, fontWeight: 800,
            color: COLORS.charcoal, marginBottom: 3,
          }}>
            {fmtDate(meeting.meeting_date)}
          </p>
          <p style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray }}>
            {meeting.meeting_type ?? "Full Commission"}
            {" · "}
            {displayCount} item{displayCount !== 1 ? "s" : ""}
            {isFiltered && displayCount !== allItems.length &&
              ` matching filters (${allItems.length} total)`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {meeting.pdf_url && (
            <a
              href={meeting.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
                color: COLORS.warmGray, textDecoration: "none",
                border: `1px solid ${COLORS.lightBorder}`,
                borderRadius: 12, padding: "4px 10px", flexShrink: 0,
              }}
            >
              Agenda ↗
            </a>
          )}
          <button style={{
            fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
            background:   isExpanded ? COLORS.orangePale : COLORS.cream,
            color:        isExpanded ? COLORS.orange : COLORS.charcoal,
            border:       `1px solid ${isExpanded ? COLORS.orange : COLORS.lightBorder}`,
            borderRadius: 16, padding: "6px 14px",
            cursor: "pointer", flexShrink: 0,
          }}>
            {isExpanded ? "Collapse ▲" : "View items ▼"}
          </button>
        </div>
      </div>

      {/* Expanded items */}
      {isExpanded && (
        <div style={{ padding: "0 16px 16px 16px", borderTop: `1px solid ${COLORS.lightBorder}`, animation: "cp-expand-in 0.2s ease" }}>
          {visibleItems.length === 0 ? (
            <p style={{
              fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
              padding: "20px 8px", textAlign: "center",
            }}>
              No items match the current filters for this meeting.
            </p>
          ) : (
            <div style={{ marginTop: 14 }}>
              {visibleItems.map(item => <ItemCard key={item.id} item={item} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Parks({ districtConfig: _districtConfig }: ParksProps) {
  const [meetings,     setMeetings]     = useState<RecParkMeetingRow[] | null>(null);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [expanded,     setExpanded]     = useState<Set<number>>(new Set());
  const [govHeadlines, setGovHeadlines] = useState<string[]>([]);

  const [topicFilter,    setTopicFilter]    = useState<string | null>(null);
  const [locationQuery,  setLocationQuery]  = useState<string>("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("recpark_meetings")
      .select("*, recpark_items(*)")
      .order("meeting_date", { ascending: false })
      .limit(30);

    if (error) {
      setLoadError(error.message);
    } else {
      const rows = (data ?? []) as RecParkMeetingRow[];
      setMeetings(rows);
      if (rows.length > 0) setExpanded(new Set([rows[0].id]));
      // Generate headline from 1 capital improvements or policy item
      const topItems = rows
        .flatMap(m => m.recpark_items ?? [])
        .filter(i => (i.topics ?? []).includes("capital improvements") || (i.topics ?? []).includes("policy"))
        .slice(0, 1);
      generateGovHeadlines(topItems, "citypulse_parks_headlines")
        .then(setGovHeadlines).catch(() => {});
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleMeeting(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const lq = locationQuery.trim().toLowerCase();

  const visibleMeetings = useMemo(() => {
    if (!meetings) return [];
    const isFiltered = topicFilter !== null || lq.length > 0;
    if (!isFiltered) return meetings;
    return meetings.filter(m =>
      (m.recpark_items ?? []).some(item => {
        if (topicFilter && !(item.topics ?? []).includes(topicFilter)) return false;
        if (lq) {
          const locs = (item.locations ?? []).map(l => l.toLowerCase());
          return locs.some(l => l.includes(lq)) || item.title.toLowerCase().includes(lq);
        }
        return true;
      })
    );
  }, [meetings, topicFilter, lq]);

  const totalItems = useMemo(
    () => (meetings ?? []).reduce((sum, m) => sum + (m.recpark_items?.length ?? 0), 0),
    [meetings],
  );

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>

      {/* Sticky filter bar */}
      <div className="cp-sticky-bar" style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
        padding: "12px 24px",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Topic pills */}
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap",
            marginBottom: 8,
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
                    borderRadius: 20, padding: "5px 14px",
                    cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                    textTransform: "capitalize",
                  }}
                >
                  {t ? `${cfg!.icon} ${t}` : "All Topics"}
                </button>
              );
            })}
          </div>

          {/* Location search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: COLORS.warmGray, textTransform: "uppercase",
              letterSpacing: "0.06em", flexShrink: 0,
            }}>
              Park
            </span>
            <input
              type="text"
              placeholder="Search park or facility name…"
              value={locationQuery}
              onChange={e => setLocationQuery(e.target.value)}
              style={{
                fontFamily: FONTS.body, fontSize: 13,
                color: COLORS.charcoal,
                background: COLORS.cream,
                border: `1px solid ${locationQuery ? COLORS.orange : COLORS.lightBorder}`,
                borderRadius: 20, padding: "5px 14px",
                outline: "none", width: "100%", maxWidth: 280,
                transition: "border-color 0.15s",
              }}
            />
            {locationQuery && (
              <button
                onClick={() => setLocationQuery("")}
                style={{
                  fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
                  color: COLORS.warmGray, background: "transparent",
                  border: `1px solid ${COLORS.lightBorder}`,
                  borderRadius: 12, padding: "4px 10px", cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(32px, 5vw, 52px) 24px" }}>
        {govHeadlines.length > 0 && (
          <>
            <SectionLabel text="Headlines" />
            <div style={{ marginBottom: 40 }}>
              {govHeadlines.map((h, i) => (
                <div key={i} style={{
                  fontFamily: "'Urbanist', sans-serif",
                  fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800,
                  color: COLORS.charcoal, lineHeight: 1.25,
                  paddingBottom: 16, marginBottom: 16,
                  borderBottom: i < govHeadlines.length - 1
                    ? `1px solid ${COLORS.lightBorder}` : undefined,
                }}>{h}</div>
              ))}
            </div>
          </>
        )}

        <SectionLabel text="Recreation & Parks" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em",
          marginBottom: 6,
        }}>
          Commission Meetings
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
          marginBottom: 32,
        }}>
          {isLoading
            ? "Loading meeting records…"
            : `${visibleMeetings.length} meeting${visibleMeetings.length !== 1 ? "s" : ""}, ${totalItems.toLocaleString()} agenda items`}
        </p>

        {isLoading && <ParksSkeletons />}

        {!isLoading && loadError && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8",
            borderRadius: 16, padding: "28px 24px", textAlign: "center", marginBottom: 24,
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: "#B44040", marginBottom: 10,
            }}>Could not load meeting records</p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
              lineHeight: 1.6, marginBottom: 20,
            }}>{loadError}</p>
            <button onClick={load} style={{
              background: COLORS.orange, color: COLORS.white, border: "none",
              borderRadius: 24, padding: "10px 24px", fontSize: 13,
              fontWeight: 700, cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
            }}>Retry</button>
          </div>
        )}

        {!isLoading && !loadError && meetings !== null && meetings.length === 0 && (
          <div style={{
            background: COLORS.white, borderRadius: 20,
            border: `1px solid ${COLORS.lightBorder}`,
            padding: "48px 32px", textAlign: "center",
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 10,
            }}>No meeting records yet</p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
              lineHeight: 1.65, marginBottom: 4,
            }}>Run the ingestion script to populate this table:</p>
            <code style={{
              fontFamily: "monospace", fontSize: 13, background: COLORS.cream,
              padding: "6px 14px", borderRadius: 8, display: "inline-block", color: COLORS.charcoal,
            }}>npx tsx scripts/ingestRecParkMinutes.ts</code>
          </div>
        )}

        {!isLoading && !loadError && meetings !== null && meetings.length > 0 && visibleMeetings.length === 0 && (
          <div style={{
            background: COLORS.white, borderRadius: 20,
            border: `1px solid ${COLORS.lightBorder}`,
            padding: "40px 32px", textAlign: "center",
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 8,
            }}>No meetings match these filters</p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray, lineHeight: 1.6,
            }}>Try clearing the topic filter or location search.</p>
          </div>
        )}

        {!isLoading && visibleMeetings.map(meeting => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            topicFilter={topicFilter}
            locationQuery={locationQuery}
            isExpanded={expanded.has(meeting.id)}
            onToggle={() => toggleMeeting(meeting.id)}
          />
        ))}
      </div>
    </div>
  );
}
