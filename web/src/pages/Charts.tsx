import { useState, useEffect, lazy, Suspense } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import type { DistrictData, PermitSummary, ZipPermitSummary, EvictionSummary, AssessmentSummary, AffordableHousingSummary } from "../services/aggregator";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { fetchDistrictBoundaries } from "../services/neighborhoodBoundaries";
import type { GeoFeature } from "../services/neighborhoodBoundaries";
import { DISTRICTS } from "../districts";
import type { DistrictConfig } from "../districts";

const MapViewLazy = lazy(() =>
  import("../components/MapView").then(m => ({ default: m.MapView }))
);

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

/* ─── AFFORDABLE HOUSING CHART ───────────────── */

const STATUS_COLORS_AH: Record<string, string> = {
  "Construction":                          "#5B9A5F",
  "Building Rehabilitation (Construction)": "#7AB87E",
  "Pre-Construction":                      "#D4963B",
  "Building Rehabilitation (Pre-Construction)": "#E8B86E",
};
const AMI_COLORS = ["#B44040", "#D4643B", "#D4963B", "#8E6B5E", "#B0A89E"];
const AMI_LABELS = ["Deep Affordable (≤50% AMI)", "Low Income (51–80%)", "Moderate (81–120%)", "Workforce (>120%)", "Undeclared"];

