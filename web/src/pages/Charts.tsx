import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import type { DistrictData, ZipPermitSummary } from "../services/aggregator";

interface ChartsProps {
  aggregatedData: DistrictData | null;
  onNavigate: (page: string) => void;
}

// ── Colour maps ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  complete:   COLORS.green,
  issued:     COLORS.orange,
  filed:      COLORS.amber,
  expired:    COLORS.warmGray,
  cancelled:  "#C0BAB4",
  withdrawn:  "#D0CBC6",
  plancheck:  "#8E6B5E",
};
const FALLBACK_COLORS = [COLORS.orange, COLORS.orangeSoft, COLORS.amber, COLORS.green, COLORS.warmGray, COLORS.midGray];

const TYPE_COLORS = [COLORS.orange, COLORS.orangeSoft, COLORS.amber, COLORS.green, "#8E6B5E", COLORS.warmGray];

function statusColor(name: string, idx: number): string {
  return STATUS_COLORS[name.toLowerCase()] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ── Data helpers ───────────────────────────────────────────────────────────────

function toSortedEntries(map: Record<string, number>, top = 6) {
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }));
}

function shortLabel(name: string, max = 18): string {
  const titled = name.charAt(0).toUpperCase() + name.slice(1);
  return titled.length > max ? titled.slice(0, max) + "…" : titled;
}

// ── SVG Donut ─────────────────────────────────────────────────────────────────

interface DonutSegment { name: string; value: number; pct: number; color: string }

