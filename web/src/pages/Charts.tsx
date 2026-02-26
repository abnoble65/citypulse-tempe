import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import type { DistrictData, ZipPermitSummary, EvictionSummary, AssessmentSummary } from "../services/aggregator";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import type { DistrictConfig } from "../districts";

interface ChartsProps {
  aggregatedData: DistrictData | null;
  districtConfig: DistrictConfig;
  onNavigate: (page: string) => void;
}

// ── Colour maps ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  complete:  "#5B9A5F",
  issued:    "#D4643B",
  filed:     "#E8845E",
  expired:   "#B0A89E",
  cancelled: "#C0BAB4",
  withdrawn: "#D0CBC6",
  plancheck: "#8E6B5E",
};
const FALLBACK_COLORS = ["#D4643B", "#E8845E", "#D4963B", "#5B9A5F", "#B0A89E", "#7A746D"];
const TYPE_COLORS = ["#D4643B", "#E8845E", "#D4963B", "#5B9A5F", "#8E6B5E", "#B0A89E"];

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

/* ─── SVG DONUT CHART ─────────────────────────── */

interface DonutSegment { name: string; value: number; pct: number; color: string }

function DonutChart({ segments, total, size = 180 }: { segments: DonutSegment[]; total: number; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const radius = size * 0.36, strokeW = size * 0.13;
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
          style={{ transition: "stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease" }}
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={COLORS.charcoal}
        fontFamily="'Urbanist', sans-serif" fontSize={size * 0.17} fontWeight="800">
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill={COLORS.warmGray}
        fontFamily={FONTS.body} fontSize={size * 0.065} fontWeight="500">
        Total Permits
      </text>
    </svg>
  );
}

/* ─── HORIZONTAL BAR (for value by type) ─────── */

function HorizontalBarChart({ entries }: { entries: { type: string; val: number; color: string }[] }) {
  const max = Math.max(...entries.map(d => d.val), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {entries.map(d => (
        <div key={d.type}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 6,
          }}>
            <span style={{
              fontFamily: FONTS.body, fontSize: 14, fontWeight: 600,
              color: COLORS.charcoal,
            }}>{d.type}</span>
            <span style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
              color: COLORS.charcoal, letterSpacing: "-0.02em",
            }}>
              {d.val >= 1 ? `$${d.val.toFixed(1)}M` : `$${(d.val * 1000).toFixed(0)}K`}
            </span>
          </div>
          <div style={{ height: 10, background: COLORS.cream, borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              width: `${(d.val / max) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${d.color}, ${d.color}cc)`,
              borderRadius: 5,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── CARD WRAPPER ───────────────────────────── */

function ChartCard({ title, children, style }: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 20, padding: "clamp(16px, 3vw, 32px)",
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
      ...style,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: COLORS.orange,
        letterSpacing: "0.06em", textTransform: "uppercase",
        marginBottom: 24, fontFamily: FONTS.body, lineHeight: 1.4,
      }}>{title}</div>
      {children}
    </div>
  );
}

/* ─── EVICTION CHART ─────────────────────────── */

const EVICTION_BAR_COLOR = "#B44040";
const EVICTION_TYPE_COLORS = ["#B44040", "#C85C3A", "#D4783B", "#B06A2E", "#9A5828"];

