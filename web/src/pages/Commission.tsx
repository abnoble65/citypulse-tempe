import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { MOCK_HEARINGS } from "../data";
import type { Hearing } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";

function actionStyle(action: string) {
  if (action === "Approved") return { bg: "#EDF5ED", text: "#3D7A3F", border: "#C8E0C8" };
  if (action === "Continued") return { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" };
  return { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" };
}

/* ─── Sentiment Bar ──────────────────────────── */

function SentimentBar({ forCount, against, neutral, total }: {
  forCount: number; against: number; neutral: number; total: number;
}) {
  const forPct = (forCount / total) * 100;
  const againstPct = (against / total) * 100;
  const neutralPct = (neutral / total) * 100;

  return (
    <div>
      <div style={{
        display: "flex", height: 12, borderRadius: 6,
        overflow: "hidden", marginBottom: 10,
      }}>
        <div style={{ width: `${forPct}%`, background: "#5B9A5F", transition: "width 0.4s" }} />
        <div style={{ width: `${neutralPct}%`, background: "#B0A89E", transition: "width 0.4s" }} />
        <div style={{ width: `${againstPct}%`, background: "#D4643B", transition: "width 0.4s" }} />
      </div>
      <div style={{
        display: "flex", gap: 20, fontSize: 12,
        fontFamily: FONTS.body, fontWeight: 600,
      }}>
        <span style={{ color: "#3D7A3F" }}>● {forCount} Support</span>
        <span style={{ color: "#B0A89E" }}>● {neutral} Neutral</span>
        <span style={{ color: "#D4643B" }}>● {against} Oppose</span>
      </div>
    </div>
  );
}

/* ─── Detail Card ────────────────────────────── */

function HearingDetailCard({ hearing }: { hearing: Hearing }) {
  const d = hearing.detail;
  const s = d.publicSentiment;

  return (
    <div style={{
      borderTop: `2px solid ${COLORS.orange}`,
      padding: "32px 0 8px",
      animation: "fadeSlideIn 0.35s ease-out",
    }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Major Actions */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: 12, fontFamily: FONTS.body,
        }}>Major Development Actions</div>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.75,
          color: COLORS.charcoal,
        }}>{d.majorActions}</p>
      </div>

      {/* Commissioner Concerns */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: 12, fontFamily: FONTS.body,
        }}>Commissioner Concerns</div>
        {d.commissionerConcerns.map((c, i) => (
          <div key={i} style={{
            display: "flex", gap: 14, alignItems: "flex-start",
            padding: "14px 0",
            borderBottom: i < d.commissionerConcerns.length - 1
              ? `1px solid ${COLORS.cream}` : "none",
          }}>
            <div style={{
              background: COLORS.softAmber, borderRadius: 8,
              padding: "6px 12px", flexShrink: 0,
              fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
              color: "#B47A2E", whiteSpace: "nowrap",
            }}>{c.name}</div>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
              color: COLORS.midGray,
            }}>{c.concern}</p>
          </div>
        ))}
      </div>

      {/* Public Impact */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: 12, fontFamily: FONTS.body,
        }}>What This Means for Residents</div>
        {d.publicImpact.map((impact, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            marginBottom: 12,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: COLORS.orange, flexShrink: 0,
              marginTop: 8,
            }} />
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
              color: COLORS.midGray,
            }}>{impact}</p>
          </div>
        ))}
      </div>

      {/* Public Sentiment */}
      {s && (
        <div style={{
          background: COLORS.cream, borderRadius: 16,
          padding: "28px 32px",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16,
            flexWrap: "wrap", gap: 8,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.06em", textTransform: "uppercase",
              fontFamily: FONTS.body,
            }}>Public Comment Sentiment</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: 22, fontWeight: 800, color: COLORS.charcoal,
              }}>{s.speakers}</span>
              <span style={{
                fontFamily: FONTS.body, fontSize: 12,
                color: COLORS.warmGray, fontWeight: 500,
              }}>speakers</span>
              {s.source === "sfgovtv_captions" && (
                <span style={{
                  background: COLORS.softBlue, color: "#4A6FA5",
                  fontSize: 10, fontWeight: 700,
                  padding: "3px 8px", borderRadius: 4,
                  fontFamily: FONTS.body, marginLeft: 4,
                  letterSpacing: "0.03em",
                }}>VIA SFGOVTV</span>
              )}
            </div>
          </div>

          <SentimentBar
            forCount={s.forProject}
            against={s.againstProject}
            neutral={s.neutral}
            total={s.speakers}
          />

          {/* Top Themes */}
          <div style={{ marginTop: 20, marginBottom: 18 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: COLORS.midGray,
              letterSpacing: "0.04em", textTransform: "uppercase",
              marginBottom: 10, fontFamily: FONTS.body,
            }}>Top Themes Raised</div>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8,
            }}>
              {s.topThemes.map((theme, i) => (
                <span key={i} style={{
                  background: COLORS.white,
                  border: `1px solid ${COLORS.lightBorder}`,
                  borderRadius: 20, padding: "6px 14px",
                  fontSize: 13, fontFamily: FONTS.body,
                  color: COLORS.charcoal, fontWeight: 500,
                }}>{theme}</span>
              ))}
            </div>
          </div>

          {/* Notable Quotes */}
          {s.notableQuotes.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.midGray,
                letterSpacing: "0.04em", textTransform: "uppercase",
                marginBottom: 10, fontFamily: FONTS.body,
              }}>Notable Public Testimony</div>
              {s.notableQuotes.map((q, i) => (
                <div key={i} style={{
                  borderLeft: `3px solid ${COLORS.orange}`,
                  paddingLeft: 16, marginBottom: 12,
                }}>
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 14,
                    lineHeight: 1.7, color: COLORS.charcoal,
                    fontStyle: "italic",
                  }}>"{q}"</p>
                </div>
              ))}
            </div>
          )}

          {/* Video link */}
          {d.videoUrl && (
            <a href={d.videoUrl} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginTop: 12, fontSize: 13, fontWeight: 600,
              color: COLORS.orange, fontFamily: FONTS.body,
              textDecoration: "none",
            }}>
              ▶ Watch full hearing on SFGovTV
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── COMMISSION PAGE ────────────────────────── */

