/**
 * CBDBusinessPulse.tsx — Business registration directory for a CBD.
 *
 * Sections:
 *  1. Summary stat cards (active count + 30/60/90d opening trend)
 *  2. Month-over-month line chart (openings vs closures)
 *  3. Recent openings / closures two-column feed
 *  4. Collapsible business directory (sortable, searchable, paginated)
 *  5. AI insights panel with category filter pills
 */

import { useEffect, useState, useMemo, useCallback } from "react";

import { useCBD } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { fetchBusinessRegistrations, computeOpeningTrend, computeMonthlyActivity, type DowntownBusiness } from "../../services/businessRegistrations";
import { CBDLoadingExperience } from "../../components/CBDLoadingExperience";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import { callAI } from "../../services/aiProxy";
import { useLanguage, getLanguageInstruction } from "../../contexts/LanguageContext";
import {
  LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ── Helpers ─────────────────────────────────────────────────────────────

function cleanAddress(raw: string): string {
  return raw
    .replace(/,?\s*(SAN FRANCISCO|SF)\s*,?\s*(CA\s*)?\d{0,5}\s*$/i, "")
    .replace(/,?\s*CA\s*\d{5}\s*$/i, "")
    .trim();
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── NAICS → simplified category mapping ─────────────────────────────────

type InsightCategory = "All" | "Food & Beverage" | "Retail" | "Professional Services"
  | "Arts & Entertainment" | "Real Estate" | "Health & Wellness" | "Other";

const INSIGHT_CATEGORIES: InsightCategory[] = [
  "All", "Food & Beverage", "Retail", "Professional Services",
  "Arts & Entertainment", "Real Estate", "Health & Wellness", "Other",
];

function mapCategory(naics: string): InsightCategory {
  const lc = naics.toLowerCase();
  if (lc.includes("food") || lc.includes("accommodations") || lc.includes("restaurant") || lc.includes("drinking"))
    return "Food & Beverage";
  if (lc.includes("retail")) return "Retail";
  if (lc.includes("professional") || lc.includes("scientific") || lc.includes("technical") || lc.includes("administrative") || lc.includes("financial") || lc.includes("insurance"))
    return "Professional Services";
  if (lc.includes("arts") || lc.includes("entertainment") || lc.includes("recreation"))
    return "Arts & Entertainment";
  if (lc.includes("real estate") || lc.includes("rental") || lc.includes("leasing") || lc.includes("construction"))
    return "Real Estate";
  if (lc.includes("health") || lc.includes("education"))
    return "Health & Wellness";
  if (lc === "uncategorized" || lc.includes("certain services") || lc.includes("multiple"))
    return "Other";
  return "Other";
}

// ── Sort ────────────────────────────────────────────────────────────────

type SortKey = "name" | "category" | "address" | "openDate";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 25;

// ── Main component ──────────────────────────────────────────────────────

export function CBDBusinessPulse() {
  const { config } = useCBD();
  const { language } = useLanguage();
  const accent = config?.accent_color ?? "#E8652D";

  const [businesses, setBusinesses] = useState<DowntownBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Directory state
  const [dirOpen, setDirOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("openDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Insights state
  const [insightFilter, setInsightFilter] = useState<InsightCategory>("All");
  const [aiCache, setAiCache] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.boundary_geojson) return;
    setLoading(true);
    setFetchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetchBusinessRegistrations(config, { signal: controller.signal })
      .then(rows => {
        clearTimeout(timeout);
        setBusinesses(rows);
        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeout);
        setFetchError(err?.name === "AbortError"
          ? "Unable to load business data — timed out."
          : "Unable to load business data. Try refreshing.");
        setLoading(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [config]);

  // ── Derived data ──────────────────────────────────────────────────────

  const active = useMemo(() => businesses.filter(b => b.status === "active"), [businesses]);
  const trend = useMemo(() => computeOpeningTrend(businesses), [businesses]);
  const monthlyActivity = useMemo(() => computeMonthlyActivity(businesses), [businesses]);

  // Category-filtered businesses for the feeds
  const filterByCategory = useCallback((list: DowntownBusiness[]) => {
    if (insightFilter === "All") return list;
    return list.filter(b => mapCategory(b.category) === insightFilter);
  }, [insightFilter]);

  const recentOpenings = useMemo(
    () => filterByCategory([...active].sort((a, b) => b.openDate.localeCompare(a.openDate))).slice(0, 10),
    [active, filterByCategory],
  );
  const recentClosures = useMemo(
    () => filterByCategory(
      businesses
        .filter(b => b.status === "closed" && b.closeDate)
        .sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? ""))
    ).slice(0, 10),
    [businesses, filterByCategory],
  );

  // Directory table (always shows all categories — independent of insight filter)
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = active;
    if (q) {
      rows = rows.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "address": cmp = a.address.localeCompare(b.address); break;
        case "openDate": cmp = a.openDate.localeCompare(b.openDate); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [active, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }, [sortKey]);

  // Reset AI cache on language change
  useEffect(() => { setAiCache({}); }, [language]);

  // ── AI analysis (category-aware, cached per filter) ───────────────────
  const aiCacheKey = `${insightFilter}:${language}`;
  const aiAnalysis = aiCache[aiCacheKey] ?? "";

  useEffect(() => {
    if (loading || !config || active.length === 0) return;
    if (aiCache[aiCacheKey]) return; // already cached

    setAiLoading(true);

    const subset = insightFilter === "All" ? active : active.filter(b => mapCategory(b.category) === insightFilter);
    const closedSubset = insightFilter === "All"
      ? businesses.filter(b => b.status === "closed")
      : businesses.filter(b => b.status === "closed" && mapCategory(b.category) === insightFilter);

    const catCounts: Record<string, number> = {};
    for (const b of subset) catCounts[b.category] = (catCounts[b.category] ?? 0) + 1;
    const topCats = Object.entries(catCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([c, n]) => `${c}: ${n}`).join(", ");

    const streetCounts: Record<string, number> = {};
    for (const b of subset) {
      const parts = b.address.split(" ");
      const street = parts.slice(1).join(" ") || b.address;
      if (street) streetCounts[street] = (streetCounts[street] ?? 0) + 1;
    }
    const topStreets = Object.entries(streetCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([st, n]) => `${st}: ${n}`).join(", ");

    const categoryScope = insightFilter === "All"
      ? "all business categories"
      : `the **${insightFilter}** category specifically`;

    const prompt = `You are a commercial analyst for the ${config.name} Community Benefit District in San Francisco. Analyze business registration data for ${categoryScope}. Write 2-3 paragraphs highlighting trends, activity clusters, and areas of concern.

DATA:
- Active businesses (${insightFilter}): ${subset.length}
- Recent closures (${insightFilter}): ${closedSubset.length}
- Opened in last 30 days: ${trend.days30}
- Opened in last 90 days: ${trend.days90}
- Top NAICS categories: ${topCats || "N/A"}
- Top streets: ${topStreets || "N/A"}
- Sample recent businesses: ${subset.slice(0, 5).map(b => `${b.name} (${b.category}) at ${b.address}`).join("; ")}

Focus on what the registration patterns mean for district health. ${insightFilter !== "All" ? `Focus specifically on ${insightFilter} businesses — their concentration, growth trajectory, and competitive landscape.` : "Note any clusters of activity or areas with low registration."}${getLanguageInstruction(language)}`;

    callAI({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }).then(res => {
      const text = res.content[0]?.type === "text" ? res.content[0].text : "";
      setAiCache(prev => ({ ...prev, [aiCacheKey]: text }));
    }).catch(() => {
      setAiCache(prev => ({ ...prev, [aiCacheKey]: "*Unable to generate analysis.*" }));
    }).finally(() => setAiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, config, active.length, aiCacheKey]);

  if (!config) return null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700, color: COLORS.charcoal, margin: 0 }}>
          Business Pulse
        </h1>
        <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6 }}>
          Active business registrations within {config.name}
        </p>
      </div>

      <CBDLoadingExperience config={config} loading={loading} itemCount={businesses.length} variant="dashboard" />

      {fetchError && !loading && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12,
          padding: "20px 24px", marginBottom: 24, fontFamily: FONTS.body,
          fontSize: 14, color: "#991B1B", textAlign: "center",
        }}>
          {fetchError}
        </div>
      )}

      {!loading && !fetchError && (
        <div style={{ animation: "cp-page-in 0.3s ease-out" }}>

          {/* ── Stat cards ──────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            {[
              { label: "Active Businesses", value: active.length, color: "#8B5CF6" },
              { label: "Opened (30d)", value: trend.days30, color: "#10B981" },
              { label: "Opened (60d)", value: trend.days60, color: "#3B82F6" },
              { label: "Opened (90d)", value: trend.days90, color: "#F59E0B" },
            ].map(s => (
              <div key={s.label} style={{
                flex: "1 1 140px", minWidth: 120,
                background: COLORS.white, borderRadius: 12,
                border: `1px solid ${COLORS.lightBorder}`, borderLeft: `4px solid ${s.color}`,
                padding: "20px 16px", textAlign: "center",
              }}>
                <div style={{
                  fontFamily: FONTS.display, fontSize: 32, fontWeight: 700,
                  color: s.color, lineHeight: 1.1,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 500,
                  color: COLORS.warmGray, marginTop: 4,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Month-over-month activity chart ──────────────────── */}
          {monthlyActivity.some(m => m.Openings > 0 || m.Closures > 0) && (
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: `1px solid ${COLORS.lightBorder}`,
              padding: "20px 24px", marginBottom: 28,
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: COLORS.charcoal, margin: "0 0 16px",
              }}>
                Monthly Business Activity
              </h2>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyActivity} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fontFamily: FONTS.body, fill: COLORS.warmGray }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontFamily: FONTS.body, fill: COLORS.warmGray }}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={{
                      fontFamily: FONTS.body, fontSize: 12, borderRadius: 8,
                      border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }} />
                    <Legend wrapperStyle={{ fontFamily: FONTS.body, fontSize: 11 }} />
                    <Line type="monotone" dataKey="Openings" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: "#10B981" }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Closures" stroke="#EF4444" strokeWidth={2} dot={{ r: 4, fill: "#EF4444" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Recent openings / closures feed ─────────────────── */}
          <style>{`@media (max-width: 768px) { .cbd-biz-cols { grid-template-columns: 1fr !important; } }`}</style>
          <div className="cbd-biz-cols" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 24, marginBottom: 28,
          }}>
            {/* New Businesses */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: `1px solid ${COLORS.lightBorder}`, borderLeft: "4px solid #10B981",
              padding: "20px 24px", display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: COLORS.charcoal, margin: "0 0 16px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
                New Businesses
                {insightFilter !== "All" && (
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 400, color: COLORS.warmGray }}>
                    ({insightFilter})
                  </span>
                )}
              </h2>
              <div style={{ flex: 1, maxHeight: 380, overflowY: "auto" }}>
                {recentOpenings.length > 0 ? recentOpenings.map(b => (
                  <div key={b.id} style={{ padding: "10px 0", borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                    <div style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: COLORS.charcoal }}>
                      {toTitleCase(b.name)}
                    </div>
                    <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 2 }}>
                      {toTitleCase(cleanAddress(b.address))}
                    </div>
                    <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray, marginTop: 2 }}>
                      Opened {b.openDate}
                    </div>
                  </div>
                )) : (
                  <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                    {insightFilter === "All" ? "No recent openings." : `No recent ${insightFilter} openings.`}
                  </p>
                )}
              </div>
            </div>

            {/* Closures */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: `1px solid ${COLORS.lightBorder}`, borderLeft: "4px solid #EF4444",
              padding: "20px 24px", display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: COLORS.charcoal, margin: "0 0 16px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                Closures
                {insightFilter !== "All" && (
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 400, color: COLORS.warmGray }}>
                    ({insightFilter})
                  </span>
                )}
              </h2>
              <div style={{ flex: 1, maxHeight: 380, overflowY: "auto" }}>
                {recentClosures.length > 0 ? recentClosures.map(b => (
                  <div key={b.id} style={{ padding: "10px 0", borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                    <div style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: COLORS.charcoal }}>
                      {toTitleCase(b.name)}
                    </div>
                    <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 2 }}>
                      {toTitleCase(cleanAddress(b.address))}
                    </div>
                    <div style={{ fontFamily: FONTS.body, fontSize: 11, color: "#EF4444", marginTop: 2 }}>
                      Closed {b.closeDate}
                    </div>
                  </div>
                )) : (
                  <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                    {insightFilter === "All" ? "No recent closures in this area." : `No recent ${insightFilter} closures.`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Collapsible Business Directory ───────────────────── */}
          <div style={{
            background: COLORS.white, borderRadius: 12,
            border: `1px solid ${COLORS.lightBorder}`,
            marginBottom: 28, overflow: "hidden",
          }}>
            <button
              onClick={() => setDirOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "16px 24px",
                background: "none", border: "none", cursor: "pointer",
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: COLORS.charcoal, textAlign: "left",
              }}
            >
              <span>
                {dirOpen ? "Business Directory" : `Show Directory (${filtered.length.toLocaleString()} results)`}
              </span>
              <span style={{
                fontSize: 12, color: COLORS.warmGray, transition: "transform 0.2s",
                transform: dirOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}>
                {"\u25BC"}
              </span>
            </button>

            {dirOpen && (
              <div style={{ padding: "0 24px 20px" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 12, marginBottom: 16,
                }}>
                  <span style={{
                    fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
                  }}>
                    {filtered.length} {filtered.length === 1 ? "result" : "results"}
                  </span>
                  <input
                    type="text"
                    placeholder="Search name, category, address..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    style={{
                      fontFamily: FONTS.body, fontSize: 13, padding: "6px 14px",
                      borderRadius: 8, border: `1px solid ${COLORS.lightBorder}`,
                      outline: "none", width: 260,
                    }}
                  />
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%", borderCollapse: "collapse",
                    fontFamily: FONTS.body, fontSize: 13,
                  }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLORS.lightBorder}` }}>
                        {([
                          ["name", "Name"],
                          ["category", "Category"],
                          ["address", "Address"],
                          ["openDate", "Open Date"],
                        ] as [SortKey, string][]).map(([key, label]) => (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            style={{
                              textAlign: "left", padding: "8px 10px", cursor: "pointer",
                              userSelect: "none", fontSize: 10, fontWeight: 700,
                              color: COLORS.warmGray, textTransform: "uppercase",
                              letterSpacing: "0.06em", whiteSpace: "nowrap",
                            }}
                          >
                            {label} {sortKey === key ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length > 0 ? pageRows.map(b => (
                        <tr key={b.id} style={{ borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                          <td style={{ padding: "10px 10px", fontWeight: 600, color: COLORS.charcoal }}>
                            {toTitleCase(b.name)}
                          </td>
                          <td style={{ padding: "10px 10px", color: COLORS.midGray }}>
                            {b.category}
                          </td>
                          <td style={{ padding: "10px 10px", color: COLORS.midGray }}>
                            {toTitleCase(cleanAddress(b.address))}
                          </td>
                          <td style={{ padding: "10px 10px", color: COLORS.warmGray, whiteSpace: "nowrap" }}>
                            {b.openDate}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} style={{ padding: 24, textAlign: "center", color: COLORS.warmGray }}>
                            {search ? "No businesses match your search." : "No businesses found in this district."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {pageCount > 1 && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, marginTop: 16, fontFamily: FONTS.body, fontSize: 12,
                  }}>
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      style={{
                        padding: "4px 12px", borderRadius: 6, cursor: page === 0 ? "default" : "pointer",
                        border: `1px solid ${COLORS.lightBorder}`, background: COLORS.white,
                        color: page === 0 ? COLORS.warmGray : COLORS.charcoal,
                        fontFamily: FONTS.body, fontSize: 12,
                      }}
                    >
                      Prev
                    </button>
                    <span style={{ color: COLORS.midGray }}>
                      {page + 1} / {pageCount}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                      disabled={page >= pageCount - 1}
                      style={{
                        padding: "4px 12px", borderRadius: 6, cursor: page >= pageCount - 1 ? "default" : "pointer",
                        border: `1px solid ${COLORS.lightBorder}`, background: COLORS.white,
                        color: page >= pageCount - 1 ? COLORS.warmGray : COLORS.charcoal,
                        fontFamily: FONTS.body, fontSize: 12,
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── AI Insights with category filter pills ───────────── */}
          <div style={{
            background: COLORS.white, borderRadius: 12,
            border: `1px solid ${COLORS.lightBorder}`, borderTop: `3px solid ${accent}`,
            padding: "20px 24px", marginBottom: 40,
          }}>
            <h2 style={{
              fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
              color: COLORS.charcoal, margin: "0 0 16px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              AI Insights
            </h2>

            {/* Category filter pills */}
            <div style={{
              display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16,
            }}>
              {INSIGHT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setInsightFilter(cat)}
                  style={{
                    padding: "5px 14px", borderRadius: 20,
                    border: `1px solid ${insightFilter === cat ? accent : COLORS.lightBorder}`,
                    background: insightFilter === cat ? accent : COLORS.white,
                    color: insightFilter === cat ? "#fff" : COLORS.midGray,
                    fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {aiLoading ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="sk" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  Analyzing {insightFilter === "All" ? "business" : insightFilter.toLowerCase()} patterns...
                </div>
                <div className="sk" style={{ height: 14, width: "100%", marginTop: 12, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "85%", marginTop: 8, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "70%", marginTop: 8, borderRadius: 4 }} />
              </div>
            ) : aiAnalysis ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 1.7 }}>
                {renderMarkdownBlock(aiAnalysis)}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
