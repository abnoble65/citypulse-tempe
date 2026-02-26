import { useState, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { supabase } from "../services/supabase";
import type { DistrictConfig } from "../districts";

/** Format an ISO date string as "Feb 25, 2026" */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/* ─── Types ──────────────────────────────────── */

interface Sentiment {
  speakers:        number;
  for_project:     number;
  against_project: number;
  neutral:         number;
  top_themes:      string[];
  notable_quotes:  string[];
  source:          string;
  clip_id:         string | null;
}

interface Vote {
  commissioner_name: string;
  vote: string;
}

interface Comment {
  commissioner_name: string;
  comment_text: string;
}

interface LiveProject {
  id: string;
  address: string | null;
  district: string | null;
  action: string | null;
  project_description: string | null;
  shadow_flag: boolean;
  shadow_details: string | null;
  case_number: string | null;
  hearing: { id: string; hearing_date: string; public_sentiment: Sentiment[] } | null;
  votes: Vote[];
  commissioner_comments: Comment[];
}

/* ─── Helpers ────────────────────────────────── */

function normalizeAction(action: string | null): "Approved" | "Continued" | "Disapproved" {
  if (!action) return "Continued";
  const a = action.toLowerCase();
  if (a.includes("approv") || a.includes("adopt") || a.includes("grant") || a.includes("permit issued")) return "Approved";
  if (a.includes("disapp") || a.includes("denied") || a.includes("deny")) return "Disapproved";
  return "Continued";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function tallyVotes(votes: Vote[]) {
  return {
    aye:    votes.filter(v => v.vote === "aye").length,
    nay:    votes.filter(v => v.vote === "nay").length,
    absent: votes.filter(v => ["absent", "recused", "abstain"].includes(v.vote)).length,
  };
}

function actionStyle(norm: "Approved" | "Continued" | "Disapproved") {
  if (norm === "Approved")    return { bg: "#EDF5ED", text: "#3D7A3F", border: "#C8E0C8" };
  if (norm === "Continued")   return { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" };
  return                             { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" };
}

/* ─── Sentiment Bar ──────────────────────────── */

function SentimentBar({ forCount, against, neutral, total }: {
  forCount: number; against: number; neutral: number; total: number;
}) {
  if (total === 0) return null;
  const forPct     = (forCount / total) * 100;
  const againstPct = (against  / total) * 100;
  const neutralPct = (neutral  / total) * 100;

  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${forPct}%`,     background: "#5B9A5F", transition: "width 0.4s" }} />
        <div style={{ width: `${neutralPct}%`, background: "#B0A89E", transition: "width 0.4s" }} />
        <div style={{ width: `${againstPct}%`, background: "#D4643B", transition: "width 0.4s" }} />
      </div>
      <div style={{ display: "flex", gap: 20, fontSize: 12, fontFamily: FONTS.body, fontWeight: 600 }}>
        <span style={{ color: "#3D7A3F" }}>● {forCount} Support</span>
        <span style={{ color: "#B0A89E" }}>● {neutral} Neutral</span>
        <span style={{ color: "#D4643B" }}>● {against} Oppose</span>
      </div>
    </div>
  );
}

/* ─── Detail Card ────────────────────────────── */

function ProjectDetailCard({ project }: { project: LiveProject }) {
  const sentiment = project.hearing?.public_sentiment?.[0] ?? null;
  const comments = project.commissioner_comments.slice(0, 4);

  return (
    <div style={{
      borderTop: `2px solid ${COLORS.orange}`,
      padding: "32px 0 8px",
      animation: "fadeSlideIn 0.35s ease-out",
    }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Project Description */}
      {project.project_description && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: COLORS.orange,
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 12, fontFamily: FONTS.body,
          }}>Project Description</div>
          <p style={{ fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 1.75, color: COLORS.charcoal }}>
            {project.project_description}
          </p>
        </div>
      )}

      {/* Shadow Impact */}
      {project.shadow_flag && project.shadow_details && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#B47A2E",
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 12, fontFamily: FONTS.body,
          }}>☀ Shadow Impact — Section 295</div>
          <p style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.75, color: COLORS.charcoal }}>
            {project.shadow_details}
          </p>
        </div>
      )}

      {/* Commissioner Discussion */}
      {comments.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: COLORS.orange,
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 12, fontFamily: FONTS.body,
          }}>Commissioner Discussion</div>
          {comments.map((c, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, alignItems: "flex-start",
              padding: "14px 0",
              borderBottom: i < comments.length - 1 ? `1px solid ${COLORS.cream}` : "none",
            }}>
              <div style={{
                background: COLORS.softAmber, borderRadius: 8,
                padding: "6px 12px", flexShrink: 0,
                fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
                color: "#B47A2E", whiteSpace: "nowrap",
              }}>{c.commissioner_name}</div>
              <p style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7, color: COLORS.midGray }}>
                {c.comment_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Vote breakdown */}
      {project.votes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: COLORS.orange,
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 12, fontFamily: FONTS.body,
          }}>Commissioner Votes</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {project.votes.map((v, i) => {
              const voteColor =
                v.vote === "aye"     ? { bg: "#EDF5ED", text: "#3D7A3F", border: "#C8E0C8" } :
                v.vote === "nay"     ? { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" } :
                                       { bg: COLORS.cream, text: COLORS.warmGray, border: COLORS.lightBorder };
              return (
                <div key={i} style={{
                  background: voteColor.bg, border: `1px solid ${voteColor.border}`,
                  borderRadius: 10, padding: "8px 14px",
                  fontFamily: FONTS.body, fontSize: 12,
                }}>
                  <span style={{ fontWeight: 700, color: voteColor.text, textTransform: "capitalize" }}>
                    {v.vote}
                  </span>
                  <span style={{ color: COLORS.midGray, marginLeft: 6 }}>{v.commissioner_name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Case number */}
      {project.case_number && (
        <div style={{ marginBottom: sentiment ? 28 : 8 }}>
          <span style={{
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
          }}>Case No. {project.case_number}</span>
        </div>
      )}

      {/* Public Comment Sentiment */}
      {sentiment && sentiment.speakers > 0 && (
        <div style={{ background: COLORS.cream, borderRadius: 16, padding: "28px 32px" }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.orange,
              letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: FONTS.body,
            }}>Public Comment Sentiment</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Urbanist', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.charcoal }}>
                {sentiment.speakers}
              </span>
              <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, fontWeight: 500 }}>
                speakers
              </span>
              {sentiment.source === "sfgovtv_captions" && (
                <span style={{
                  background: COLORS.softBlue, color: "#4A6FA5",
                  fontSize: 10, fontWeight: 700, padding: "3px 8px",
                  borderRadius: 4, fontFamily: FONTS.body, marginLeft: 4,
                }}>VIA SFGOVTV</span>
              )}
            </div>
          </div>

          <SentimentBar
            forCount={sentiment.for_project}
            against={sentiment.against_project}
            neutral={sentiment.neutral}
            total={sentiment.speakers}
          />

          {sentiment.top_themes?.length > 0 && (
            <div style={{ marginTop: 20, marginBottom: 18 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.midGray,
                letterSpacing: "0.04em", textTransform: "uppercase",
                marginBottom: 10, fontFamily: FONTS.body,
              }}>Top Themes Raised</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sentiment.top_themes.map((theme, i) => (
                  <span key={i} style={{
                    background: COLORS.white, border: `1px solid ${COLORS.lightBorder}`,
                    borderRadius: 20, padding: "6px 14px",
                    fontSize: 13, fontFamily: FONTS.body, color: COLORS.charcoal, fontWeight: 500,
                  }}>{theme}</span>
                ))}
              </div>
            </div>
          )}

          {sentiment.notable_quotes?.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.midGray,
                letterSpacing: "0.04em", textTransform: "uppercase",
                marginBottom: 10, fontFamily: FONTS.body,
              }}>Notable Public Testimony</div>
              {sentiment.notable_quotes.map((q, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${COLORS.orange}`, paddingLeft: 16, marginBottom: 12 }}>
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 14,
                    lineHeight: 1.7, color: COLORS.charcoal, fontStyle: "italic",
                  }}>"{q}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton Card ──────────────────────────── */

function SkeletonCard() {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 16,
      padding: "28px", marginBottom: 14,
      border: `1px solid ${COLORS.lightBorder}`,
    }}>
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .sk { animation: skeleton-pulse 1.6s ease-in-out infinite; background: ${COLORS.lightBorder}; border-radius: 5px; }
      `}</style>
      <div className="sk" style={{ height: 22, width: "52%", marginBottom: 10 }} />
      <div className="sk" style={{ height: 13, width: "28%", marginBottom: 22, background: COLORS.cream }} />
      <div className="sk" style={{ height: 13, width: "92%", marginBottom: 8, background: COLORS.cream }} />
      <div className="sk" style={{ height: 13, width: "76%", marginBottom: 24, background: COLORS.cream }} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div className="sk" style={{ height: 36, width: 130 }} />
      </div>
    </div>
  );
}

/* ─── COMMISSION PAGE ────────────────────────── */

interface CommissionProps {
  districtConfig: DistrictConfig;
}

export function Commission({ districtConfig }: CommissionProps) {
  const [filter, setFilter]               = useState(districtConfig.allLabel);
  const [search, setSearch]               = useState("");
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [projects, setProjects]           = useState<LiveProject[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Build a server-side OR filter so we only fetch projects relevant to the
    // selected district. Matches on the `district` column (e.g. "District 3")
    // or any of the district's pipeline neighbourhood names in the address.
    const orTerms = [
      `district.ilike.%${districtConfig.label}%`,
      ...districtConfig.pipelineNeighborhoods.map(n => `address.ilike.%${n}%`),
    ].join(",");

    const { data, error: err } = await supabase
      .from("projects")
      .select(`
        id, address, district, action, project_description,
        shadow_flag, shadow_details, case_number,
        hearing:hearing_id(
          id, hearing_date,
          public_sentiment(
            speakers, for_project, against_project, neutral,
            top_themes, notable_quotes, source, clip_id
          )
        ),
        votes(commissioner_name, vote),
        commissioner_comments(commissioner_name, comment_text)
      `)
      .not("address", "is", null)
      .or(orTerms)
      .order("hearing_id", { ascending: false })
      .limit(300);

    if (err) {
      console.error("[Commission] Supabase query failed:", err);
      setError(err.message);
      setLoading(false);
      return;
    }
    setProjects((data ?? []) as unknown as LiveProject[]);
    setLoading(false);
  }, [districtConfig]);

  useEffect(() => { load(); }, [load]);

  // Reset neighbourhood filter pill and clear expanded card when district changes
  useEffect(() => {
    setFilter(districtConfig.allLabel);
    setExpandedId(null);
  }, [districtConfig.allLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNeighborhood = districtConfig.neighborhoods.find(n => n.name === filter) ?? null;

  // Most recent hearing date from already-loaded data — no extra query needed.
  const latestHearingDate = projects
    .map(p => p.hearing?.hearing_date)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1) ?? null;

  // Terms used for district-level matching (label + pipeline neighborhood names)
  const districtTerms = [
    districtConfig.label.toLowerCase(),
    ...districtConfig.pipelineNeighborhoods,
  ];

  const visible = projects.filter(p => {
    if (!p.address) return false;
    if (search && !p.address.toLowerCase().includes(search.toLowerCase())) return false;

    // District-level filter: project must mention the district or one of its neighbourhoods
    const addr = (p.address ?? "").toLowerCase();
    const dist = (p.district ?? "").toLowerCase();
    const desc = (p.project_description ?? "").toLowerCase();
    const matchesDistrict = districtTerms.some(term =>
      addr.includes(term) || dist.includes(term) || desc.includes(term),
    );
    if (!matchesDistrict) return false;

    // Neighbourhood sub-filter
    if (selectedNeighborhood) {
      const name = selectedNeighborhood.name.toLowerCase();
      const zip  = selectedNeighborhood.zip;
      const matches =
        addr.includes(zip) ||
        addr.includes(name) ||
        dist.includes(name) ||
        desc.includes(name);
      if (!matches) return false;
    }
    return true;
  });

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
      <NeighborhoodHero districtConfig={districtConfig} selected={filter} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>
        <SectionLabel text="Commission Hearings" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8,
        }}>
          Planning Commission Record
        </h2>
        {latestHearingDate && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
            marginBottom: 28,
          }}>
            Hearings through {fmtDate(latestHearingDate)}
          </p>
        )}

        <div className="cp-search-row" style={{ display: "flex", gap: 12, marginBottom: 36 }}>
          <input
            type="text" placeholder="Search by address..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 14,
              border: `1.5px solid ${COLORS.lightBorder}`, fontSize: 15,
              fontFamily: FONTS.body, background: COLORS.white,
              outline: "none", fontWeight: 500, color: COLORS.charcoal,
            }}
          />
          <button
            onClick={() => {}}
            style={{
              background: COLORS.orange, color: COLORS.white, border: "none",
              borderRadius: 14, padding: "14px 28px", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
              boxShadow: "0 2px 8px rgba(212,100,59,0.15)",
            }}>Search</button>
        </div>

        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 16, fontFamily: FONTS.body,
        }}>Recent Hearings</div>

        {/* Loading skeleton */}
        {loading && [0, 1, 2].map(i => <SkeletonCard key={i} />)}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8",
            borderRadius: 16, padding: "clamp(20px, 4vw, 36px) clamp(16px, 3vw, 32px)", textAlign: "center",
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: "#B44040", marginBottom: 10,
            }}>
              Unable to load hearing data
            </p>
            <p style={{
              fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
              lineHeight: 1.6, marginBottom: 28,
            }}>
              Check your connection and try again.
            </p>
            <button
              onClick={load}
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

        {/* Project cards */}
        {!loading && !error && visible.map((p) => {
          const norm = normalizeAction(p.action);
          const ac   = actionStyle(norm);
          const tally = tallyVotes(p.votes);
          const sentiment = p.hearing?.public_sentiment?.[0] ?? null;
          const isExpanded = expandedId === p.id;
          const dateStr = p.hearing?.hearing_date
            ? formatDate(p.hearing.hearing_date)
            : "";

          return (
            <div key={p.id} style={{
              background: COLORS.white, borderRadius: 16,
              padding: "clamp(16px, 3vw, 28px)", marginBottom: 14,
              border: `1px solid ${isExpanded ? COLORS.orange : COLORS.lightBorder}`,
              boxShadow: isExpanded
                ? "0 4px 20px rgba(212,100,59,0.08)"
                : "0 2px 8px rgba(0,0,0,0.03)",
              transition: "border 0.3s, box-shadow 0.3s",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <div style={{
                    fontSize: 20, fontWeight: 800, color: COLORS.charcoal,
                    fontFamily: "'Urbanist', sans-serif",
                  }}>{p.address}</div>
                  {dateStr && (
                    <div style={{
                      fontSize: 13, color: COLORS.warmGray, marginTop: 4,
                      fontFamily: FONTS.body, fontWeight: 500,
                    }}>{dateStr}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {p.shadow_flag && (
                    <span style={{
                      background: "#FEF5EC", color: "#B47A2E",
                      padding: "5px 12px", borderRadius: 20,
                      fontSize: 11, fontWeight: 700, fontFamily: FONTS.body,
                      border: "1px solid #F0DFC4",
                    }}>☀ Shadow</span>
                  )}
                  {sentiment && sentiment.speakers > 0 && (
                    <span style={{
                      background: COLORS.softBlue, color: "#4A6FA5",
                      padding: "5px 12px", borderRadius: 20,
                      fontSize: 11, fontWeight: 700, fontFamily: FONTS.body,
                      border: "1px solid #C8D8E8",
                    }}>💬 {sentiment.speakers} Comments</span>
                  )}
                  <span style={{
                    background: ac.bg, color: ac.text,
                    padding: "5px 14px", borderRadius: 20,
                    fontSize: 12, fontWeight: 700, fontFamily: FONTS.body,
                    border: `1px solid ${ac.border}`,
                  }}>{p.action ?? norm}</span>
                </div>
              </div>

              {p.project_description && (
                <p style={{
                  fontSize: 14, color: COLORS.midGray,
                  lineHeight: 1.65, marginBottom: 16, fontFamily: FONTS.body,
                }}>
                  {p.project_description.slice(0, 200)}
                  {p.project_description.length > 200 ? "…" : ""}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {tally.aye > 0 && (
                  <div style={{
                    display: "flex", gap: 16, fontSize: 13,
                    fontFamily: FONTS.body, fontWeight: 700,
                    padding: "10px 14px", background: COLORS.cream, borderRadius: 10,
                  }}>
                    <span style={{ color: "#3D7A3F" }}>✓ {tally.aye} Aye</span>
                    <span style={{ color: "#B44040" }}>✕ {tally.nay} Nay</span>
                    {tally.absent > 0 && (
                      <span style={{ color: COLORS.warmGray }}>— {tally.absent} Absent</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  style={{
                    background: isExpanded ? COLORS.charcoal : COLORS.cream,
                    color: isExpanded ? COLORS.white : COLORS.charcoal,
                    border: `1px solid ${isExpanded ? COLORS.charcoal : COLORS.lightBorder}`,
                    borderRadius: 10, padding: "8px 18px",
                    fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: FONTS.body,
                    transition: "all 0.2s", marginLeft: "auto",
                  }}
                >
                  {isExpanded ? "Hide Details ▲" : "Full Analysis ▼"}
                </button>
              </div>

              {isExpanded && <ProjectDetailCard project={p} />}
            </div>
          );
        })}

        {!loading && !error && visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: COLORS.warmGray, fontFamily: FONTS.body }}>
            No hearings found{search ? ` matching "${search}"` : ""}
            {selectedNeighborhood?.zip ? ` in ${selectedNeighborhood.name}` : ""}.
          </div>
        )}
      </div>
    </div>
  );
}
