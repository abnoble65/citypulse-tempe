import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { generateOutlook } from "../services/briefing";
import type { OutlookData, OutlookEvent, OutlookRisk, OutlookEngagement } from "../services/briefing";
import type { DistrictData } from "../services/aggregator";

interface OutlookProps {
  aggregatedData: DistrictData | null;
  onNavigate: (page: string) => void;
}

/* ─── Priority badge ─────────────────────────── */

const PRIORITY_CFG = {
  high:   { label: "HIGH",   bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" },
  medium: { label: "MEDIUM", bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" },
  low:    { label: "LOW",    bg: COLORS.softBlue, text: "#4A6FA5", border: "#C8D8E8" },
} as const;

function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const cfg = PRIORITY_CFG[priority] ?? PRIORITY_CFG.low;
  return (
    <span style={{
      fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
      color: cfg.text, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 6, padding: "4px 10px",
      whiteSpace: "nowrap", flexShrink: 0,
      letterSpacing: "0.04em",
    }}>{cfg.label}</span>
  );
}

/* ─── Watch item (events) ────────────────────── */

function WatchItem({ event }: { event: OutlookEvent }) {
  return (
    <div style={{ padding: "24px 0", borderBottom: `1px solid ${COLORS.lightBorder}` }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: 16, marginBottom: 10, flexWrap: "wrap",
      }}>
        <h3 style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 18,
          fontWeight: 700, color: COLORS.charcoal, lineHeight: 1.3,
          margin: 0, flex: 1,
        }}>{event.title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
            color: COLORS.orange, background: COLORS.orangePale,
            borderRadius: 6, padding: "4px 12px",
            whiteSpace: "nowrap",
          }}>{event.timeframe}</span>
          <PriorityBadge priority={event.priority} />
        </div>
      </div>
      <p style={{
        fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.75,
        color: COLORS.midGray, marginBottom: 10,
      }}>{event.detail}</p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
          color: COLORS.charcoal, flexShrink: 0, marginTop: 1,
          letterSpacing: "0.03em",
        }}>IMPACT →</span>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.6,
          color: COLORS.charcoal, fontWeight: 500, margin: 0,
        }}>{event.impact}</p>
      </div>
    </div>
  );
}

/* ─── Risk card ──────────────────────────────── */