function EvictionChart({ summary }: { summary: EvictionSummary }) {
  const last12 = summary.by_month.slice(-12);
  const maxCount = Math.max(...last12.map(m => m.count), 1);
  const CHART_H = 100; // px

  const topTypes = Object.entries(summary.by_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxTypeCount = topTypes[0]?.[1] ?? 1;

  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>

      {/* Left: type breakdown */}
      <div style={{ flex: "1 1 180px", minWidth: 160 }}>
        <div style={{
          fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 14,
        }}>By Type</div>
        {topTypes.length === 0 ? (
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, fontStyle: "italic" }}>
            No type data available.
          </p>
        ) : topTypes.map(([type, count], i) => (
          <div key={type} style={{ marginBottom: 12 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "baseline", marginBottom: 5,
            }}>
              <span style={{
                fontFamily: FONTS.body, fontSize: 13, fontWeight: 500,
                color: COLORS.charcoal,
              }}>{type}</span>
              <span style={{
                fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                fontWeight: 800, color: COLORS.charcoal,
              }}>{count}</span>
            </div>
            <div style={{ height: 8, background: COLORS.cream, borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${(count / maxTypeCount) * 100}%`,
                height: "100%",
                background: EVICTION_TYPE_COLORS[i % EVICTION_TYPE_COLORS.length],
                borderRadius: 4,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Right: monthly trend */}
      <div style={{ flex: "2 1 280px", minWidth: 240 }}>
        <div style={{
          fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 14,
        }}>Monthly Trend — Last 12 Months</div>

        {/* Bars */}
        <div style={{
          display: "flex", alignItems: "flex-end",
          height: CHART_H, gap: 3,
        }}>
          {last12.map(m => {
            const h = maxCount > 0
              ? Math.max((m.count / maxCount) * CHART_H, m.count > 0 ? 3 : 0)
              : 0;
            return (
              <div
                key={m.month}
                title={`${m.month}: ${m.count} notice${m.count !== 1 ? "s" : ""}`}
                style={{
                  flex: 1, height: h,
                  background: m.count > 0 ? EVICTION_BAR_COLOR : COLORS.lightBorder,
                  borderRadius: "2px 2px 0 0",
                  opacity: m.count === 0 ? 0.35 : 1,
                  transition: "height 0.5s ease",
                  cursor: "default",
                }}
              />
            );
          })}
        </div>

        {/* Month labels */}
        <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
          {last12.map(m => (
            <div key={m.month} style={{
              flex: 1, textAlign: "center",
              fontFamily: FONTS.body, fontSize: 9,
              color: COLORS.warmGray,
            }}>
              {new Date(m.month + "-02").toLocaleDateString("en-US", { month: "short" })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── ASSESSMENT CHART ───────────────────────── */

const ASSESS_COLORS = ["#D4643B", "#E8845E", "#D4963B", "#5B9A5F", "#8E6B5E"];

const USE_CODE_LABELS: Record<string, string> = {
  RES:   "Residential",
  COMM:  "Commercial",
  MISC:  "Miscellaneous",
  INDUS: "Industrial",
  CIE:   "Civic / Institutional",
  PDR:   "Production / Distribution",
  MIPS:  "Office / Services",
};

function AssessmentChart({ summary }: { summary: AssessmentSummary }) {
  if (summary.years.length === 0) {
    return (
      <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, fontStyle: "italic" }}>
        No property assessment data available for this district.
      </p>
    );
  }

  const latestYear = summary.years[summary.years.length - 1];
  const totalBillions = latestYear.total_assessed_usd / 1_000_000_000;

  const useGroups = [...latestYear.use_groups]
    .sort((a, b) => b.total_assessed_usd - a.total_assessed_usd)
    .slice(0, 5);
  const maxGroup = useGroups[0]?.total_assessed_usd ?? 1;

  const yoyText =
    summary.yoy_change_pct !== null
      ? `${summary.yoy_change_pct >= 0 ? "+" : ""}${summary.yoy_change_pct}% YoY`
      : null;
  const yoyPositive = (summary.yoy_change_pct ?? 0) >= 0;

  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>

      {/* Left: headline + use breakdown */}
      <div style={{ flex: "1 1 200px", minWidth: 160 }}>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 36, fontWeight: 800,
            color: COLORS.charcoal, letterSpacing: "-0.02em",
          }}>
            ${totalBillions.toFixed(2)}B
          </span>
          <div>
            <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray }}>
              total assessed value {latestYear.year}
            </span>
            {yoyText && (
              <span style={{
                display: "block",
                fontFamily: "'Urbanist', sans-serif", fontSize: 13, fontWeight: 700,
                color: yoyPositive ? "#5B9A5F" : "#B44040",
                marginTop: 2,
              }}>{yoyText}</span>
            )}
          </div>
        </div>

        <div style={{
          fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 14,
        }}>By Use Type</div>

        {useGroups.map((g, i) => (
          <div key={g.use_code} style={{ marginBottom: 12 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "baseline", marginBottom: 5,
            }}>
              <span style={{
                fontFamily: FONTS.body, fontSize: 13, fontWeight: 500,
                color: COLORS.charcoal,
              }}>{USE_CODE_LABELS[g.use_code] ?? g.use_code}</span>
              <span style={{
                fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                fontWeight: 800, color: COLORS.charcoal,
              }}>
                {g.total_assessed_usd >= 1_000_000_000
                  ? `$${(g.total_assessed_usd / 1_000_000_000).toFixed(2)}B`
                  : `$${(g.total_assessed_usd / 1_000_000).toFixed(0)}M`}
              </span>
            </div>
            <div style={{ height: 8, background: COLORS.cream, borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${(g.total_assessed_usd / maxGroup) * 100}%`,
                height: "100%",
                background: ASSESS_COLORS[i % ASSESS_COLORS.length],
                borderRadius: 4,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Right: top properties */}
      <div style={{ flex: "2 1 280px", minWidth: 220 }}>
        <div style={{
          fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 14,
        }}>Top Properties by Assessed Value</div>

        {summary.top_properties.length === 0 ? (
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, fontStyle: "italic" }}>
            No parcel data available.
          </p>
        ) : summary.top_properties.slice(0, 8).map((p, i) => (
          <div key={p.parcel_number} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 0",
            borderBottom: `1px solid ${COLORS.cream}`,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: i < 3 ? COLORS.orangePale : COLORS.cream,
              color: i < 3 ? COLORS.orange : COLORS.warmGray,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              fontFamily: "'Urbanist', sans-serif",
              border: i < 3 ? `1.5px solid ${COLORS.orange}` : "none",
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: 3,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: COLORS.charcoal,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: "60%",
                }}>{p.address || p.parcel_number}</span>
                <span style={{
                  fontSize: 14, fontWeight: 800, color: COLORS.charcoal,
                  flexShrink: 0, marginLeft: 8,
                  fontFamily: "'Urbanist', sans-serif",
                }}>
                  {p.total_assessed_usd >= 1_000_000_000
                    ? `$${(p.total_assessed_usd / 1_000_000_000).toFixed(2)}B`
                    : `$${(p.total_assessed_usd / 1_000_000).toFixed(1)}M`}
                </span>
              </div>
              {p.neighborhood && (
                <span style={{
                  fontSize: 11, color: COLORS.warmGray,
                  fontFamily: FONTS.body,
                }}>{p.neighborhood}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Charts Skeletons ────────────────────────── */

function ChartsSkeletons() {
  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>
        {/* Header */}
        <div className="sk" style={{ height: 13, width: 60, marginBottom: 16 }} />
        <div className="sk" style={{ height: 42, width: "48%", marginBottom: 10 }} />
        <div className="sk" style={{ height: 13, width: "28%", marginBottom: 36 }} />

        {/* Row 1: Donut + Bar side by side */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          gap: 20, marginBottom: 24,
        }}>
          {/* Donut card */}
          <div style={{
            background: COLORS.white, borderRadius: 20,
            padding: "clamp(16px, 3vw, 32px)",
            border: `1px solid ${COLORS.lightBorder}`,
          }}>
            <div className="sk" style={{ height: 13, width: "52%", marginBottom: 24 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
              {/* Circle donut */}
              <div className="sk" style={{ width: 170, height: 170, borderRadius: "50%", flexShrink: 0 }} />
              {/* Legend items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 140 }}>
                {[55, 45, 65, 40, 50].map((w, i) => (
                  <div key={i} className="sk" style={{ height: 13, width: w + "%" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Bar card */}
          <div style={{
            background: COLORS.white, borderRadius: 20,
            padding: "clamp(16px, 3vw, 32px)",
            border: `1px solid ${COLORS.lightBorder}`,
          }}>
            <div className="sk" style={{ height: 13, width: "60%", marginBottom: 24 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[78, 58, 44, 32, 20].map((w, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div className="sk" style={{ height: 14, width: `${w}%` }} />
                    <div className="sk" style={{ height: 18, width: 64 }} />
                  </div>
                  <div className="sk" style={{ height: 10, width: "100%" }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Notable addresses */}
        <div style={{
          background: COLORS.white, borderRadius: 20,
          padding: "clamp(16px, 3vw, 32px)",
          border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div className="sk" style={{ height: 13, width: "55%", marginBottom: 24 }} />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
            gap: "0 48px",
          }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "13px 0", borderBottom: `1px solid ${COLORS.cream}`,
              }}>
                <div className="sk" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div className="sk" style={{ height: 14, width: "50%" }} />
                    <div className="sk" style={{ height: 16, width: 52 }} />
                  </div>
                  <div className="sk" style={{ height: 6, width: "100%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Eviction skeleton */}
        <div style={{
          background: COLORS.white, borderRadius: 20, marginTop: 24,
          padding: "clamp(16px, 3vw, 32px)",
          border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div className="sk" style={{ height: 13, width: "44%", marginBottom: 6 }} />
          <div className="sk" style={{ height: 11, width: "28%", marginBottom: 24 }} />
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              {[70, 55, 45, 35, 25].map((w, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <div className="sk" style={{ height: 13, width: `${w}%` }} />
                    <div className="sk" style={{ height: 15, width: 28 }} />
                  </div>
                  <div className="sk" style={{ height: 8, width: "100%" }} />
                </div>
              ))}
            </div>
            <div style={{ flex: "2 1 280px" }}>
              <div className="sk" style={{ height: 11, width: "52%", marginBottom: 14 }} />
              <div style={{ display: "flex", alignItems: "flex-end", height: 100, gap: 3 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="sk" style={{ flex: 1, height: `${30 + Math.sin(i) * 25 + 20}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Assessment skeleton */}
        <div style={{
          background: COLORS.white, borderRadius: 20, marginTop: 24,
          padding: "clamp(16px, 3vw, 32px)",
          border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div className="sk" style={{ height: 13, width: "52%", marginBottom: 24 }} />
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div className="sk" style={{ height: 36, width: "60%", marginBottom: 8 }} />
              <div className="sk" style={{ height: 11, width: "40%", marginBottom: 24 }} />
              {[80, 62, 48, 35, 22].map((w, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <div className="sk" style={{ height: 13, width: `${w}%` }} />
                    <div className="sk" style={{ height: 15, width: 48 }} />
                  </div>
                  <div className="sk" style={{ height: 8, width: "100%" }} />
                </div>
              ))}
            </div>
            <div style={{ flex: "2 1 280px" }}>
              <div className="sk" style={{ height: 11, width: "55%", marginBottom: 14 }} />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${COLORS.cream}` }}>
                  <div className="sk" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div className="sk" style={{ height: 13, width: "50%" }} />
                      <div className="sk" style={{ height: 14, width: 52 }} />
                    </div>
                    <div className="sk" style={{ height: 10, width: "30%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CHARTS PAGE ─────────────────────────────── */

export function Charts({ aggregatedData, districtConfig, onNavigate }: ChartsProps) {
  const [filter, setFilter] = useState(districtConfig.allLabel);

  // Reset filter when district changes (new generation)
  useEffect(() => {
    setFilter(districtConfig.allLabel);
  }, [districtConfig.allLabel]);

  if (!aggregatedData) {
    return <ChartsSkeletons />;
  }

  if (aggregatedData.permit_summary.total === 0) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
        <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ textAlign: "center", padding: "48px 32px", maxWidth: 380 }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 12,
            }}>
              No permit data available
            </p>
            <p style={{
              color: COLORS.midGray, fontSize: 14, fontFamily: FONTS.body,
              lineHeight: 1.65, marginBottom: 28,
            }}>
              The DataSF data source may be temporarily unavailable. Try generating a new briefing.
            </p>
            <button onClick={() => onNavigate("Home")} style={{
              background: COLORS.orange, color: COLORS.white, border: "none",
              borderRadius: 24, padding: "12px 28px", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
            }}>← Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // Resolve active permit summary
  const selectedZip = districtConfig.neighborhoods.find(n => n.name === filter)?.zip ?? null;
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

  // Horizontal bar data from cost_by_type (convert to $M)
  const barEntries = Object.entries(activePs.cost_by_type)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, val], i) => ({
      type,
      val: val / 1_000_000,
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }));

  // Notable permits — always district-wide
  const notable = ps.notable_permits
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)
    .slice(0, 10);
  const maxVal = notable[0]?.estimated_cost_usd ?? 1;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
      <NeighborhoodHero districtConfig={districtConfig} selected={filter} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>
        <SectionLabel text="Charts" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          Permit Data at a Glance
        </h2>
        <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginBottom: isSparse ? 8 : 36 }}>
          {activePs.total.toLocaleString()} permits · ${(activePs.total_estimated_cost_usd / 1_000_000).toFixed(1)}M est. value
          {selectedZip && <span> · zip {selectedZip}</span>}
        </p>

        {isSparse && (
          <p style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginBottom: 32, fontStyle: "italic" }}>
            Limited permit activity in this neighborhood — showing available data.
          </p>
        )}

        {/* Row 1: Donut + Value Bars side by side */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          gap: 20, marginBottom: 24,
        }}>
          <ChartCard title="Permit Status Breakdown">
            <div style={{
              display: "flex", alignItems: "center", gap: 32,
              flexWrap: "wrap", justifyContent: "center",
            }}>
              <DonutChart segments={donutSegments} total={activePs.total} size={170} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 140 }}>
                {donutSegments.map(s => (
                  <div key={s.name} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    fontFamily: FONTS.body, fontSize: 13,
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                    <span style={{ color: COLORS.midGray, fontWeight: 500, flex: 1, textTransform: "capitalize" }}>{s.name}</span>
                    <span style={{
                      fontWeight: 800, color: COLORS.charcoal,
                      fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                    }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Estimated Value by Permit Type">
            {barEntries.length > 0 ? (
              <HorizontalBarChart entries={barEntries} />
            ) : (
              <p style={{ color: COLORS.warmGray, fontSize: 13, fontFamily: FONTS.body, fontStyle: "italic", marginTop: 20 }}>
                No cost data available for this selection.
              </p>
            )}
          </ChartCard>
        </div>

        {/* Row 2: Top addresses — district-wide */}
        {notable.length > 0 && (
          <ChartCard title={`Top 10 Addresses by Permit Value (${districtConfig.label})`} style={{ marginBottom: 24 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
              gap: "0 48px",
            }}>
              {notable.map((p, i) => (
                <div key={p.permit_number} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "13px 0",
                  borderBottom: `1px solid ${COLORS.cream}`,
                  fontFamily: FONTS.body,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: i < 3 ? COLORS.orangePale : COLORS.cream,
                    color: i < 3 ? COLORS.orange : COLORS.warmGray,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    fontFamily: "'Urbanist', sans-serif",
                    border: i < 3 ? `1.5px solid ${COLORS.orange}` : "none",
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "baseline", marginBottom: 6,
                    }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: COLORS.charcoal,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: "60%",
                      }}>{p.address || "—"}</span>
                      <span style={{
                        fontSize: 16, fontWeight: 800, color: COLORS.charcoal,
                        flexShrink: 0, marginLeft: 12,
                        fontFamily: "'Urbanist', sans-serif",
                      }}>${(p.estimated_cost_usd / 1_000_000).toFixed(1)}M</span>
                    </div>
                    <div style={{ height: 6, background: COLORS.cream, borderRadius: 3, overflow: "hidden" }}>
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
          </ChartCard>
        )}

        {/* Row 3: Eviction trend — always district-wide */}
        {aggregatedData.eviction_summary && (
          <ChartCard title={`Eviction Notices — ${districtConfig.label}`} style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{
                fontFamily: "'Urbanist', sans-serif", fontSize: 36, fontWeight: 800,
                color: COLORS.charcoal, letterSpacing: "-0.02em",
              }}>
                {aggregatedData.eviction_summary.total.toLocaleString()}
              </span>
              <span style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
                marginLeft: 10, fontWeight: 500,
              }}>
                notices filed in the last 2 years
                {selectedZip && <span style={{ color: COLORS.lightBorder }}> · chart shows district-wide</span>}
              </span>
            </div>
            {aggregatedData.eviction_summary.total === 0 ? (
              <p style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
                fontStyle: "italic",
              }}>
                No eviction notices found for this district in the last 2 years.
              </p>
            ) : (
              <EvictionChart summary={aggregatedData.eviction_summary} />
            )}
          </ChartCard>
        )}

        {/* Row 4: Property Assessment — always district-wide */}
        {aggregatedData.assessment_summary && (
          <ChartCard title={`Property Assessment — ${districtConfig.label}`}>
            <AssessmentChart summary={aggregatedData.assessment_summary} />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
