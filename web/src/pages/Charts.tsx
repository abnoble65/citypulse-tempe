import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { MOCK_PERMITS, MOCK_STATUS, MOCK_VALUE_BY_TYPE } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";

/* ─── SVG DONUT CHART ─────────────────────────── */

function DonutChart({ data, size = 200 }: { data: typeof MOCK_STATUS; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const strokeW = size * 0.12;
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
      <text x={cx} y={cy - 6} textAnchor="middle" fill={COLORS.charcoal}
        fontFamily={FONTS.heading} fontSize={size * 0.15} fontWeight="700">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={COLORS.warmGray}
        fontFamily={FONTS.body} fontSize={size * 0.065} fontWeight="500">
        Total Permits
      </text>
    </svg>
  );
}

/* ─── VERTICAL BAR CHART ──────────────────────── */

function ValueBarChart({ data }: { data: typeof MOCK_VALUE_BY_TYPE }) {
  const max = Math.max(...data.map(d => d.val));
  const barMaxH = 140;

  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      gap: 20, height: barMaxH + 60, padding: "0 8px",
    }}>
      {data.map(d => {
        const h = (d.val / max) * barMaxH;
        return (
          <div key={d.type} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8,
          }}>
            <span style={{
              fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700,
              color: COLORS.charcoal,
            }}>${d.val}M</span>
            <div style={{
              width: 44, height: h, borderRadius: "10px 10px 4px 4px",
              background: `linear-gradient(to top, ${d.color}, ${d.color}dd)`,
              transition: "height 0.6s ease",
            }} />
            <span style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
              color: COLORS.midGray, textAlign: "center", lineHeight: 1.2,
              maxWidth: 56,
            }}>{d.type}</span>
          </div>
        );
      })}
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
          fontFamily: FONTS.heading,
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: 700, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.01em",
          marginBottom: 36,
        }}>
          Permit Data at a Glance
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20, marginBottom: 24,
        }}>
          {/* DONUT CHART CARD */}
          <div style={{
            background: COLORS.white, borderRadius: 20,
            padding: "32px",
            border: `1px solid ${COLORS.lightBorder}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 24, fontFamily: FONTS.body,
              alignSelf: "flex-start",
            }}>Permit Status Breakdown</div>

            <DonutChart data={MOCK_STATUS} size={190} />

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "10px 24px", marginTop: 24, width: "100%",
            }}>
              {MOCK_STATUS.map(s => (
                <div key={s.name} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontFamily: FONTS.body, fontSize: 13,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: s.color, flexShrink: 0,
                  }} />
                  <span style={{ color: COLORS.midGray, fontWeight: 500 }}>{s.name}</span>
                  <span style={{
                    marginLeft: "auto", fontWeight: 700,
                    color: COLORS.charcoal, fontFamily: FONTS.heading,
                  }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* VALUE BY TYPE — BAR CHART */}
          <div style={{
            background: COLORS.white, borderRadius: 20,
            padding: "32px",
            border: `1px solid ${COLORS.lightBorder}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 16, fontFamily: FONTS.body,
            }}>Est. Value by Permit Type</div>

            <ValueBarChart data={MOCK_VALUE_BY_TYPE} />
          </div>
        </div>

        {/* TOP 10 ADDRESSES */}
        <div style={{
          background: COLORS.white, borderRadius: 20,
          padding: "36px",
          border: `1px solid ${COLORS.lightBorder}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: COLORS.orange,
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 28, fontFamily: FONTS.body,
          }}>Top 10 Addresses by Permit Value</div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "0 40px",
          }}>
            {MOCK_PERMITS.map((p, i) => (
              <div key={p.address} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 0",
                borderBottom: i < MOCK_PERMITS.length - 1 ? `1px solid ${COLORS.cream}` : "none",
                fontFamily: FONTS.body,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: i < 3 ? COLORS.orangePale : COLORS.cream,
                  color: i < 3 ? COLORS.orange : COLORS.warmGray,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  fontFamily: FONTS.body,
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
                      fontSize: 15, fontWeight: 700, color: COLORS.charcoal,
                      flexShrink: 0, marginLeft: 12,
                      fontFamily: FONTS.heading,
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
        </div>
      </div>
    </div>
  );
}
