import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { supabase } from "../services/supabase";
import { geocodeAddresses } from "../services/geocoder";
import type { LatLng } from "../services/geocoder";
import type { CommissionMarker } from "../components/CommissionMap";
import { fetchSFSupervisorBoundary } from "../services/neighborhoodBoundaries";
import type { GeoFeature } from "../services/neighborhoodBoundaries";
import type { DistrictConfig } from "../districts";

const CommissionMapLazy = lazy(() =>
  import("../components/CommissionMap").then(m => ({ default: m.CommissionMap }))
);

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

/* ─── Grouping helpers ───────────────────────── */

/**
 * LiveProject enriched with cross-hearing metadata after dedup + grouping.
 * groupKey  = case_number (or row id when no case number) — used as React key
 *             and expandedId identifier.
 * allHearingDates = all unique hearing dates for this case, sorted ascending.
 */
interface GroupedProject extends LiveProject {
  groupKey: string;
  allHearingDates: string[];
  /** Other cases heard on the same address + same date, merged into this card. */
  mergedWith?: GroupedProject[];
}

/**
 * Two-pass dedup + group:
 *   1. Remove true DB duplicates: same (case_number, hearing_id) pair
 *   2. Group remaining rows by case_number → one card per project
 *      with the most-recent hearing as the representative row.
 */