function DonutChart({ segments, total, size = 190 }: { segments: DonutSegment[]; total: number; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const radius = size * 0.36, strokeW = size * 0.12;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / (total || 1);
    const offset = circumference * (1 - cumulative) + circumference * 0.25;
    cumulative += pct;
    return { ...seg, dashArray: `${circumference * pct} ${circumference * (1 - pct)}`, offset };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={COLORS.cream} strokeWidth={strokeW} />
      {arcs.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
          stroke={seg.color} strokeWidth={strokeW}
          strokeDasharray={seg.dashArray} strokeDashoffset={seg.offset}
          strokeLinecap="butt"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill={COLORS.charcoal}
        fontFamily={FONTS.heading} fontSize={size * 0.15} fontWeight="700">
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={COLORS.warmGray}
        fontFamily={FONTS.body} fontSize={size * 0.065} fontWeight="500">
        Permits
      </text>
    </svg>
  );
}

// ── Vertical bar chart ─────────────────────────────────────────────────────────

function ValueBarChart({ entries }: { entries: { name: string; value: number; color: string }[] }) {
  const max = Math.max(...entries.map(e => e.value), 1);
  const barMaxH = 140;

  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      gap: 16, height: barMaxH + 64, padding: "0 8px", flexWrap: "wrap",
    }}>
      {entries.map(e => {
        const h = (e.value / max) * barMaxH;
        const label = e.value >= 1_000_000
          ? `$${(e.value / 1_000_000).toFixed(1)}M`
          : `$${Math.round(e.value / 1000)}K`;
        return (
          <div key={e.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: COLORS.charcoal }}>{label}</span>
            <div style={{
              width: 40, height: h, borderRadius: "8px 8px 4px 4px",
              background: `linear-gradient(to top, ${e.color}, ${e.color}cc)`,
              transition: "height 0.6s ease",
              minHeight: 4,
            }} />
            <span style={{
              fontFamily: FONTS.body, fontSize: 10, fontWeight: 600,
              color: COLORS.midGray, textAlign: "center", lineHeight: 1.2, maxWidth: 52,
            }}>{shortLabel(e.name, 12)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Charts({ aggregatedData, onNavigate }: ChartsProps) {
  const [filter, setFilter] = useState("All District 3");

  if (!aggregatedData) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "48px 32px" }}>
          <p style={{ color: COLORS.midGray, fontSize: 15, fontFamily: FONTS.body, marginBottom: 24 }}>
            No data yet. Generate a briefing from the home page.
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

  // Resolve active permit summary (full district or zip bucket)
  const selectedZip = NEIGHBORHOODS.find(n => n.name === filter)?.zip ?? null;
  const ps = aggregatedData.permit_summary;
  const activePs: ZipPermitSummary = selectedZip && ps.by_zip?.[selectedZip]
    ? ps.by_zip[selectedZip]
    : ps;

  const isSparse = selectedZip !== null && activePs.total < 20;

  // Donut segments from by_status
  const statusEntries = toSortedEntries(activePs.by_status);
  const donutSegments: DonutSegment[] = statusEntries.map((e, i) => ({
    name: e.name, value: e.value, pct: e.pct,
    color: statusColor(e.name, i),
  }));

  // Bar chart from cost_by_type
  const costEntries = Object.entries(activePs.cost_by_type)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({ name, value, color: TYPE_COLORS[i % TYPE_COLORS.length] }));

  // Notable permits (top addresses) — always from full district
  const notable = ps.notable_permits
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)
    .slice(0, 10);
  const maxVal = notable[0]?.estimated_cost_usd ?? 1;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="Charts" />
        <h2 style={{
          fontFamily: FONTS.heading,
          fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 8,
        }}>
          Permit Data at a Glance
        </h2>
        <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginBottom: 36 }}>
          {activePs.total.toLocaleString()} permits · ${(activePs.total_estimated_cost_usd / 1_000_000).toFixed(1)}M est. value
          {selectedZip && <span> · zip {selectedZip}</span>}
        </p>

        {isSparse && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
            marginBottom: 20, fontStyle: "italic",
          }}>
            Limited permit activity in this neighborhood — showing available data.
          </p>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20, marginBottom: 24,
        }}>
          {/* DONUT */}
          <div style={{
            background: COLORS.white, borderRadius: 20, padding: "32px",
            border: `1px solid ${COLORS.lightBorder}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 24, fontFamily: FONTS.body, alignSelf: "flex-start",
            }}>Permit Status Breakdown</div>

            <DonutChart segments={donutSegments} total={activePs.total} size={190} />

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "10px 24px", marginTop: 24, width: "100%",
            }}>
              {donutSegments.map(s => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONTS.body, fontSize: 13 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ color: COLORS.midGray, fontWeight: 500 }}>{shortLabel(s.name)}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: COLORS.charcoal, fontFamily: FONTS.heading }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* VALUE BY TYPE */}
          <div style={{
            background: COLORS.white, borderRadius: 20, padding: "32px",
            border: `1px solid ${COLORS.lightBorder}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 16, fontFamily: FONTS.body,
            }}>Est. Value by Permit Type</div>

            {costEntries.length > 0 ? (
              <ValueBarChart entries={costEntries} />
            ) : (
              <p style={{ color: COLORS.warmGray, fontSize: 13, fontFamily: FONTS.body, fontStyle: "italic", marginTop: 40 }}>
                No cost data available for this selection.
              </p>
            )}
          </div>
        </div>

        {/* TOP ADDRESSES BY VALUE — always from full district notable_permits */}
        {notable.length > 0 && (
          <div style={{
            background: COLORS.white, borderRadius: 20, padding: "36px",
            border: `1px solid ${COLORS.lightBorder}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 28, fontFamily: FONTS.body,
            }}>Top Permits by Value (District-wide)</div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "0 40px",
            }}>
              {notable.map((p, i) => (
                <div key={p.permit_number} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 0",
                  borderBottom: i < notable.length - 1 ? `1px solid ${COLORS.cream}` : "none",
                  fontFamily: FONTS.body,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: i < 3 ? COLORS.orangePale : COLORS.cream,
                    color: i < 3 ? COLORS.orange : COLORS.warmGray,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    border: i < 3 ? `1.5px solid ${COLORS.orange}` : "none",
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, color: COLORS.charcoal,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: "60%",
                      }}>{p.address || "—"}</span>
                      <span style={{
                        fontSize: 14, fontWeight: 700, color: COLORS.charcoal,
                        flexShrink: 0, marginLeft: 8, fontFamily: FONTS.heading,
                      }}>${(p.estimated_cost_usd / 1_000_000).toFixed(1)}M</span>
                    </div>
                    {p.description && (
                      <p style={{ fontSize: 11, color: COLORS.warmGray, margin: "0 0 6px", lineHeight: 1.4 }}>
                        {p.description.length > 60 ? p.description.slice(0, 60) + "…" : p.description}
                      </p>
                    )}
                    <div style={{ height: 5, background: COLORS.cream, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${(p.estimated_cost_usd / maxVal) * 100}%`,
                        height: "100%",
                        background: i < 3
                          ? `linear-gradient(90deg, ${COLORS.orange}, ${COLORS.orangeSoft})`
                          : COLORS.lightBorder,
                        borderRadius: 3,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