function AffordableHousingChart({ summary }: { summary: AffordableHousingSummary }) {
  if (summary.total_projects === 0) {
    return (
      <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, fontStyle: "italic" }}>
        No affordable housing pipeline data found for this district.
      </p>
    );
  }

  const pct = Math.round(summary.affordable_ratio * 100);
  const ami = summary.ami_distribution;
  const amiEntries = [
    { label: AMI_LABELS[0], value: ami.deep_affordable },
    { label: AMI_LABELS[1], value: ami.low_income },
    { label: AMI_LABELS[2], value: ami.moderate },
    { label: AMI_LABELS[3], value: ami.workforce },
    { label: AMI_LABELS[4], value: ami.undeclared },
  ].filter(e => e.value > 0);
  const maxAmi = Math.max(...amiEntries.map(e => e.value), 1);

  const statusEntries = Object.entries(summary.by_status_units)
    .sort((a, b) => (STATUS_ORDER_AH[a[0]] ?? 9) - (STATUS_ORDER_AH[b[0]] ?? 9));
  const maxStatusUnits = Math.max(...statusEntries.map(e => e[1]), 1);

  return (
    <div>
      {/* Headline row */}
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 28 }}>
        {[
          { label: "Projects in pipeline", value: summary.total_projects.toLocaleString(), sub: null },
          { label: "Affordable units", value: summary.total_affordable_units.toLocaleString(), sub: `${pct}% of pipeline` },
          { label: "Market-rate units", value: summary.total_market_rate_units.toLocaleString(), sub: `${100 - pct}% of pipeline` },
        ].map(stat => (
          <div key={stat.label} style={{ minWidth: 120 }}>
            <div style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 32, fontWeight: 800,
              color: COLORS.charcoal, letterSpacing: "-0.02em", lineHeight: 1,
            }}>{stat.value}</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 4 }}>
              {stat.label}
              {stat.sub && <span style={{ display: "block", color: COLORS.midGray }}>{stat.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        {/* Left: by status */}
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <div style={{
            fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
            color: COLORS.warmGray, textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 14,
          }}>Affordable Units by Phase</div>

          {statusEntries.map(([status, units]) => (
            <div key={status} style={{ marginBottom: 12 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: 5,
              }}>
                <span style={{
                  fontFamily: FONTS.body, fontSize: 12, fontWeight: 500,
                  color: COLORS.charcoal,
                  maxWidth: "70%",
                }}>{STATUS_LABELS_AH[status] ?? status}</span>
                <span style={{
                  fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                  fontWeight: 800, color: COLORS.charcoal,
                }}>{units.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: COLORS.cream, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${(units / maxStatusUnits) * 100}%`,
                  height: "100%",
                  background: STATUS_COLORS_AH[status] ?? COLORS.orange,
                  borderRadius: 4,
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Right: AMI distribution */}
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <div style={{
            fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
            color: COLORS.warmGray, textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 14,
          }}>Income Targeting (AMI)</div>

          {amiEntries.map((e, i) => (
            <div key={e.label} style={{ marginBottom: 12 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: 5,
              }}>
                <span style={{
                  fontFamily: FONTS.body, fontSize: 12, fontWeight: 500,
                  color: COLORS.charcoal, maxWidth: "70%",
                }}>{e.label}</span>
                <span style={{
                  fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                  fontWeight: 800, color: COLORS.charcoal,
                }}>{e.value.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: COLORS.cream, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${(e.value / maxAmi) * 100}%`,
                  height: "100%",
                  background: AMI_COLORS[i % AMI_COLORS.length],
                  borderRadius: 4,
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Far right: active project list */}
        <div style={{ flex: "2 1 260px", minWidth: 220 }}>
          <div style={{
            fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
            color: COLORS.warmGray, textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 14,
          }}>Active Projects</div>

          {summary.projects.slice(0, 8).map((p) => (
            <div key={p.project_id} style={{
              padding: "10px 0",
              borderBottom: `1px solid ${COLORS.cream}`,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", gap: 8, marginBottom: 3,
              }}>
                <span style={{
                  fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
                  color: COLORS.charcoal,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: "65%",
                }}>{p.name || p.address || p.project_id}</span>
                <span style={{
                  fontFamily: "'Urbanist', sans-serif", fontSize: 13, fontWeight: 800,
                  color: COLORS.charcoal, flexShrink: 0,
                }}>{p.affordable_units} units</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: FONTS.body, fontSize: 11,
                  color: STATUS_COLORS_AH[p.status] ?? COLORS.warmGray,
                  fontWeight: 600,
                }}>{STATUS_LABELS_AH[p.status] ?? p.status}</span>
                {p.neighborhood && (
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray }}>
                    · {p.neighborhood}
                  </span>
                )}
                {p.affordable_pct > 0 && (
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray }}>
                    · {p.affordable_pct}% affordable
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Readable labels and sort order for project status
const STATUS_LABELS_AH: Record<string, string> = {
  "Construction":                               "Under Construction",
  "Building Rehabilitation (Construction)":     "Rehab (Active)",
  "Pre-Construction":                           "Pre-Construction",
  "Building Rehabilitation (Pre-Construction)": "Rehab (Pre-Construction)",
};
const STATUS_ORDER_AH: Record<string, number> = {
  "Construction": 0,
  "Building Rehabilitation (Construction)": 1,
  "Pre-Construction": 2,
  "Building Rehabilitation (Pre-Construction)": 3,
};

/* ─── DISTRICT COMPARISON CHART (citywide only) ─ */

const DISTRICT_COLORS = [
  "#D4643B","#E8845E","#D4963B","#5B9A5F","#4A7FD0",
  "#8E6B5E","#B44040","#7AB87E","#C85C3A","#B0A89E","#9A5828",
];

function DistrictComparisonChart({ ps, byDistrict }: { ps: PermitSummary; byDistrict?: Record<string, DistrictData> }) {
  const entries = Object.values(DISTRICTS)
    .map((d, i) => {
      // Prefer by_district (direct per-district data) over by_zip lookup
      const bucket = byDistrict?.[d.number]?.permit_summary ?? ps.by_zip[d.number];
      return {
        label: `D${d.number}`,
        fullName: d.label,
        count: bucket?.total ?? 0,
        cost: (bucket?.total_estimated_cost_usd ?? 0) / 1_000_000,
        color: DISTRICT_COLORS[i % DISTRICT_COLORS.length],
      };
    })
    .sort((a, b) => b.count - a.count);

  console.log('[DistrictChart]', entries.map(e => `${e.label}:${e.count}`).join(' '));

  const maxCount = Math.max(...entries.map(e => e.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {entries.map(e => (
        <div key={e.label}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 5,
          }}>
            <span style={{
              fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
              color: COLORS.charcoal,
            }}>{e.fullName}</span>
            <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
              <span style={{
                fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                fontWeight: 800, color: COLORS.charcoal,
              }}>{e.count.toLocaleString()}</span>
              {e.cost > 0 && (
                <span style={{
                  fontFamily: FONTS.body, fontSize: 11,
                  color: COLORS.warmGray, minWidth: 48, textAlign: "right",
                }}>
                  ${e.cost.toFixed(0)}M
                </span>
              )}
            </div>
          </div>
          <div style={{ height: 9, background: COLORS.cream, borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              width: `${(e.count / maxCount) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${e.color}, ${e.color}cc)`,
              borderRadius: 5,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Charts Skeletons ────────────────────────── */

function ChartsSkeletons() {
  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(32px, 5vw, 52px) 24px" }}>
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

        {/* Row 5: Affordable housing skeleton */}
        <div style={{
          background: COLORS.white, borderRadius: 20, marginTop: 24,
          padding: "clamp(16px, 3vw, 32px)",
          border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div className="sk" style={{ height: 13, width: "48%", marginBottom: 24 }} />
          {/* Headline stats */}
          <div style={{ display: "flex", gap: 32, marginBottom: 28 }}>
            {[80, 60, 60].map((w, i) => (
              <div key={i}>
                <div className="sk" style={{ height: 32, width: w, marginBottom: 6 }} />
                <div className="sk" style={{ height: 11, width: w + 20 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[0, 1, 2].map(col => (
              <div key={col} style={{ flex: col === 2 ? "2 1 260px" : "1 1 200px", minWidth: 180 }}>
                <div className="sk" style={{ height: 11, width: "55%", marginBottom: 14 }} />
                {Array.from({ length: col === 2 ? 6 : 4 }).map((_, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <div className="sk" style={{ height: 12, width: `${60 - i * 8}%` }} />
                      <div className="sk" style={{ height: 14, width: 36 }} />
                    </div>
                    {col < 2 && <div className="sk" style={{ height: 8, width: "100%" }} />}
                    {col === 2 && <div className="sk" style={{ height: 10, width: "45%" }} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CHARTS PAGE ─────────────────────────────── */

export function Charts({ aggregatedData, districtConfig, onNavigate }: ChartsProps) {
  const [filter, setFilter] = useState(districtConfig.allLabel);
  const [boundaries, setBoundaries] = useState<Map<string, GeoFeature>>(new Map());

  // Reset filter when district changes (new generation)
  useEffect(() => {
    setFilter(districtConfig.allLabel);
  }, [districtConfig.allLabel]);

  // Fetch neighborhood boundaries whenever the district changes.
  useEffect(() => {
    setBoundaries(new Map());
    fetchDistrictBoundaries(districtConfig).then(setBoundaries);
  }, [districtConfig.number]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Citywide vs single-district data routing ──────────────────────────────
  const isCitywide = districtConfig.number === "0";
  // In citywide mode the "zip" field of a neighborhood is the district number ("1"–"11").
  const selectedZip = districtConfig.neighborhoods.find(n => n.name === filter)?.zip ?? null;

  // When a district pill is selected in citywide mode, use that district's full data
  // for eviction / assessment / affordable housing charts.
  const activeFullData = isCitywide && selectedZip && aggregatedData.by_district?.[selectedZip]
    ? aggregatedData.by_district[selectedZip]
    : aggregatedData;

  const ps = activeFullData.permit_summary;
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

  // Notable permits — from active data
  const notable = activeFullData.permit_summary.notable_permits
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)
    .slice(0, 10);
  const maxVal = notable[0]?.estimated_cost_usd ?? 1;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
      <NeighborhoodHero districtConfig={districtConfig} selected={filter} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(32px, 5vw, 52px) 24px" }}>
        <SectionLabel text="Charts" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
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

        {/* Row 0: Permit location map */}
        {aggregatedData.map_permits.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel text="Permit Map" />
            <h3 style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: "clamp(18px, 2.5vw, 24px)",
              fontWeight: 800, color: COLORS.charcoal, letterSpacing: "-0.01em",
              marginBottom: 4,
            }}>
              Active Permit Locations
            </h3>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginBottom: 16 }}>
              {selectedZip
                ? `Showing permits in zip ${selectedZip} · select a marker for details`
                : `Showing up to ${aggregatedData.map_permits.length} most-recent permits · select a marker for details`}
            </p>
            <Suspense fallback={
              <div style={{
                height: 420, borderRadius: 16,
                background: COLORS.lightBorder,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
              }}>
                Loading map…
              </div>
            }>
              <MapViewLazy
                permits={aggregatedData.map_permits}
                districtConfig={districtConfig}
                activeZip={isCitywide ? null : selectedZip}
                boundaries={isCitywide ? new Map() : boundaries}
                activeNeighborhoodName={
                  isCitywide ? null : (districtConfig.neighborhoods.find(n => n.name === filter)?.name ?? null)
                }
              />
            </Suspense>
          </div>
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
          <ChartCard title={`Top Addresses by Permit Value — ${selectedZip && isCitywide ? districtConfig.neighborhoods.find(n=>n.zip===selectedZip)?.name ?? districtConfig.label : districtConfig.label}`} style={{ marginBottom: 24 }}>
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

        {/* Row 2b: District comparison (citywide mode only) */}
        {isCitywide && !selectedZip && (
          <ChartCard title="Permits by District — All San Francisco" style={{ marginBottom: 24 }}>
            <DistrictComparisonChart ps={aggregatedData.permit_summary} byDistrict={aggregatedData.by_district} />
          </ChartCard>
        )}

        {/* Row 3: Eviction trend */}
        {activeFullData.eviction_summary && (
          <ChartCard
            title={`Eviction Notices — ${selectedZip && isCitywide ? districtConfig.neighborhoods.find(n=>n.zip===selectedZip)?.name ?? districtConfig.label : districtConfig.label}`}
            style={{ marginBottom: 24 }}
          >
            <div style={{ marginBottom: 20 }}>
              <span style={{
                fontFamily: "'Urbanist', sans-serif", fontSize: 36, fontWeight: 800,
                color: COLORS.charcoal, letterSpacing: "-0.02em",
              }}>
                {activeFullData.eviction_summary.total.toLocaleString()}
              </span>
              <span style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
                marginLeft: 10, fontWeight: 500,
              }}>
                notices filed in the last 2 years
              </span>
            </div>
            {activeFullData.eviction_summary.total === 0 ? (
              <p style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
                fontStyle: "italic",
              }}>
                No eviction notices found for this selection in the last 2 years.
              </p>
            ) : (
              <EvictionChart summary={activeFullData.eviction_summary} />
            )}
          </ChartCard>
        )}

        {/* Row 4: Property Assessment */}
        {activeFullData.assessment_summary && (
          <ChartCard
            title={`Property Assessment — ${selectedZip && isCitywide ? districtConfig.neighborhoods.find(n=>n.zip===selectedZip)?.name ?? districtConfig.label : districtConfig.label}`}
            style={{ marginBottom: 24 }}
          >
            <AssessmentChart summary={activeFullData.assessment_summary} />
          </ChartCard>
        )}

        {/* Row 5: Affordable Housing Pipeline */}
        {activeFullData.affordable_housing_summary && (
          <ChartCard title={`Affordable Housing Pipeline — ${selectedZip && isCitywide ? districtConfig.neighborhoods.find(n=>n.zip===selectedZip)?.name ?? districtConfig.label : districtConfig.label}`}>
            <AffordableHousingChart summary={activeFullData.affordable_housing_summary} />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
