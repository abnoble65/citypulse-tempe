/**
 * CBD311Detail.tsx — Deep-dive into 311 service requests within a CBD.
 *
 * Sections:
 *  1. Category cards (filterable)
 *  2. Full 311 table (sortable, searchable, paginated)
 *  3. Response time analysis (scatter-style + AI insight)
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, ResponsiveContainer,
} from "recharts";

import { useCBD } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { fetch311ForCBD, type CBD311Row } from "../../utils/cbdFetch";
import { CBDLoadingExperience } from "../../components/CBDLoadingExperience";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import { callAI } from "../../services/aiProxy";
import { useLanguage, getLanguageInstruction } from "../../contexts/LanguageContext";

// ── Categories ──────────────────────────────────────────────────────────

const CATEGORIES = ["Graffiti", "Street Cleaning", "Encampments", "Blocked Sidewalk"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_COLORS: Record<Category, string> = {
  Graffiti:           "#7C3AED",
  "Street Cleaning":  "#92400E",
  Encampments:        "#DC2626",
  "Blocked Sidewalk": "#EA580C",
};

const CAT_ICONS: Record<Category, string> = {
  Graffiti:           "G",
  "Street Cleaning":  "C",
  Encampments:        "E",
  "Blocked Sidewalk": "\u26A0",
};

function normalizeCategory(serviceName: string): Category | "Other" {
  const s = (serviceName ?? "").toLowerCase();
  if (s.includes("graffiti")) return "Graffiti";
  if ((s.includes("street") || s.includes("sidewalk")) && s.includes("clean")) return "Street Cleaning";
  if (s.includes("encampment")) return "Encampments";
  if (s.includes("sidewalk") || s.includes("block")) return "Blocked Sidewalk";
  return "Other";
}

interface Row311 extends CBD311Row {
  normalizedCategory: Category | "Other";
  resDays: number | null;
}

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

type SortKey = "date" | "address" | "category" | "status" | "resDays";
type SortDir = "asc" | "desc";

// ── Main component ──────────────────────────────────────────────────────

export function CBD311Detail() {
  const { config } = useCBD();
  const { language } = useLanguage();
  const accent = config?.accent_color ?? "#E8652D";

  const [rawRows, setRawRows] = useState<Row311[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const PAGE_SIZE = 25;

  // ── Fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.boundary_geojson) return;
    setLoading(true);
    setFetchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetch311ForCBD(config, { days: 180, limit: 3000, signal: controller.signal })
      .then(raw => {
        clearTimeout(timeout);
        const rows: Row311[] = raw.map(r => {
          const nc = normalizeCategory(r.category);
          let resDays: number | null = null;
          if (r.closedDate) {
            const d = (new Date(r.closedDate).getTime() - new Date(r.date).getTime()) / 86_400_000;
            if (d > 0) resDays = d;
          }
          return { ...r, normalizedCategory: nc, resDays };
        });
        setRawRows(rows);
        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeout);
        setFetchError(err?.name === "AbortError"
          ? "Unable to load 311 data \u2014 timed out."
          : "Unable to load 311 data. Try refreshing.");
        setLoading(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [config]);

  // Regenerate AI on language change
  useEffect(() => { setAiInsight(""); }, [language]);

  // ── AI insight ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !config || rawRows.length === 0 || aiInsight) return;

    setAiLoading(true);

    // Find outlier addresses by category
    const catAddrMap: Record<string, Record<string, number[]>> = {};
    for (const r of rawRows) {
      if (r.resDays === null || r.normalizedCategory === "Other") continue;
      const cat = r.normalizedCategory;
      if (!catAddrMap[cat]) catAddrMap[cat] = {};
      const addr = r.address.toUpperCase().trim();
      if (!addr) continue;
      if (!catAddrMap[cat][addr]) catAddrMap[cat][addr] = [];
      catAddrMap[cat][addr].push(r.resDays);
    }

    const outliers: string[] = [];
    for (const [cat, addrs] of Object.entries(catAddrMap)) {
      const allDays = Object.values(addrs).flat();
      const catAvg = allDays.length > 0 ? allDays.reduce((s, d) => s + d, 0) / allDays.length : 0;
      for (const [addr, days] of Object.entries(addrs)) {
        if (days.length < 2) continue;
        const avg = days.reduce((s, d) => s + d, 0) / days.length;
        if (avg > catAvg * 2 && avg > 7) {
          outliers.push(`${addr}: ${cat} avg ${avg.toFixed(1)} days (district avg ${catAvg.toFixed(1)}d)`);
        }
      }
    }

    const prompt = `You are a 311 data analyst for the ${config.name} CBD in San Francisco. Provide a concise 2-paragraph response time analysis. Focus on categories with slow resolution and specific addresses that are outliers. Be data-driven with specific numbers.

DATA:
- Total requests: ${rawRows.length} (last 6 months)
- Category breakdown: ${CATEGORIES.map(c => `${c}: ${rawRows.filter(r => r.normalizedCategory === c).length}`).join(", ")}
- Overall avg resolution: ${(() => { const d = rawRows.filter(r => r.resDays !== null).map(r => r.resDays!); return d.length > 0 ? (d.reduce((s, x) => s + x, 0) / d.length).toFixed(1) : "N/A"; })()}d
- Resolution outliers:
${outliers.slice(0, 8).join("\n") || "None detected"}

Identify patterns and recommend which categories/locations need attention.${getLanguageInstruction(language)}`;

    callAI({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }).then(res => {
      setAiInsight(res.content[0]?.type === "text" ? res.content[0].text : "");
    }).catch(() => {
      setAiInsight("*Unable to generate insight.*");
    }).finally(() => setAiLoading(false));
  }, [loading, config, rawRows, aiInsight, language]);

  // ── Derived data ──────────────────────────────────────────────────────

  const catStats = useMemo(() => {
    return CATEGORIES.map(cat => {
      const rows = rawRows.filter(r => r.normalizedCategory === cat);
      const resDays = rows.filter(r => r.resDays !== null).map(r => r.resDays!);
      const avgRes = resDays.length > 0 ? resDays.reduce((s, d) => s + d, 0) / resDays.length : null;

      // Weekly sparkline data (last 12 weeks)
      const now = Date.now();
      const weeks: number[] = Array(12).fill(0);
      for (const r of rows) {
        const age = (now - new Date(r.date).getTime()) / (7 * 86_400_000);
        const idx = Math.min(11, Math.floor(age));
        if (idx >= 0 && idx < 12) weeks[11 - idx]++;
      }

      return { cat, count: rows.length, avgRes, weeks };
    });
  }, [rawRows]);

  const filtered = useMemo(() => {
    let rows = selectedCat
      ? rawRows.filter(r => r.normalizedCategory === selectedCat)
      : rawRows;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.address.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.status ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "address": cmp = a.address.localeCompare(b.address); break;
        case "category": cmp = (a.normalizedCategory).localeCompare(b.normalizedCategory); break;
        case "status": cmp = (a.status ?? "").localeCompare(b.status ?? ""); break;
        case "resDays": cmp = (a.resDays ?? 999) - (b.resDays ?? 999); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return rows;
  }, [rawRows, selectedCat, search, sortKey, sortDir]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
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

  // Response time by category for analysis section
  const resTimeByCategory = useMemo(() => {
    return CATEGORIES.map(cat => {
      const rows = rawRows.filter(r => r.normalizedCategory === cat && r.resDays !== null);
      const days = rows.map(r => r.resDays!).sort((a, b) => a - b);
      if (days.length === 0) return { cat, median: 0, p25: 0, p75: 0, outliers: 0, count: 0 };
      const median = days[Math.floor(days.length / 2)];
      const p25 = days[Math.floor(days.length * 0.25)];
      const p75 = days[Math.floor(days.length * 0.75)];
      const outliers = days.filter(d => d > 14).length;
      return { cat, median, p25, p75, outliers, count: days.length };
    }).filter(d => d.count > 0);
  }, [rawRows]);

  if (!config) return null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700, color: COLORS.charcoal, margin: 0 }}>
          311 Requests
        </h1>
        <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6 }}>
          Detailed 311 service request data within {config.name} — last 6 months
        </p>
      </div>

      <CBDLoadingExperience config={config} loading={loading} itemCount={rawRows.length} variant="clean-safe" />

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

          {/* Section 1: Category Cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16, marginBottom: 40,
          }}>
            <style>{`
              @media (max-width: 768px) {
                .cbd-311-cats { grid-template-columns: repeat(2, 1fr) !important; }
              }
            `}</style>
            {catStats.map(({ cat, count, avgRes, weeks }) => {
              const isActive = selectedCat === cat;
              const color = CAT_COLORS[cat];
              return (
                <div key={cat}
                  onClick={() => { setSelectedCat(isActive ? null : cat); setPage(0); }}
                  style={{
                    background: COLORS.white, borderRadius: 12,
                    border: `1px solid ${isActive ? color : "#e5e7eb"}`,
                    padding: 16, cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: isActive ? `0 0 0 2px ${color}30` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: color + "18", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color,
                    }}>
                      {CAT_ICONS[cat]}
                    </div>
                    <span style={{
                      fontFamily: FONTS.body, fontSize: 12, fontWeight: 600, color: "#1a1a2e",
                    }}>
                      {cat}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: FONTS.display, fontSize: 28, fontWeight: 700,
                    color: "#1a1a2e", lineHeight: 1,
                  }}>
                    {count}
                  </div>
                  <div style={{
                    fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 4,
                  }}>
                    {avgRes !== null ? `Avg ${avgRes.toFixed(1)}d resolution` : "No resolution data"}
                  </div>
                  {/* Mini sparkline */}
                  <div style={{ height: 24, marginTop: 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeks.map((v, i) => ({ w: i, v }))}>
                        <Area type="monotone" dataKey="v" stroke={color} fill={color}
                          fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section 2: Full Table */}
          <div style={{
            background: COLORS.white, borderRadius: 12,
            border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 40,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12, marginBottom: 16,
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: "#1a1a2e", margin: 0,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                All Requests
                <span style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 400, color: COLORS.warmGray, marginLeft: 4 }}>
                  ({filtered.length})
                </span>
              </h2>
              <input
                type="text"
                placeholder="Search address, category, status..."
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
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONTS.body, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.lightBorder}` }}>
                    {([
                      ["date", "Date"],
                      ["address", "Address"],
                      ["category", "Category"],
                      ["status", "Status"],
                      ["resDays", "Resolution"],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key}
                        onClick={() => handleSort(key)}
                        style={{
                          textAlign: key === "resDays" ? "right" : "left",
                          padding: "8px 12px", cursor: "pointer", userSelect: "none",
                          fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label} {sortKey === key ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const catColor = r.normalizedCategory !== "Other"
                      ? CAT_COLORS[r.normalizedCategory as Category]
                      : "#6B7280";
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                        <td style={{ padding: "8px 12px", color: COLORS.midGray, whiteSpace: "nowrap", fontSize: 12 }}>
                          {r.date}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 500, color: "#1a1a2e" }}>
                          {toTitleCase(cleanAddress(r.address))}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 8px", borderRadius: 10, fontSize: 11,
                            background: catColor + "15", color: catColor, fontWeight: 600,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: catColor }} />
                            {r.normalizedCategory}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: (r.status ?? "").toLowerCase().includes("closed") ? "#10B981" : "#F59E0B",
                          }}>
                            {r.status ?? "\u2014"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {r.resDays !== null ? (
                            <span style={{
                              fontWeight: 700, fontSize: 13,
                              fontFamily: FONTS.display,
                              color: r.resDays < 3 ? "#10B981" : r.resDays <= 7 ? "#F59E0B" : "#EF4444",
                            }}>
                              {r.resDays.toFixed(1)}d
                            </span>
                          ) : (
                            <span style={{ color: COLORS.warmGray }}>{"\u2014"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginTop: 16, fontFamily: FONTS.body, fontSize: 12,
              }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{
                    padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.lightBorder}`,
                    background: page === 0 ? COLORS.cream : COLORS.white, cursor: page === 0 ? "default" : "pointer",
                    fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray,
                  }}>
                  Prev
                </button>
                <span style={{ color: COLORS.midGray }}>
                  {page + 1} / {pageCount}
                </span>
                <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
                  style={{
                    padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.lightBorder}`,
                    background: page >= pageCount - 1 ? COLORS.cream : COLORS.white,
                    cursor: page >= pageCount - 1 ? "default" : "pointer",
                    fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray,
                  }}>
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Response Time Analysis */}
          <div style={{
            background: COLORS.white, borderRadius: 12,
            border: "1px solid #e5e7eb", borderTop: `3px solid ${accent}`,
            padding: "20px 24px", marginBottom: 40,
          }}>
            <h2 style={{
              fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
              color: "#1a1a2e", margin: "0 0 16px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              Response Time Analysis
            </h2>

            {/* Box plot style visualization */}
            {resTimeByCategory.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {resTimeByCategory.map(d => {
                  const color = CAT_COLORS[d.cat as Category];
                  const maxDay = Math.max(...resTimeByCategory.map(x => x.p75), 14);
                  return (
                    <div key={d.cat} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 0", borderBottom: `1px solid ${COLORS.lightBorder}`,
                    }}>
                      <span style={{
                        fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray,
                        width: 110, flexShrink: 0, textAlign: "right",
                      }}>
                        {d.cat}
                      </span>
                      <div style={{ flex: 1, position: "relative", height: 24 }}>
                        {/* Track */}
                        <div style={{
                          position: "absolute", top: 10, left: 0, right: 0,
                          height: 4, background: "#f3f4f6", borderRadius: 2,
                        }} />
                        {/* IQR bar */}
                        <div style={{
                          position: "absolute", top: 6, height: 12, borderRadius: 3,
                          left: `${(d.p25 / maxDay) * 100}%`,
                          width: `${((d.p75 - d.p25) / maxDay) * 100}%`,
                          background: color, opacity: 0.4,
                        }} />
                        {/* Median dot */}
                        <div style={{
                          position: "absolute", top: 6,
                          left: `${(d.median / maxDay) * 100}%`,
                          width: 12, height: 12, borderRadius: "50%",
                          background: color, border: "2px solid #fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          transform: "translateX(-6px)",
                        }} />
                      </div>
                      <div style={{ width: 80, textAlign: "right" }}>
                        <span style={{
                          fontFamily: FONTS.display, fontSize: 14, fontWeight: 700,
                          color: d.median < 3 ? "#10B981" : d.median <= 7 ? "#F59E0B" : "#EF4444",
                        }}>
                          {d.median.toFixed(1)}d
                        </span>
                        {d.outliers > 0 && (
                          <span style={{
                            fontFamily: FONTS.body, fontSize: 10, color: "#EF4444",
                            marginLeft: 4,
                          }}>
                            ({d.outliers} &gt;14d)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray,
                  marginTop: 8, display: "flex", gap: 16,
                }}>
                  <span>Dot = median</span>
                  <span>Bar = 25th-75th percentile range</span>
                </div>
              </div>
            )}

            {/* AI insight */}
            {aiLoading ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="sk" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  Analyzing response patterns...
                </div>
                <div className="sk" style={{ height: 14, width: "100%", marginTop: 12, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "80%", marginTop: 8, borderRadius: 4 }} />
              </div>
            ) : aiInsight ? (
              <div style={{
                fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 1.7,
                borderTop: `1px solid ${COLORS.lightBorder}`, paddingTop: 16,
              }}>
                {renderMarkdownBlock(aiInsight)}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