function RiskCard({ risk }: { risk: OutlookRisk }) {
  return (
    <div style={{
      background: COLORS.cream, borderRadius: 16, padding: "24px 28px",
      border: `1px solid ${COLORS.lightBorder}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>{risk.icon}</span>
          <h4 style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 16,
            fontWeight: 700, color: COLORS.charcoal, margin: 0,
          }}>{risk.title}</h4>
        </div>
        <PriorityBadge priority={risk.priority} />
      </div>
      <p style={{
        fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
        color: COLORS.midGray, margin: 0,
      }}>{risk.detail}</p>
    </div>
  );
}

/* ─── Engagement card ────────────────────────── */

function EngagementCard({ item }: { item: OutlookEngagement }) {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 14, padding: "20px 24px",
      border: `1px solid ${COLORS.lightBorder}`,
      display: "flex", alignItems: "flex-start", gap: 14,
    }}>
      <span style={{
        fontSize: 20, flexShrink: 0, marginTop: 2,
        width: 36, height: 36, borderRadius: "50%",
        background: COLORS.softBlue,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>🏛️</span>
      <div>
        <div style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 15,
          fontWeight: 700, color: COLORS.charcoal, marginBottom: 6,
        }}>{item.title}</div>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.65,
          color: COLORS.midGray, margin: 0,
        }}>{item.detail}</p>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────── */

export function Outlook({ aggregatedData, onNavigate }: OutlookProps) {
  const [filter, setFilter]             = useState("All District 3");
  const [outlook, setOutlook]           = useState<OutlookData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]         = useState<string | null>(null);

  // Generate when filter changes (also fires on mount).
  useEffect(() => {
    if (!aggregatedData) return;

    const neighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip !== null);

    setIsGenerating(true);
    setGenError(null);

    generateOutlook(
      aggregatedData,
      neighborhood ? { zip: neighborhood.zip!, name: neighborhood.name } : undefined,
    )
      .then(d => setOutlook(d))
      .catch(err => {
        console.error("[Outlook] generation failed:", err);
        setGenError(err instanceof Error ? err.message : "Generation failed");
      })
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]); // intentionally only re-run when filter changes

  if (!aggregatedData) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "48px 32px", maxWidth: 380 }}>
          <p style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
            color: COLORS.charcoal, marginBottom: 12,
          }}>
            No data available
          </p>
          <p style={{ color: COLORS.midGray, fontSize: 14, fontFamily: FONTS.body, lineHeight: 1.65, marginBottom: 28 }}>
            Generate a briefing from the home page to view the outlook.
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

  const activeNeighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip);
  const locationLabel = activeNeighborhood ? activeNeighborhood.name : "District 3";

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <NeighborhoodHero selected={filter} aggregatedData={aggregatedData} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>

        <SectionLabel text="The Outlook" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8,
        }}>
          What to watch in the months ahead for {locationLabel}.
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
          marginBottom: 36,
        }}>
          Powered by live DataSF permit activity and development pipeline data.
        </p>

        {/* Loading spinner */}
        {isGenerating && (
          <div style={{
            background: COLORS.white, borderRadius: 20, padding: "60px 32px",
            border: `1px solid ${COLORS.orange}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 16, marginBottom: 24,
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none" stroke={COLORS.orange} strokeWidth="3"
                strokeDasharray="66" strokeDashoffset="50" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate"
                  from="0 18 18" to="360 18 18" dur="0.75s" repeatCount="indefinite" />
              </circle>
            </svg>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: COLORS.charcoal }}>
              Projecting {locationLabel} development outlook…
            </div>
          </div>
        )}

        {/* Error state */}
        {!isGenerating && genError && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8", borderRadius: 16,
            padding: "36px 32px", textAlign: "center", marginBottom: 24,
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: "#B44040", marginBottom: 10,
            }}>Failed to generate outlook</p>
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray, lineHeight: 1.6, margin: 0 }}>
              {genError}
            </p>
          </div>
        )}

        {outlook && !isGenerating && (
          <>
            {/* Key Events */}
            {outlook.events.length > 0 && (
              <>
                <SectionLabel text="Key Events" />
                <div style={{
                  background: COLORS.white, borderRadius: 20, padding: "8px clamp(20px, 4vw, 44px) 4px",
                  border: `1px solid ${COLORS.lightBorder}`,
                  marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
                }}>
                  {outlook.events.map((event, i) => (
                    <WatchItem key={i} event={event} />
                  ))}
                </div>
              </>
            )}

            {/* Risks */}
            {outlook.risks.length > 0 && (
              <>
                <SectionLabel text="Risks & Downside Scenarios" />
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
                  gap: 16, marginBottom: 24,
                }}>
                  {outlook.risks.map((risk, i) => (
                    <RiskCard key={i} risk={risk} />
                  ))}
                </div>
              </>
            )}

            {/* Civic Engagement */}
            {outlook.engagement.length > 0 && (
              <>
                <SectionLabel text="Civic Engagement" />
                <div style={{
                  display: "flex", flexDirection: "column", gap: 12, marginBottom: 24,
                }}>
                  {outlook.engagement.map((item, i) => (
                    <EngagementCard key={i} item={item} />
                  ))}
                </div>
                <div style={{
                  background: COLORS.softBlue, borderRadius: 16, padding: "24px 28px",
                  border: "1px solid #C8D8E8", marginBottom: 24,
                  fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.75, color: COLORS.midGray,
                }}>
                  <strong style={{ color: COLORS.charcoal }}>How to participate: </strong>
                  Planning Commission hearings are open to the public. Written comments submitted
                  48+ hours before a hearing are included in the Commission's packet. Active permits
                  can be tracked and commented on through the SF Planning Department portal.
                  Contact the District 3 Supervisor's office for neighborhood liaison support.
                </div>
              </>
            )}
          </>
        )}

        {/* CTA */}
        <div style={{
          background: COLORS.orangePale, borderRadius: 20, padding: "clamp(24px, 5vw, 44px)",
          textAlign: "center", border: `1px solid ${COLORS.lightBorder}`,
        }}>
          <div style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 26,
            fontWeight: 800, marginBottom: 12, color: COLORS.charcoal,
          }}>Want fresh intelligence?</div>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, color: COLORS.midGray,
            marginBottom: 28, fontWeight: 500,
          }}>Generate a new briefing with the latest data.</p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white, border: "none",
            borderRadius: 28, padding: "14px 36px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
            boxShadow: "0 4px 16px rgba(212,100,59,0.2)",
          }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