function groupAndDedup(rows: LiveProject[]): GroupedProject[] {
  // Pass 1 — kill true duplicates (same case + same hearing)
  const seen = new Set<string>();
  const deduped: LiveProject[] = [];
  for (const r of rows) {
    const key = r.case_number
      ? `${r.case_number}||${r.hearing?.id ?? r.id}`
      : r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Pass 2 — group by case_number
  const groups = new Map<string, LiveProject[]>();
  for (const r of deduped) {
    const key = r.case_number ?? r.id;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  // Pass 3 — pick most-recent hearing as primary; collect all hearing dates
  const result: GroupedProject[] = [];
  for (const [groupKey, group] of groups) {
    const sorted = [...group].sort((a, b) =>
      (b.hearing?.hearing_date ?? "").localeCompare(a.hearing?.hearing_date ?? "")
    );
    const primary = sorted[0];
    const allHearingDates = [
      ...new Set(group.map(r => r.hearing?.hearing_date).filter((d): d is string => !!d)),
    ].sort();
    result.push({ ...primary, groupKey, allHearingDates });
  }

  // Pass 4 — merge cards sharing the same (address, hearing_date) into one card.
  // Same address on different dates = distinct hearings, kept separate.
  const addrDateBuckets = new Map<string, GroupedProject[]>();
  for (const p of result) {
    const addr = (p.address ?? "").toLowerCase().trim();
    const date = p.hearing?.hearing_date ?? "";
    const k = addr && date ? `${addr}||${date}` : `solo:${p.groupKey}`;
    const b = addrDateBuckets.get(k);
    if (b) b.push(p);
    else addrDateBuckets.set(k, [p]);
  }

  const finalResult: GroupedProject[] = [];
  for (const bucket of addrDateBuckets.values()) {
    if (bucket.length === 1) {
      finalResult.push(bucket[0]);
    } else {
      const [primary, ...others] = bucket;
      finalResult.push({ ...primary, mergedWith: others });
    }
  }
  return finalResult;
}

/**
 * Return a short card title and optional subtitle.
 * If the address is a long boundary description (>60 chars), the case_number
 * becomes the headline and the address is shown as a truncated subtitle.
 */
function cardTitle(p: GroupedProject): { title: string; subtitle: string | null } {
  const addr = p.address ?? "";
  if (addr.length <= 60) return { title: addr, subtitle: null };
  const title = p.case_number ?? addr.slice(0, 40) + "…";
  const subtitle = addr.length > 80 ? addr.slice(0, 77) + "…" : addr;
  return { title, subtitle };
}

/* ─── Sort & Headline helpers ────────────────── */

type SortMode = 'recent' | 'significant' | 'alpha';

/**
 * Derives a plain-language one-line headline from project_description.
 * Rule-based, no API call. Extracts the "to allow/construct/convert X" clause,
 * or strips legal boilerplate and takes the first meaningful sentence fragment.
 */
function deriveHeadline(desc: string | null, address: string | null): string {
  if (!desc) return address ?? 'Planning hearing';
  let h = desc.trim();
  const verbMatch = h.match(
    /\bto\s+(allow|permit|authorize|establish|construct|install|change|convert|expand|demolish|legalize|operate|replace|maintain|relocate|remove)\b[^.]{0,120}/i
  );
  if (verbMatch) {
    h = verbMatch[0].trim();
    h = h.charAt(0).toUpperCase() + h.slice(1);
  } else {
    h = h
      .replace(/^(CONDITIONAL USE AUTHORIZATION|VARIANCE|BUILDING PERMIT APPLICATION[^,]*,?|CERTIFICATE OF APPROPRIATENESS|PLANNING CODE AMENDMENT|DISCRETIONARY REVIEW|APPEAL OF|CATEGORICAL EXEMPTION)[^a-z]*,?\s*/i, '')
      .replace(/\bpursuant to\b.{0,60}(Planning Code|Section)[^,;]*/gi, '')
      .split(/[.!?;]/)[0]
      .trim();
    if (h.length < 10) h = desc.slice(0, 90);
  }
  if (h.length > 90) h = h.slice(0, 87).replace(/\s+\S*$/, '') + '…';
  return h || (address ?? 'Planning hearing');
}

function sortGrouped(cards: GroupedProject[], mode: SortMode): GroupedProject[] {
  if (mode === 'recent') return cards; // server-sorted by hearing_id DESC
  if (mode === 'alpha') return [...cards].sort((a, b) =>
    (a.address ?? '').localeCompare(b.address ?? ''));
  // 'significant': rank by commissioner votes + public speakers
  return [...cards].sort((a, b) => {
    const score = (p: GroupedProject) =>
      (p.votes?.length ?? 0) + (p.hearing?.public_sentiment?.[0]?.speakers ?? 0);
    return score(b) - score(a);
  });
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

// Reusable select string for both the district load and search queries
const PROJECT_SELECT = `
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
` as const;

export function Commission({ districtConfig }: CommissionProps) {
  const [filter, setFilter]               = useState(districtConfig.allLabel);
  const [search, setSearch]               = useState("");
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showAllTrigger, setShowAllTrigger] = useState(0);
  const [visibleCount, setVisibleCount]   = useState(6);
  const [sortMode, setSortMode]           = useState<SortMode>('recent');
  const [projects, setProjects]           = useState<LiveProject[]>([]);
  const [searchResults, setSearchResults] = useState<LiveProject[] | null>(null);
  const [loading, setLoading]             = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [coords, setCoords]               = useState<Map<string, LatLng>>(new Map());
  const [districtBoundary, setDistrictBoundary] = useState<GeoFeature | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const isCitywide = districtConfig.number === "0";

    let baseQuery = supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .not("address", "is", null)
      .order("hearing_id", { ascending: false });

    if (!isCitywide) {
      // Build a server-side OR filter so we only fetch projects relevant to the
      // selected district. Matches on the `district` column (e.g. "District 3")
      // or any of the district's pipeline neighbourhood names in the address.
      const orTerms = [
        `district.ilike.%${districtConfig.label}%`,
        ...districtConfig.pipelineNeighborhoods.map(n => `address.ilike.%${n}%`),
      ].join(",");
      baseQuery = baseQuery.or(orTerms);
    }

    const { data, error: err } = await baseQuery.limit(isCitywide ? 100 : 300);

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

  // Reset all UI state when district changes
  useEffect(() => {
    setFilter(districtConfig.allLabel);
    setExpandedId(null);
    setVisibleCount(6);
    setSortMode('recent');
  }, [districtConfig.allLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geocode all project addresses once the initial batch loads.
  // Cache-first (sessionStorage) so re-navigation is instant.
  useEffect(() => {
    if (projects.length === 0) return;
    const addrs = [...new Set(
      projects.map(p => p.address).filter((a): a is string => !!a),
    )];
    geocodeAddresses(addrs).then(m =>
      setCoords(prev => new Map([...prev, ...m]))
    );
  }, [projects]);

  // Also geocode any new addresses that appear in search results.
  useEffect(() => {
    if (!searchResults || searchResults.length === 0) return;
    const addrs = [...new Set(
      searchResults.map(p => p.address).filter((a): a is string => !!a),
    )];
    geocodeAddresses(addrs).then(m =>
      setCoords(prev => new Map([...prev, ...m]))
    );
  }, [searchResults]);

  // Fetch supervisor district boundary for the dashed outline on the map.
  useEffect(() => {
    setDistrictBoundary(null);
    fetchSFSupervisorBoundary(districtConfig.number).then(setDistrictBoundary);
  }, [districtConfig.number]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowAll = useCallback(() => {
    setExpandedId(null);
    setShowAllTrigger(t => t + 1);
  }, []);

  // Debounced full-text search — queries address, project_description, case_number
  // without any district filter so cross-district projects (like Stonestown) are found.
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data, error: err } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .not("address", "is", null)
        .or(
          `address.ilike.%${term}%,` +
          `project_description.ilike.%${term}%,` +
          `case_number.ilike.%${term}%`
        )
        .order("hearing_id", { ascending: false })
        .limit(50);
      if (!err) setSearchResults((data ?? []) as unknown as LiveProject[]);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

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

  const isCitywideCommission = districtConfig.number === "0";

  // When search is active, use server search results directly (no district filter —
  // intentional, so cross-district projects like Stonestown are visible).
  // When idle, apply district + neighbourhood client-side filter on loaded projects.
  const visible = searchResults !== null
    ? searchResults
    : projects.filter(p => {
        if (!p.address) return false;

        const addr = (p.address ?? "").toLowerCase();
        const dist = (p.district ?? "").toLowerCase();
        const desc = (p.project_description ?? "").toLowerCase();

        // In single-district mode, filter by district terms.
        if (!isCitywideCommission) {
          const matchesDistrict = districtTerms.some(term =>
            addr.includes(term) || dist.includes(term) || desc.includes(term),
          );
          if (!matchesDistrict) return false;
        }

        // Neighborhood/district pill filter.
        if (selectedNeighborhood) {
          if (isCitywideCommission) {
            // In citywide mode the "neighborhood" is a district — filter by district label.
            const distLabel = selectedNeighborhood.name.toLowerCase(); // "district 3"
            if (!dist.includes(distLabel) && !addr.includes(distLabel) && !desc.includes(distLabel)) return false;
          } else {
            const name = selectedNeighborhood.name.toLowerCase();
            const zip  = selectedNeighborhood.zip;
            const matches =
              addr.includes(zip) || addr.includes(name) ||
              dist.includes(name) || desc.includes(name);
            if (!matches) return false;
          }
        }
        return true;
      });

  // Computed once — used for card list, pagination, and map markers.
  const grouped       = groupAndDedup(visible);
  const isSearching   = search.trim().length > 0;
  const sortedGrouped = sortGrouped(grouped, sortMode);
  const visibleCards  = isSearching ? sortedGrouped : sortedGrouped.slice(0, visibleCount);
  const hasMore       = !isSearching && sortedGrouped.length > visibleCount;

  // One dot per unique geocoded address across ALL sortedGrouped (not just paginated
  // visibleCards) so Show All and fitBounds work on the complete project set.
  const commissionMarkers: CommissionMarker[] = (() => {
    const byAddress = new Map<string, CommissionMarker>();
    for (const p of sortedGrouped) {
      if (!p.address || !coords.has(p.address)) continue;
      const ll = coords.get(p.address)!;
      const existing = byAddress.get(p.address);
      if (existing) {
        existing.keys.push(p.groupKey);
        existing.count++;
      } else {
        byAddress.set(p.address, {
          key:     p.groupKey,
          keys:    [p.groupKey],
          address: p.address,
          lat:     ll.lat,
          lng:     ll.lng,
          count:   1,
        });
      }
    }
    return [...byAddress.values()];
  })();

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
      <NeighborhoodHero districtConfig={districtConfig} selected={filter} />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(32px, 5vw, 52px) 24px" }}>
        <SectionLabel text="Commission Hearings" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
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

        {/* Context map — always show once data has loaded */}
        {!loading && !error && (
          <Suspense fallback={
            <div style={{
              height: 240, borderRadius: 20,
              background: COLORS.cream, marginBottom: 28,
            }} />
          }>
            <CommissionMapLazy
              markers={commissionMarkers}
              showAllTrigger={showAllTrigger}
              districtConfig={districtConfig}
              districtBoundary={districtBoundary}
              onShowAll={handleShowAll}
            />
          </Suspense>
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

        {/* Sort controls */}
        {!loading && !error && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
            {(['recent', 'significant', 'alpha'] as const).map(mode => (
              <button key={mode}
                onClick={() => { setSortMode(mode); setVisibleCount(6); setExpandedId(null); }}
                style={{
                  background: sortMode === mode ? COLORS.charcoal : COLORS.cream,
                  color:      sortMode === mode ? COLORS.white    : COLORS.midGray,
                  border: `1px solid ${sortMode === mode ? COLORS.charcoal : COLORS.lightBorder}`,
                  borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s", whiteSpace: "nowrap",
                }}>
                {mode === 'recent' ? 'Most Recent' : mode === 'significant' ? 'Most Significant' : 'A–Z'}
              </button>
            ))}
            {!isSearching && sortedGrouped.length > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: COLORS.warmGray, fontFamily: FONTS.body, alignSelf: "center", whiteSpace: "nowrap", flexShrink: 0 }}>
                {visibleCards.length} of {sortedGrouped.length}
              </span>
            )}
          </div>
        )}

        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 16, fontFamily: FONTS.body,
        }}>Recent Hearings</div>

        {/* Loading skeleton */}
        {(loading || searchLoading) && [0, 1, 2].map(i => <SkeletonCard key={i} />)}

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

        {/* Project cards — compact collapsed, accordion expand */}
        {!loading && !searchLoading && !error && visibleCards.map((p) => {
          const norm      = normalizeAction(p.action);
          const ac        = actionStyle(norm);
          const sentiment = p.hearing?.public_sentiment?.[0] ?? null;
          const isExpanded = expandedId === p.groupKey;
          const latestDate = p.hearing?.hearing_date ? formatDate(p.hearing.hearing_date) : "";
          const { title, subtitle } = cardTitle(p);
          const allInCard = p.mergedWith && p.mergedWith.length > 0 ? [p, ...p.mergedWith] : null;
          const headline  = deriveHeadline(p.project_description, p.address);

          return (
            <div key={p.groupKey} style={{
              background: COLORS.white, borderRadius: 16,
              padding: "clamp(14px, 2.5vw, 22px)", marginBottom: 12,
              border: `1px solid ${isExpanded ? COLORS.orange : COLORS.lightBorder}`,
              boxShadow: isExpanded
                ? "0 4px 20px rgba(212,100,59,0.08)"
                : "0 2px 8px rgba(0,0,0,0.03)",
              transition: "border 0.2s, box-shadow 0.2s",
            }}>
              {/* ── Collapsed header — entire area is clickable ── */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : p.groupKey)}
                style={{ cursor: "pointer" }}
              >
                {/* Row 1: address title + chevron only */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 16, fontWeight: 800, color: COLORS.charcoal,
                      fontFamily: "'Urbanist', sans-serif", lineHeight: 1.25,
                    }}>{title}</div>
                    {subtitle && (
                      <div style={{
                        fontSize: 11, color: COLORS.warmGray, marginTop: 2,
                        fontFamily: FONTS.body, lineHeight: 1.4,
                      }}>{subtitle}</div>
                    )}
                  </div>
                  <span style={{ color: COLORS.warmGray, fontSize: 12, flexShrink: 0 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Row 2: action badge(s) — wrapped below the title */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {allInCard
                    ? allInCard.map((mp, i) => {
                        const mpAc  = actionStyle(normalizeAction(mp.action));
                        const label = mp.action ?? normalizeAction(mp.action);
                        return (
                          <span key={i} style={{
                            background: mpAc.bg, color: mpAc.text,
                            padding: "4px 11px", borderRadius: 20,
                            fontSize: 11, fontWeight: 700, fontFamily: FONTS.body,
                            border: `1px solid ${mpAc.border}`,
                          }}>
                            {label.length > 30 ? label.slice(0, 27) + "…" : label}
                          </span>
                        );
                      })
                    : (() => {
                        const label = p.action ?? norm;
                        return (
                          <span style={{
                            background: ac.bg, color: ac.text,
                            padding: "4px 11px", borderRadius: 20,
                            fontSize: 11, fontWeight: 700, fontFamily: FONTS.body,
                            border: `1px solid ${ac.border}`,
                          }}>
                            {label.length > 30 ? label.slice(0, 27) + "…" : label}
                          </span>
                        );
                      })()
                  }
                </div>

                {/* Row 3: date + meta badges inline */}
                {(latestDate || p.shadow_flag || (sentiment && sentiment.speakers > 0)) && (
                  <div style={{
                    display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
                    marginTop: 6, fontSize: 12, color: COLORS.warmGray, fontFamily: FONTS.body,
                  }}>
                    {latestDate && <span>{latestDate}</span>}
                    {p.shadow_flag && <span style={{ color: "#B47A2E" }}>☀ Shadow</span>}
                    {sentiment && sentiment.speakers > 0 && (
                      <span>💬 {sentiment.speakers} comments</span>
                    )}
                  </div>
                )}

                {/* Row 3: AI headline */}
                <div style={{
                  fontSize: 13, color: COLORS.midGray, marginTop: 7,
                  lineHeight: 1.5, fontFamily: FONTS.body,
                }}>
                  {headline}
                </div>
              </div>

              {/* ── Expanded content — ProjectDetailCard unchanged ── */}
              {isExpanded && (
                <div style={{
                  borderTop: `1px solid ${COLORS.lightBorder}`,
                  marginTop: 16,
                }}>
                  {allInCard
                    ? allInCard.map((mp, i) => (
                        <div key={mp.groupKey}>
                          {i > 0 && (
                            <div style={{
                              fontSize: 11, fontWeight: 700, color: COLORS.warmGray,
                              fontFamily: FONTS.body, letterSpacing: "0.06em",
                              textTransform: "uppercase", paddingTop: 20,
                              borderTop: `1px solid ${COLORS.lightBorder}`,
                              marginTop: 4, marginBottom: 4,
                            }}>
                              {mp.case_number ?? `Action ${i + 1}`}
                            </div>
                          )}
                          <ProjectDetailCard project={mp} />
                        </div>
                      ))
                    : <ProjectDetailCard project={p} />
                  }
                </div>
              )}
            </div>
          );
        })}

        {/* Show more button */}
        {!loading && !searchLoading && !error && hasMore && (
          <div style={{ textAlign: "center", marginTop: 24, marginBottom: 8 }}>
            <button
              onClick={() => setVisibleCount(v => v + 6)}
              style={{
                background: COLORS.cream, color: COLORS.charcoal,
                border: `1px solid ${COLORS.lightBorder}`, borderRadius: 12,
                padding: "12px 32px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s",
              }}>
              Show {Math.min(6, sortedGrouped.length - visibleCount)} more{' '}
              <span style={{ color: COLORS.warmGray, fontWeight: 400 }}>
                ({sortedGrouped.length - visibleCount} remaining)
              </span>
            </button>
          </div>
        )}

        {!loading && !searchLoading && !error && sortedGrouped.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: COLORS.warmGray, fontFamily: FONTS.body }}>
            No hearings found{search ? ` matching "${search}"` : ""}
            {!search && selectedNeighborhood?.name ? ` in ${selectedNeighborhood.name}` : ""}.
          </div>
        )}
      </div>
    </div>
  );
}
