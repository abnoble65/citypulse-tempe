import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { supabase } from "../services/supabase";
import { NeighborhoodHero } from "../components/NeighborhoodHero";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vote { commissioner_name: string; vote: string }
interface Comment { commissioner_name: string; comment_text: string }

interface ProjectResult {
  id: string;
  address: string;
  case_number: string | null;
  project_description: string | null;
  action: string | null;
  motion_number: string | null;
  shadow_flag: boolean | null;
  shadow_details: string | null;
  hearings: { hearing_date: string; pdf_url: string };
  votes: Vote[];
  commissioner_comments: Comment[];
}

interface HearingProject {
  id: string; action: string; address: string;
  project_description: string; motion_number: string | null;
}

interface Hearing {
  id: string; hearing_date: string; pdf_url: string;
  projects: HearingProject[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });
}

function actionStyle(action: string) {
  const a = (action || "").toLowerCase();
  if (a.includes("approved"))   return { bg: "#EDF5ED", text: "#3D7A3F", border: "#C8E0C8" };
  if (a.includes("continued"))  return { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" };
  if (a.includes("denied") || a.includes("disapproved"))
                                 return { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" };
  return { bg: COLORS.cream, text: COLORS.midGray, border: COLORS.lightBorder };
}

function voteColor(vote: string) {
  const v = (vote || "").toLowerCase();
  if (v === "aye")     return { bg: "#EDF5ED", text: "#3D7A3F" };
  if (v === "nay")     return { bg: "#FDEEEE", text: "#B44040" };
  if (v === "recused") return { bg: "#FEF5EC", text: "#B47A2E" };
  return { bg: COLORS.cream, text: COLORS.midGray };
}

const SIGNIFICANCE_KEYWORDS = [
  "new construction", "demolition", "mixed-use", "mixed use",
  "affordable housing", "high-rise", "highrise", "tower", "residential",
];

function significantProjects(projects: HearingProject[]) {
  return projects
    .map(p => {
      const desc = (p.project_description || "").toLowerCase();
      const score = SIGNIFICANCE_KEYWORDS.filter(kw => desc.includes(kw)).length
        + (/\$[\d,.]/.test(p.project_description || "") ? 1 : 0);
      return { project: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.project);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function HistoryCard({ address, appearances }: { address: string; appearances: ProjectResult[] }) {
  const sorted = [...appearances].sort(
    (a, b) => b.hearings.hearing_date.localeCompare(a.hearings.hearing_date)
  );

  return (
    <div style={{
      background: COLORS.white, borderRadius: 16, marginBottom: 16,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.03)", overflow: "hidden",
    }}>
      {/* Address header */}
      <div style={{
        padding: "16px 28px", borderBottom: `1px solid ${COLORS.lightBorder}`,
        background: COLORS.orangePale,
      }}>
        <div style={{ fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700, color: COLORS.charcoal }}>{address}</div>
        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 3 }}>
          {appearances.length} hearing{appearances.length !== 1 ? "s" : ""} on record
        </div>
      </div>

      {sorted.map((p, idx) => {
        const ac = actionStyle(p.action ?? "");
        return (
          <div key={p.id} style={{
            padding: "20px 28px",
            borderBottom: idx < sorted.length - 1 ? `1px solid ${COLORS.cream}` : "none",
          }}>
            {/* Date + meta row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: COLORS.charcoal }}>
                  {formatDate(p.hearings.hearing_date)}
                </div>
                <div style={{ fontSize: 12, color: COLORS.warmGray, fontFamily: FONTS.body, marginTop: 2 }}>
                  {p.case_number && `Case ${p.case_number}`}
                  {p.case_number && p.motion_number && " · "}
                  {p.motion_number && `Motion ${p.motion_number}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {p.shadow_flag && (
                  <span style={{
                    background: "#FEF5EC", color: "#B47A2E",
                    padding: "4px 10px", borderRadius: 20,
                    fontSize: 11, fontWeight: 700, fontFamily: FONTS.body,
                    border: "1px solid #F0DFC4",
                  }}>☀ Shadow</span>
                )}
                {p.action && (
                  <span style={{
                    background: ac.bg, color: ac.text,
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: 12, fontWeight: 700, fontFamily: FONTS.body,
                    border: `1px solid ${ac.border}`,
                  }}>{p.action}</span>
                )}
                {p.hearings.pdf_url && (
                  <a href={p.hearings.pdf_url} target="_blank" rel="noopener noreferrer" style={{
                    background: COLORS.orangePale, color: COLORS.orange,
                    padding: "4px 10px", borderRadius: 8,
                    fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: FONTS.body,
                    border: `1px solid rgba(212,100,59,0.25)`,
                  }}>PDF</a>
                )}
              </div>
            </div>

            {p.project_description && (
              <p style={{ fontSize: 13, color: COLORS.midGray, lineHeight: 1.6, marginBottom: 12, fontFamily: FONTS.body }}>{p.project_description}</p>
            )}

            {p.shadow_flag && p.shadow_details && (
              <div style={{
                background: "#FEF5EC", borderRadius: 10, padding: "10px 14px",
                marginBottom: 12, border: "1px solid #F0DFC4",
              }}>
                <p style={{ color: "#B47A2E", fontSize: 12, margin: 0, lineHeight: 1.5, fontFamily: FONTS.body }}>{p.shadow_details}</p>
              </div>
            )}

            {p.votes.length > 0 && (
              <div style={{ marginBottom: p.commissioner_comments.length > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.warmGray, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontFamily: FONTS.body }}>Votes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.votes.map((v, i) => {
                    const vc = voteColor(v.vote);
                    return (
                      <span key={i} style={{
                        background: vc.bg, color: vc.text,
                        padding: "3px 10px", borderRadius: 20,
                        fontSize: 12, fontWeight: 700, fontFamily: FONTS.body,
                        whiteSpace: "nowrap",
                      }}>{v.commissioner_name}: {v.vote}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {p.commissioner_comments.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.warmGray, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: FONTS.body }}>Comments</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.commissioner_comments.map((c, i) => (
                    <div key={i} style={{
                      borderLeft: `3px solid rgba(212,100,59,0.35)`,
                      borderRadius: "0 8px 8px 0", padding: "8px 12px",
                      background: COLORS.cream,
                    }}>
                      <div style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 700, color: COLORS.orange, marginBottom: 3 }}>{c.commissioner_name}</div>
                      <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.midGray, lineHeight: 1.5 }}>{c.comment_text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Commission() {
  const [filter, setFilter] = useState("All District 3");
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loadingHearings, setLoadingHearings] = useState(true);
  const [search, setSearch] = useState("");
  const [addressGroups, setAddressGroups] = useState<Map<string, ProjectResult[]>>(new Map());
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedZip = NEIGHBORHOODS.find(n => n.name === filter)?.zip ?? null;

  useEffect(() => {
    supabase
      .from("hearings")
      .select("id, hearing_date, pdf_url, projects(id, action, address, project_description, motion_number)")
      .order("hearing_date", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error && data) setHearings(data as Hearing[]);
        setLoadingHearings(false);
      });
  }, []);

  // Clear search results when filter changes
  function handleFilterChange(name: string) {
    setFilter(name);
    setHasSearched(false);
    setAddressGroups(new Map());
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setLoadingSearch(true);
    setHasSearched(true);

    let query = supabase
      .from("projects")
      .select(`
        id, address, case_number, project_description, action, motion_number,
        shadow_flag, shadow_details,
        hearings!inner(hearing_date, pdf_url),
        votes(commissioner_name, vote),
        commissioner_comments(commissioner_name, comment_text)
      `)
      .ilike("address", `%${q}%`);

    if (selectedZip) {
      query = query.ilike("address", `%${selectedZip}%`);
    }

    const { data, error } = await query
      .order("hearing_date", { referencedTable: "hearings", ascending: false });

    if (!error && data) {
      const groups = new Map<string, ProjectResult[]>();
      for (const row of data as ProjectResult[]) {
        const key = (row.address || "").trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      setAddressGroups(groups);
    }
    setLoadingSearch(false);
  }

  const activeNeighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip);

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={handleFilterChange} />
      <NeighborhoodHero selected={filter} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="Commission Hearings" />
        <h2 style={{
          fontFamily: FONTS.heading,
          fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 28,
        }}>
          Planning Commission Record
        </h2>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginBottom: 36 }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={activeNeighborhood ? `Search addresses in ${activeNeighborhood.name}…` : "Search by address…"}
            style={{
              flex: 1, padding: "14px 20px",
              borderRadius: 14, border: `1.5px solid ${COLORS.lightBorder}`,
              fontSize: 15, fontFamily: FONTS.body, background: COLORS.white,
              outline: "none", fontWeight: 500, color: COLORS.charcoal,
            }}
          />
          <button type="submit" disabled={loadingSearch} style={{
            background: loadingSearch ? COLORS.orangeSoft : COLORS.orange,
            color: COLORS.white, border: "none", borderRadius: 14,
            padding: "14px 28px", fontSize: 15, fontWeight: 700,
            cursor: loadingSearch ? "not-allowed" : "pointer",
            fontFamily: FONTS.heading, boxShadow: "0 2px 8px rgba(212,100,59,0.15)",
          }}>
            {loadingSearch ? "Searching…" : "Search"}
          </button>
        </form>

        {/* Search results */}
        {hasSearched && (
          <div style={{ marginBottom: 48 }}>
            {loadingSearch ? (
              <p style={{ color: COLORS.warmGray, fontFamily: FONTS.body, fontSize: 14 }}>Searching…</p>
            ) : addressGroups.size > 0 ? (
              Array.from(addressGroups.entries()).map(([address, appearances]) => (
                <HistoryCard key={address} address={address} appearances={appearances} />
              ))
            ) : (
              <p style={{ color: COLORS.warmGray, fontFamily: FONTS.body, fontSize: 14 }}>
                No results found for "{search}"
                {activeNeighborhood && ` in ${activeNeighborhood.name}`}.
              </p>
            )}
          </div>
        )}

        {/* Recent hearings */}
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.orange, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16, fontFamily: FONTS.body }}>
          Recent Hearings
        </div>

        {loadingHearings ? (
          <p style={{ color: COLORS.warmGray, fontFamily: FONTS.body, fontSize: 14 }}>Loading hearings…</p>
        ) : hearings.length === 0 ? (
          <div style={{ background: COLORS.white, borderRadius: 16, padding: "48px 32px", textAlign: "center", border: `1px solid ${COLORS.lightBorder}` }}>
            <p style={{ color: COLORS.warmGray, fontFamily: FONTS.body, fontSize: 14 }}>No hearings found. Run the ingestion script to populate data.</p>
          </div>
        ) : (
          hearings.map(h => {
            const sig = significantProjects(h.projects);
            return (
              <div key={h.id} style={{
                background: COLORS.white, borderRadius: 16, padding: "24px 28px", marginBottom: 14,
                border: `1px solid ${COLORS.lightBorder}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: sig.length ? 16 : 0 }}>
                  <div>
                    <div style={{ fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700, color: COLORS.charcoal }}>
                      {formatDate(h.hearing_date)}
                    </div>
                    <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginTop: 4 }}>
                      {h.projects.length} project{h.projects.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {h.pdf_url && (
                    <a href={h.pdf_url} target="_blank" rel="noopener noreferrer" style={{
                      background: COLORS.orangePale, color: COLORS.orange,
                      padding: "6px 14px", borderRadius: 8, fontSize: 13,
                      fontWeight: 600, textDecoration: "none", fontFamily: FONTS.body,
                      border: "1px solid rgba(212,100,59,0.25)",
                    }}>PDF</a>
                  )}
                </div>

                {sig.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sig.map(p => {
                      const ac = actionStyle(p.action ?? "");
                      return (
                        <div key={p.id} style={{
                          background: COLORS.cream, borderLeft: `3px solid rgba(212,100,59,0.4)`,
                          borderRadius: "0 10px 10px 0", padding: "10px 14px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: COLORS.charcoal }}>{p.address}</span>
                            {p.action && (
                              <span style={{ background: ac.bg, color: ac.text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FONTS.body, border: `1px solid ${ac.border}` }}>{p.action}</span>
                            )}
                          </div>
                          {p.project_description && (
                            <p style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray, margin: "4px 0 0", lineHeight: 1.4 }}>
                              {p.project_description.length > 100 ? p.project_description.slice(0, 100) + "…" : p.project_description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