export function Commission() {
  const [filter, setFilter] = useState("All District 3");
  const [search, setSearch] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <NeighborhoodHero selected={filter} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="Commission Hearings" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em",
          marginBottom: 28,
        }}>
          Planning Commission Record
        </h2>

        <div style={{ display: "flex", gap: 12, marginBottom: 36 }}>
          <input
            type="text" placeholder="Search by address..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: "14px 20px",
              borderRadius: 14, border: `1.5px solid ${COLORS.lightBorder}`,
              fontSize: 15, fontFamily: FONTS.body,
              background: COLORS.white, outline: "none",
              fontWeight: 500, color: COLORS.charcoal,
            }}
          />
          <button style={{
            background: COLORS.orange, color: COLORS.white,
            border: "none", borderRadius: 14,
            padding: "14px 28px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
            boxShadow: "0 2px 8px rgba(212,100,59,0.15)",
          }}>Search</button>
        </div>

        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 16, fontFamily: FONTS.body,
        }}>Recent Hearings</div>

        {MOCK_HEARINGS.map((h, i) => {
          const ac = actionStyle(h.action);
          const isExpanded = expandedIndex === i;

          return (
            <div key={i} style={{
              background: COLORS.white, borderRadius: 16,
              padding: "28px", marginBottom: 14,
              border: `1px solid ${isExpanded ? COLORS.orange : COLORS.lightBorder}`,
              boxShadow: isExpanded
                ? "0 4px 20px rgba(212,100,59,0.08)"
                : "0 2px 8px rgba(0,0,0,0.03)",
              transition: "border 0.3s, box-shadow 0.3s",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 14,
                flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <div style={{
                    fontSize: 20, fontWeight: 800, color: COLORS.charcoal,
                    fontFamily: "'Urbanist', sans-serif",
                  }}>{h.address}</div>
                  <div style={{
                    fontSize: 13, color: COLORS.warmGray, marginTop: 4,
                    fontFamily: FONTS.body, fontWeight: 500,
                  }}>{h.date}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {h.shadow && (
                    <span style={{
                      background: "#FEF5EC", color: "#B47A2E",
                      padding: "5px 12px", borderRadius: 20,
                      fontSize: 11, fontWeight: 700,
                      fontFamily: FONTS.body,
                      border: "1px solid #F0DFC4",
                    }}>☀ Shadow</span>
                  )}
                  {h.detail.publicSentiment && (
                    <span style={{
                      background: COLORS.softBlue, color: "#4A6FA5",
                      padding: "5px 12px", borderRadius: 20,
                      fontSize: 11, fontWeight: 700,
                      fontFamily: FONTS.body,
                      border: "1px solid #C8D8E8",
                    }}>💬 {h.detail.publicSentiment.speakers} Comments</span>
                  )}
                  <span style={{
                    background: ac.bg, color: ac.text,
                    padding: "5px 14px", borderRadius: 20,
                    fontSize: 12, fontWeight: 700,
                    fontFamily: FONTS.body,
                    border: `1px solid ${ac.border}`,
                  }}>{h.action}</span>
                </div>
              </div>
              <p style={{
                fontSize: 14, color: COLORS.midGray,
                lineHeight: 1.65, marginBottom: 16,
                fontFamily: FONTS.body,
              }}>{h.desc}</p>

              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center",
              }}>
                {h.votes.aye > 0 && (
                  <div style={{
                    display: "flex", gap: 16, fontSize: 13,
                    fontFamily: FONTS.body, fontWeight: 700,
                    padding: "10px 14px",
                    background: COLORS.cream,
                    borderRadius: 10,
                  }}>
                    <span style={{ color: "#3D7A3F" }}>✓ {h.votes.aye} Aye</span>
                    <span style={{ color: "#B44040" }}>✕ {h.votes.nay} Nay</span>
                    <span style={{ color: COLORS.warmGray }}>— {h.votes.absent} Absent</span>
                  </div>
                )}
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  style={{
                    background: isExpanded ? COLORS.charcoal : COLORS.cream,
                    color: isExpanded ? COLORS.white : COLORS.charcoal,
                    border: `1px solid ${isExpanded ? COLORS.charcoal : COLORS.lightBorder}`,
                    borderRadius: 10, padding: "8px 18px",
                    fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: FONTS.body,
                    transition: "all 0.2s",
                    marginLeft: "auto",
                  }}
                >
                  {isExpanded ? "Hide Details ▲" : "Full Analysis ▼"}
                </button>
              </div>

              {isExpanded && <HearingDetailCard hearing={h} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
