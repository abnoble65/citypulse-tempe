import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { renderInlineMarkdown } from "../components/MarkdownText";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { SupervisorAvatar } from "../components/SupervisorAvatar";
import {
  generateOutlook, getCachedOutlook,
  generatePublicConcerns, getCachedConcerns,
} from "../services/briefing";
import { ResidentQuotes } from "../components/ResidentQuotes";
import type {
  OutlookData, OutlookEvent, OutlookRisk, OutlookEngagement, PublicConcern,
} from "../services/briefing";
import type { DistrictData } from "../services/aggregator";
import type { DistrictConfig } from "../districts";
import { useLanguage } from "../contexts/LanguageContext";

interface OutlookProps {
  aggregatedData: DistrictData | null;
  districtConfig: DistrictConfig;
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
      }}>{renderInlineMarkdown(event.detail)}</p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
          color: COLORS.charcoal, flexShrink: 0, marginTop: 1,
          letterSpacing: "0.03em",
        }}>IMPACT →</span>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.6,
          color: COLORS.charcoal, fontWeight: 500, margin: 0,
        }}>{renderInlineMarkdown(event.impact)}</p>
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
      }}>{renderInlineMarkdown(risk.detail)}</p>
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
        }}>{renderInlineMarkdown(item.detail)}</p>
      </div>
    </div>
  );
}

/* ─── Public Concern card ────────────────────── */

const CONCERN_SEVERITY_CFG = {
  critical: { label: "CRITICAL", bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" },
  alert:    { label: "ALERT",    bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" },
  watch:    { label: "WATCH",    bg: COLORS.softBlue, text: "#4A6FA5", border: "#C8D8E8" },
} as const;

function ConcernCard({ concern }: { concern: PublicConcern }) {
  const cfg = CONCERN_SEVERITY_CFG[concern.severity] ?? CONCERN_SEVERITY_CFG.watch;
  return (
    <div style={{
      display: "flex", gap: 16, alignItems: "flex-start",
      padding: "20px 0",
      borderBottom: `1px solid ${COLORS.lightBorder}`,
    }}>
      <span style={{
        fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
        color: cfg.text, background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 6, padding: "4px 10px",
        whiteSpace: "nowrap", flexShrink: 0, marginTop: 2,
        letterSpacing: "0.04em",
      }}>{cfg.label}</span>
      <div>
        <div style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 16,
          fontWeight: 700, color: COLORS.charcoal, marginBottom: 6,
        }}>{concern.headline}</div>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
          color: COLORS.midGray, margin: 0, marginBottom: 6,
        }}>{renderInlineMarkdown(concern.evidence)}</p>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.65,
          color: COLORS.charcoal, fontWeight: 500, margin: 0, marginBottom: 4,
        }}>
          <strong>Affects: </strong>{renderInlineMarkdown(concern.affects)}
        </p>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.65,
          color: COLORS.charcoal, fontWeight: 500, margin: 0,
        }}>
          <strong>Action: </strong>{renderInlineMarkdown(concern.action)}
        </p>
      </div>
    </div>
  );
}

/* ─── Helper ─────────────────────────────────── */

function formatLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Generated today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Generated ${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

/* ─── Page ───────────────────────────────────── */

export function Outlook({ aggregatedData, districtConfig }: OutlookProps) {
  const { language } = useLanguage();
  console.log("[OUTLOOK] RENDER", { hasData: !!aggregatedData, filter: districtConfig.allLabel });

  const [filter, setFilter]               = useState(districtConfig.allLabel);
  const [outlook, setOutlook]             = useState<OutlookData | null>(
    () => getCachedOutlook(districtConfig, undefined, language)?.outlook ?? null,
  );
  const [lastUpdated, setLastUpdated]     = useState<string | null>(
    () => getCachedOutlook(districtConfig, undefined, language)?.generatedAt ?? null,
  );
  const [isGenerating, setIsGenerating]   = useState(
    () => !!aggregatedData && !getCachedOutlook(districtConfig, undefined, language),
  );
  const [genError, setGenError]           = useState<string | null>(null);

  const [concerns, setConcerns]                             = useState<PublicConcern[] | null>(
    () => getCachedConcerns(districtConfig, undefined, language)?.concerns ?? null,
  );
  const [isConcernsGenerating, setIsConcernsGenerating]     = useState(
    () => !!aggregatedData && !getCachedConcerns(districtConfig, undefined, language),
  );
  const [concernsError, setConcernsError]                   = useState<string | null>(null);

  // Reset filter when district changes
  useEffect(() => {
    setFilter(districtConfig.allLabel);
  }, [districtConfig.allLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate (no debounce) generate — used by Retry button
  function doGenerate(focus?: { zip: string; name: string }) {
    if (!aggregatedData) return;
    setIsGenerating(true);
    setIsConcernsGenerating(true);
    setGenError(null);
    setConcernsError(null);

    generateOutlook(aggregatedData, districtConfig, focus, language)
      .then(({ outlook: o, generatedAt }) => {
        setOutlook(o);
        setLastUpdated(generatedAt);
      })
      .catch(err => {
        console.error("[Outlook] generation failed:", err);
        setGenError(err instanceof Error ? err.message : "Generation failed");
      })
      .finally(() => setIsGenerating(false));

    generatePublicConcerns(aggregatedData, districtConfig, focus, language)
      .then(({ concerns: c }) => setConcerns(c))
      .catch(err => {
        console.error("[Outlook] concerns generation failed:", err);
        setConcernsError(err instanceof Error ? err.message : "Generation failed");
      })
      .finally(() => setIsConcernsGenerating(false));
  }

  // Generate when filter changes (also fires on mount).
  useEffect(() => {
    console.log("[OUTLOOK] EFFECT fired", { hasData: !!aggregatedData, isGenerating, hasOutlook: !!outlook, filter });
    if (!aggregatedData) {
      console.log("[OUTLOOK] EFFECT early-return — no aggregatedData");
      return;
    }
    const neighborhood = districtConfig.neighborhoods.find(n => n.name === filter);
    const focus = neighborhood ? { zip: neighborhood.zip, name: neighborhood.name } : undefined;

    // Synchronous cache check — instant display, no loading flash
    const cachedOutlook  = getCachedOutlook(districtConfig, focus, language);
    const cachedConcerns = getCachedConcerns(districtConfig, focus, language);

    if (cachedOutlook) {
      setOutlook(cachedOutlook.outlook);
      setLastUpdated(cachedOutlook.generatedAt);
      setIsGenerating(false);
    }
    if (cachedConcerns) {
      setConcerns(cachedConcerns.concerns);
      setIsConcernsGenerating(false);
    }
    if (cachedOutlook && cachedConcerns) return;

    // Not cached — debounce 300ms before calling Claude
    if (!cachedOutlook) { setIsGenerating(true); setGenError(null); }
    if (!cachedConcerns) { setIsConcernsGenerating(true); setConcernsError(null); }

    const timer = setTimeout(() => {
      if (!cachedOutlook) {
        generateOutlook(aggregatedData, districtConfig, focus, language)
          .then(({ outlook: o, generatedAt }) => {
            setOutlook(o);
            setLastUpdated(generatedAt);
          })
          .catch(err => {
            console.error("[Outlook] generation failed:", err);
            setGenError(err instanceof Error ? err.message : "Generation failed");
          })
          .finally(() => setIsGenerating(false));
      }
      if (!cachedConcerns) {
        generatePublicConcerns(aggregatedData, districtConfig, focus, language)
          .then(({ concerns: c }) => setConcerns(c))
          .catch(err => {
            console.error("[Outlook] concerns generation failed:", err);
            setConcernsError(err instanceof Error ? err.message : "Generation failed");
          })
          .finally(() => setIsConcernsGenerating(false));
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, aggregatedData, language]); // re-run when filter, language, or data changes

  // aggregatedData is null when the user lands directly via URL (refresh/bookmark).
  // App.tsx auto-fetches it behind the LoadingOverlay; show skeletons here as fallback.
  if (!aggregatedData) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(80px,12vw,120px) 24px" }}>
          <div style={{
            background: COLORS.white, borderRadius: 20,
            padding: "8px clamp(20px,4vw,44px) 4px",
            border: `1px solid ${COLORS.lightBorder}`,
            marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: "24px 0", borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 10 }}>
                  <div className="sk" style={{ height: 22, flex: 1, minWidth: 120 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <div className="sk" style={{ height: 22, width: 84 }} />
                    <div className="sk" style={{ height: 22, width: 62 }} />
                  </div>
                </div>
                <div className="sk" style={{ height: 13, width: "100%", marginBottom: 8 }} />
                <div className="sk" style={{ height: 13, width: "88%", marginBottom: 8 }} />
                <div className="sk" style={{ height: 13, width: "60%" }} />
              </div>
            ))}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
            gap: 16, marginBottom: 24,
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                background: COLORS.cream, borderRadius: 16, padding: "24px 28px",
                border: `1px solid ${COLORS.lightBorder}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div className="sk" style={{ height: 24, width: "62%" }} />
                  <div className="sk" style={{ height: 22, width: 60 }} />
                </div>
                <div className="sk" style={{ height: 13, width: "100%", marginBottom: 8 }} />
                <div className="sk" style={{ height: 13, width: "78%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeNeighborhood = districtConfig.neighborhoods.find(n => n.name === filter);
  const locationLabel = activeNeighborhood ? activeNeighborhood.name : districtConfig.label;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
      <NeighborhoodHero districtConfig={districtConfig} selected={filter} aggregatedData={aggregatedData} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>

        {districtConfig.number !== "0" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <SupervisorAvatar districtNumber={districtConfig.number} size={60} showName={true} />
          </div>
        )}
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
          marginBottom: lastUpdated ? 8 : 36,
        }}>
          Powered by live DataSF permit activity and development pipeline data.
        </p>
        {lastUpdated && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
            marginBottom: 36, opacity: 0.75,
          }}>
            {formatLastUpdated(lastUpdated)}
          </p>
        )}

        {/* Loading spinner + skeletons */}
        {isGenerating && (
          <>
            <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <div style={{
                width: 20, height: 20, flexShrink: 0,
                border: "2.5px solid #EDE8E3", borderTopColor: COLORS.orange,
                borderRadius: "50%", animation: "cp-spin 0.75s linear infinite",
              }} />
              <p style={{
                fontFamily: FONTS.body, fontSize: 14, fontWeight: 500,
                color: COLORS.warmGray, margin: 0,
              }}>
                Building your {locationLabel} outlook…
              </p>
            </div>

            {/* Key Events skeleton */}
            <SectionLabel text="Key Events" />
            <div style={{
              background: COLORS.white, borderRadius: 20,
              padding: "8px clamp(20px, 4vw, 44px) 4px",
              border: `1px solid ${COLORS.lightBorder}`,
              marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ padding: "24px 0", borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                    <div className="sk" style={{ height: 22, flex: 1, minWidth: 120 }} />
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <div className="sk" style={{ height: 22, width: 84 }} />
                      <div className="sk" style={{ height: 22, width: 62 }} />
                    </div>
                  </div>
                  <div className="sk" style={{ height: 13, width: "100%", marginBottom: 8 }} />
                  <div className="sk" style={{ height: 13, width: "88%", marginBottom: 8 }} />
                  <div className="sk" style={{ height: 13, width: "60%" }} />
                </div>
              ))}
            </div>

            {/* Risks skeleton */}
            <SectionLabel text="Risks & Downside Scenarios" />
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
              gap: 16, marginBottom: 24,
            }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  background: COLORS.cream, borderRadius: 16, padding: "24px 28px",
                  border: `1px solid ${COLORS.lightBorder}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div className="sk" style={{ height: 24, width: "62%" }} />
                    <div className="sk" style={{ height: 22, width: 60 }} />
                  </div>
                  <div className="sk" style={{ height: 13, width: "100%", marginBottom: 8 }} />
                  <div className="sk" style={{ height: 13, width: "88%", marginBottom: 8 }} />
                  <div className="sk" style={{ height: 13, width: "70%" }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Error state */}
        {!isGenerating && genError && (
          <div style={{
            background: COLORS.cream, border: `1px solid ${COLORS.lightBorder}`, borderRadius: 16,
            padding: "36px 32px", textAlign: "center", marginBottom: 24,
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 10,
            }}>Outlook is being generated</p>
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray, lineHeight: 1.6, marginBottom: 24 }}>
              Check back shortly. If this persists, reload the page.
            </p>
            <button
              onClick={() => {
                const nb = districtConfig.neighborhoods.find(n => n.name === filter);
                doGenerate(nb ? { zip: nb.zip, name: nb.name } : undefined);
              }}
              style={{
                background: COLORS.orange, color: COLORS.white, border: "none",
                borderRadius: 24, padding: "11px 28px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
              }}
            >
              Retry
            </button>
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
                  Contact your Supervisor's office for neighborhood liaison support.
                </div>
              </>
            )}
          </>
        )}

        {/* Public Concerns */}
        {(isConcernsGenerating || !!concerns || !!concernsError) && (
          <>
            <SectionLabel text="Public Concerns" />
            <div style={{
              background: COLORS.white, borderRadius: 20,
              padding: "clamp(20px, 5vw, 40px) clamp(16px, 4vw, 44px)",
              border: `1px solid ${COLORS.lightBorder}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
              marginBottom: 24,
            }}>
              <h2 style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 800, color: COLORS.charcoal,
                lineHeight: 1.15, letterSpacing: "-0.02em",
                marginBottom: 8,
              }}>
                What the data raises for residents.
              </h2>
              <p style={{
                fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
                color: COLORS.midGray, marginBottom: 8,
              }}>
                Based on current permit activity and development pipeline for {locationLabel}.
              </p>

              {/* Concerns loading skeletons */}
              {isConcernsGenerating && (
                <>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      display: "flex", gap: 16,
                      padding: "20px 0",
                      borderBottom: `1px solid ${COLORS.lightBorder}`,
                    }}>
                      <div className="sk" style={{ height: 26, width: 72, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <div className="sk" style={{ height: 18, width: "70%", marginBottom: 10 }} />
                        <div className="sk" style={{ height: 13, width: "100%", marginBottom: 8 }} />
                        <div className="sk" style={{ height: 13, width: "88%", marginBottom: 8 }} />
                        <div className="sk" style={{ height: 13, width: "60%" }} />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Concerns error */}
              {!isConcernsGenerating && concernsError && (
                <p style={{
                  fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
                  lineHeight: 1.6, marginTop: 8,
                }}>
                  Concerns are being generated. Check back shortly.
                </p>
              )}

              {/* Concern cards */}
              {!isConcernsGenerating && concerns && concerns.map((concern, i) => (
                <ConcernCard key={i} concern={concern} />
              ))}
            </div>
          </>
        )}

        {/* Resident quotes — district-filtered, one per hearing, most recent first */}
        <ResidentQuotes
          districtConfig={districtConfig}
          priorityAddresses={(aggregatedData?.permit_summary.notable_permits ?? []).slice(0, 5).map(p => p.address)}
          style={{ marginBottom: 24 }}
        />

        {/* Data freshness */}
        {lastUpdated && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
            textAlign: "center", paddingBottom: 8,
          }}>
            {formatLastUpdated(lastUpdated)} · Data from DataSF
          </p>
        )}
      </div>
    </div>
  );
}
