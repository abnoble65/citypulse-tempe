import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { MOCK_PERMITS, MOCK_STATUS, MOCK_VALUE_BY_TYPE } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";

/* ─── SVG DONUT CHART ─────────────────────────── */

function DonutChart({ data, size = 180 }: { data: typeof MOCK_STATUS; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const strokeW = size * 0.13;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0);

  let cumulative = 0;
  const segments = data.map(d => {
    const pct = d.value / total;
    const offset = circumference * (1 - cumulative) + circumference * 0.25;
    cumulative += pct;
    return { ...d, dashArray: `${circumference * pct} ${circumference * (1 - pct)}`, offset };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={COLORS.cream} strokeWidth={strokeW} />
      {segments.map((seg, i) => (
        <circle
          key={i} cx={cx} cy={cy} r={radius} fill="none"
          stroke={seg.color} strokeWidth={strokeW}
          strokeDasharray={seg.dashArray}
          strokeDashoffset={seg.offset}
          strokeLinecap="butt"
          style={{ transition: "stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease" }}
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={COLORS.charcoal}
        fontFamily="'Urbanist', sans-serif" fontSize={size * 0.17} fontWeight="800">
        {total}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill={COLORS.warmGray}
        fontFamily={FONTS.body} fontSize={size * 0.065} fontWeight="500">
        Total Permits
      </text>
    </svg>
  );
}

/* ─── HORIZONTAL BAR (for value by type) ─────── */

function HorizontalBarChart({ data }: { data: typeof MOCK_VALUE_BY_TYPE }) {
  const max = Math.max(...data.map(d => d.val));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {data.map(d => (
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
            }}>${d.val}M</span>
          </div>
          <div style={{
            height: 10, background: COLORS.cream,
            borderRadius: 5, overflow: "hidden",
          }}>
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
      background: COLORS.white, borderRadius: 20,
      padding: "32px",
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
      ...style,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: COLORS.orange,
        letterSpacing: "0.06em", textTransform: "uppercase",
        marginBottom: 24, fontFamily: FONTS.body,
        lineHeight: 1.4,
      }}>{title}</div>
      {children}
    </div>
  );
}

/* ─── CHARTS PAGE ─────────────────────────────── */

export function Charts() {
  const [filter, setFilter] = useState("All District 3");
  const maxVal = MOCK_PERMITS[0].value;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="Charts" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em",
          marginBottom: 40,
        }}>
          Permit Data at a Glance
        </h2>

        {/* Row 1: Donut + Value Bars side by side */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20, marginBottom: 24,
        }}>
          {/* DONUT CHART CARD */}
          <ChartCard title="Permit Status Breakdown">
            <div style={{
              display: "flex", alignItems: "center", gap: 32,
              flexWrap: "wrap", justifyContent: "center",
            }}>
              <DonutChart data={MOCK_STATUS} size={170} />
              <div style={{
                display: "flex", flexDirection: "column",
                gap: 12, minWidth: 140,
              }}>
                {MOCK_STATUS.map(s => (
                  <div key={s.name} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    fontFamily: FONTS.body, fontSize: 13,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: 3,
                      background: s.color, flexShrink: 0,
                    }} />
                    <span style={{ color: COLORS.midGray, fontWeight: 500, flex: 1 }}>{s.name}</span>
                    <span style={{
                      fontWeight: 800, color: COLORS.charcoal,
                      fontFamily: "'Urbanist', sans-serif", fontSize: 15,
                    }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          {/* VALUE BY TYPE — HORIZONTAL BARS */}
          <ChartCard title="Estimated Value by Permit Type">
            <HorizontalBarChart data={MOCK_VALUE_BY_TYPE} />
          </ChartCard>
        </div>

        {/* Row 2: Top 10 Addresses — Full Width */}
        <ChartCard title="Top 10 Addresses by Permit Value">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "0 48px",
          }}>
            {MOCK_PERMITS.map((p, i) => (
              <div key={p.address} style={{
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
                    }}>{p.address}</span>
                    <span style={{
                      fontSize: 16, fontWeight: 800, color: COLORS.charcoal,
                      flexShrink: 0, marginLeft: 12,
                      fontFamily: "'Urbanist', sans-serif",
                    }}>${p.value}M</span>
                  </div>
                  <div style={{
                    height: 6, background: COLORS.cream,
                    borderRadius: 3, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${(p.value / maxVal) * 100}%`,
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
      </div>
    </div>
  );
}
