/**
 * CleanSafeReport.tsx — CBD Clean & Safe operations command center.
 *
 * Sections:
 *  1. 311 Heatmap with category filter toggles
 *  2. Monthly trend chart (recharts)
 *  3. Top hotspot addresses (clickable → map zoom)
 *  4. AI operational analysis (Claude Haiku)
 *  5. Permit impact flags
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

import { useCBD } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { fetch311ForCBD, type CBD311Row } from "../../utils/cbdFetch";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import { CBDLoadingExperience } from "../../components/CBDLoadingExperience";
import Anthropic from "@anthropic-ai/sdk";

const DATASF = "https://data.sfgov.org/resource";
const MAPBOX_TILE = (token: string) =>
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${token}`;

// ── Types ──────────────────────────────────────────────────────────────────

interface ThreeOneOneRow extends CBD311Row {
  normalizedCategory: Category;
}

interface PermitRow {
  lat: number;
  lng: number;
  type: string;
  cost: number;
  address: string;
  status?: string;
}

// ── Categories ─────────────────────────────────────────────────────────────

const CATEGORIES = ["Graffiti", "Street Cleaning", "Encampments", "Blocked Sidewalk", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_COLORS: Record<Category, string> = {
  Graffiti:           "#7C3AED",
  "Street Cleaning":  "#92400E",
  Encampments:        "#DC2626",
  "Blocked Sidewalk": "#EA580C",
  Other:              "#6B7280",
};

function normalizeCategory(serviceName: string): Category {
  const s = (serviceName ?? "").toLowerCase();
  if (s.includes("graffiti")) return "Graffiti";
  if ((s.includes("street") || s.includes("sidewalk")) && s.includes("clean")) return "Street Cleaning";
  if (s.includes("encampment")) return "Encampments";
  if (s.includes("sidewalk") || s.includes("block")) return "Blocked Sidewalk";
  return "Other";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function boundsFromMultiPolygon(coords: number[][][][]): L.LatLngBounds | null {
  const pts: L.LatLng[] = [];
  for (const poly of coords)
    for (const ring of poly)
      for (const [lng, lat] of ring)
        pts.push(L.latLng(lat, lng));
  return pts.length ? L.latLngBounds(pts) : null;
}

// ── Icon helpers ───────────────────────────────────────────────────────────

function iconCircle(emoji: string, borderColor: string, size: number): L.DivIcon {
  const half = size / 2;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#fff;border:2px solid ${borderColor};
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.5)}px;line-height:1;
      box-shadow:0 1px 4px rgba(0,0,0,0.18);
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function threeOneOneIcon(category: string, size = 22): L.DivIcon {
  const s = (category ?? "").toLowerCase();
  if (s.includes("graffiti"))                                return iconCircle("G", "#7C3AED", size);
  if (s.includes("street") && s.includes("clean"))          return iconCircle("C", "#92400E", size);
  if (s.includes("sidewalk") && s.includes("clean"))        return iconCircle("C", "#92400E", size);
  if (s.includes("encampment"))                              return iconCircle("E", "#DC2626", size);
  if (s.includes("sidewalk") || s.includes("block"))        return iconCircle("\u26A0", "#EA580C", size);
  return iconCircle("?", "#6B7280", size);
}

// ── Map helpers ────────────────────────────────────────────────────────────

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => { if (bounds) map.fitBounds(bounds.pad(0.1)); }, [map, bounds]);
  return null;
}

function MapFlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 18, { duration: 0.5 });
  }, [map, target]);
  return null;
}

// ── Section card ───────────────────────────────────────────────────────────

function Section({ title, accent, children }: {
  title: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      padding: "20px 24px", marginBottom: 24,
    }}>
      <h2 style={{
        fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
        color: accent, margin: "0 0 16px",
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Category filter toggles ────────────────────────────────────────────────

function CategoryFilters({ active, onChange }: {
  active: Record<Category, boolean>;
  onChange: (cat: Category, val: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {CATEGORIES.map(cat => (
        <label key={cat} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 20, cursor: "pointer",
          background: active[cat] ? CAT_COLORS[cat] + "18" : COLORS.cream,
          border: `1.5px solid ${active[cat] ? CAT_COLORS[cat] : "transparent"}`,
          fontFamily: FONTS.body, fontSize: 12, fontWeight: active[cat] ? 700 : 500,
          color: active[cat] ? CAT_COLORS[cat] : COLORS.midGray,
          userSelect: "none", transition: "all 0.15s",
        }}>
          <input type="checkbox" checked={active[cat]}
            onChange={e => onChange(cat, e.target.checked)}
            style={{ display: "none" }}
          />
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: CAT_COLORS[cat], flexShrink: 0,
          }} />
          {cat}
        </label>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CleanSafeReport() {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";

  const [rows311, setRows311] = useState<ThreeOneOneRow[]>([]);
  const [histRows311, setHistRows311] = useState<ThreeOneOneRow[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [permits, setPermits] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  const [catFilter, setCatFilter] = useState<Record<Category, boolean>>(
    Object.fromEntries(CATEGORIES.map(c => [c, true])) as Record<Category, boolean>,
  );
  const toggleCat = useCallback((cat: Category, val: boolean) => {
    setCatFilter(prev => ({ ...prev, [cat]: val }));
  }, []);

  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Fetch 311 (server-side spatial filter) + permits ──────────────────
  useEffect(() => {
    if (!config?.boundary_geojson) return;
    setLoading(true);
    setFetchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const district = config.supervisor_district ? String(config.supervisor_district) : null;
    const permitWhere = [
      `location IS NOT NULL`,
      `status IN('ISSUED','FILING','APPROVED')`,
      district ? `supervisor_district='${district}'` : null,
    ].filter(Boolean).join(" AND ");

    // 311: server-side lat/lng filter via fetch311ForCBD (no client-side polygon)
    // Permits: simple district filter (small dataset)
    Promise.all([
      fetch311ForCBD(config, { days: 180, limit: 3000, signal: controller.signal }),

      fetch(`${DATASF}/i98e-djp9.json?${new URLSearchParams({
        $where: permitWhere,
        $select: "location,permit_type_definition,estimated_cost,street_number,street_name,street_suffix,status",
        $limit: "2000",
      })}`, { signal: controller.signal }).then(r => r.json()).catch(() => []),
    ]).then(([raw311, rawPermit]) => {
      clearTimeout(timeout);

      // Add normalizedCategory to 311 rows
      const filtered311: ThreeOneOneRow[] = raw311.map(r => ({
        ...r,
        normalizedCategory: normalizeCategory(r.category),
      }));

      const filteredPermits: PermitRow[] = (rawPermit as any[])
        .filter((r: any) => r.location?.coordinates)
        .map((r: any) => ({
          lat: r.location.coordinates[1], lng: r.location.coordinates[0],
          type: r.permit_type_definition ?? "",
          cost: parseFloat(r.estimated_cost) || 0,
          address: [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" "),
          status: r.status,
        }));

      console.log(`[CleanSafe] ${config.name}: ${filtered311.length} 311, ${filteredPermits.length} permits`);
      setRows311(filtered311);
      setPermits(filteredPermits);
      setLoading(false);

      // Background: 365-day historical data for trend charts
      setHistLoading(true);
      fetch311ForCBD(config, { days: 365, limit: 5000 })
        .then(hist => {
          setHistRows311(hist.map(r => ({ ...r, normalizedCategory: normalizeCategory(r.category) })));
        })
        .catch(err => console.warn("[CleanSafe] historical fetch failed:", err))
        .finally(() => setHistLoading(false));
    }).catch(err => {
      clearTimeout(timeout);
      if (err?.name === "AbortError") {
        setFetchError("Unable to load 311 data — request timed out. Try refreshing.");
      } else {
        setFetchError("Unable to load 311 data. Try refreshing.");
      }
      console.warn("[CleanSafe] fetch failed:", err);
      setLoading(false);
    });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [config]);

  // ── AI operational analysis ──────────────────────────────────────────────
  useEffect(() => {
    if (loading || !config || rows311.length === 0 || aiAnalysis) return;
    const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setAiAnalysis("*AI analysis unavailable — API key not configured.*"); return; }

    setAiLoading(true);
    const catCounts: Record<string, number> = {};
    for (const r of rows311) catCounts[r.normalizedCategory] = (catCounts[r.normalizedCategory] ?? 0) + 1;
    const catBreakdown = Object.entries(catCounts).sort(([, a], [, b]) => b - a)
      .map(([c, n]) => `${c}: ${n}`).join(", ");

    const addrMap: Record<string, { count: number; topCat: string }> = {};
    for (const r of rows311) {
      const a = r.address.toUpperCase().trim();
      if (!a) continue;
      if (!addrMap[a]) addrMap[a] = { count: 0, topCat: "" };
      addrMap[a].count++;
    }
    for (const a of Object.keys(addrMap)) {
      const cm: Record<string, number> = {};
      for (const r of rows311) if (r.address.toUpperCase().trim() === a) cm[r.normalizedCategory] = (cm[r.normalizedCategory] ?? 0) + 1;
      addrMap[a].topCat = Object.entries(cm).sort(([, x], [, y]) => y - x)[0]?.[0] ?? "";
    }
    const topAddrs = Object.entries(addrMap).sort(([, a], [, b]) => b.count - a.count).slice(0, 10)
      .map(([addr, { count, topCat }]) => `${addr} (${count} reports, mostly ${topCat})`).join("\n");

    // Resolution data for AI context
    const closedCount = rows311.filter(r => r.closedDate).length;
    const resRate = rows311.length > 0 ? ((closedCount / rows311.length) * 100).toFixed(1) : "0";
    const resDaysList: number[] = [];
    for (const r of rows311) {
      if (!r.closedDate) continue;
      const d = (new Date(r.closedDate).getTime() - new Date(r.date).getTime()) / 86_400_000;
      if (d > 0) resDaysList.push(d);
    }
    const avgResDays = resDaysList.length > 0
      ? (resDaysList.reduce((s, d) => s + d, 0) / resDaysList.length).toFixed(1)
      : "N/A";
    const resCatDays: Record<string, number[]> = {};
    for (const r of rows311) {
      if (!r.closedDate) continue;
      const d = (new Date(r.closedDate).getTime() - new Date(r.date).getTime()) / 86_400_000;
      if (d > 0) {
        if (!resCatDays[r.normalizedCategory]) resCatDays[r.normalizedCategory] = [];
        resCatDays[r.normalizedCategory].push(d);
      }
    }
    const catResBreakdown = Object.entries(resCatDays)
      .map(([cat, days]) => `${cat}: ${(days.reduce((s, d) => s + d, 0) / days.length).toFixed(1)} days avg`)
      .join(", ");

    const prompt = `You are an operations analyst for the ${config.name} Community Benefit District in San Francisco. Analyze the 311 service request data. Identify patterns, hotspots, resolution performance, and trends. Provide 3 specific actionable recommendations with addresses. Be concise and data-driven.

DATA (last 12 months within ${config.name} CBD boundary):
- Total 311 requests: ${rows311.length}
- Category breakdown: ${catBreakdown}
- Top hotspot addresses:
${topAddrs}
- Active construction permits in district: ${permits.length}

RESOLUTION DATA:
- Opened: ${rows311.length}, Closed/Resolved: ${closedCount} (${resRate}% resolution rate)
- Average days to resolution: ${avgResDays}
- Resolution speed by category: ${catResBreakdown || "no data"}

Flag any categories with slow resolution times vs others and recommend resource reallocation. Write 2-3 paragraphs of analysis. Include specific addresses and numbers. End with 3 bullet-point recommendations.`;

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }).then(res => {
      setAiAnalysis(res.content[0]?.type === "text" ? res.content[0].text : "");
    }).catch(err => {
      console.warn("[CleanSafe] AI failed:", err);
      setAiAnalysis("*Unable to generate AI analysis at this time.*");
    }).finally(() => setAiLoading(false));
  }, [loading, config, rows311, permits, aiAnalysis]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const filtered311 = useMemo(
    () => rows311.filter(r => catFilter[r.normalizedCategory]),
    [rows311, catFilter],
  );

  // Use historical data for trends when available, fall back to 90-day data
  const trendSource = histRows311 ?? rows311;

  const trendData = useMemo(() => {
    if (!trendSource.length) return [];
    const buckets: Record<string, Record<string, number>> = {};
    for (const r of trendSource) {
      if (!r.month) continue;
      if (!buckets[r.month]) buckets[r.month] = { Graffiti: 0, "Street Cleaning": 0, Encampments: 0, "Blocked Sidewalk": 0, Other: 0 };
      buckets[r.month][r.normalizedCategory] = (buckets[r.month][r.normalizedCategory] ?? 0) + 1;
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([month, cats]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      ...cats,
    }));
  }, [trendSource]);

  // Resolution stats
  const resolutionStats = useMemo(() => {
    const closed = rows311.filter(r => r.closedDate);
    const total = rows311.length;
    const rate = total > 0 ? closed.length / total : 0;

    // Days to resolution for closed requests
    const daysList: number[] = [];
    for (const r of closed) {
      const open = new Date(r.date).getTime();
      const close = new Date(r.closedDate!).getTime();
      if (close > open) daysList.push((close - open) / 86_400_000);
    }
    const avgDays = daysList.length > 0 ? daysList.reduce((s, d) => s + d, 0) / daysList.length : 0;

    // Per-category average resolution days
    const catDays: Record<string, number[]> = {};
    for (const r of closed) {
      const open = new Date(r.date).getTime();
      const close = new Date(r.closedDate!).getTime();
      if (close <= open) continue;
      const d = (close - open) / 86_400_000;
      if (!catDays[r.normalizedCategory]) catDays[r.normalizedCategory] = [];
      catDays[r.normalizedCategory].push(d);
    }
    const catAvgDays: Record<string, number> = {};
    for (const [cat, days] of Object.entries(catDays)) {
      catAvgDays[cat] = days.reduce((s, d) => s + d, 0) / days.length;
    }

    return { closedCount: closed.length, total, rate, avgDays, catAvgDays };
  }, [rows311]);

  // Weekly open vs closed data for area chart (uses historical data when available)
  const weeklyOpenClose = useMemo(() => {
    if (!trendSource.length) return [];
    function weekStart(dateStr: string): string {
      const d = new Date(dateStr);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      return monday.toISOString().split("T")[0];
    }

    const opened: Record<string, number> = {};
    const closed: Record<string, number> = {};
    for (const r of trendSource) {
      const w = weekStart(r.date);
      opened[w] = (opened[w] ?? 0) + 1;
      if (r.closedDate) {
        const cw = weekStart(r.closedDate);
        closed[cw] = (closed[cw] ?? 0) + 1;
      }
    }
    const allWeeks = new Set([...Object.keys(opened), ...Object.keys(closed)]);
    return [...allWeeks].sort().map(w => ({
      week: new Date(w).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Opened: opened[w] ?? 0,
      Resolved: closed[w] ?? 0,
    }));
  }, [trendSource]);

  const hotspots = useMemo(() => {
    const m: Record<string, { count: number; cats: Record<string, number>; lastDate: string; lat: number; lng: number; resDays: number[] }> = {};
    for (const r of rows311) {
      const a = r.address.toUpperCase().trim();
      if (!a) continue;
      if (!m[a]) m[a] = { count: 0, cats: {}, lastDate: "", lat: r.lat, lng: r.lng, resDays: [] };
      m[a].count++;
      m[a].cats[r.normalizedCategory] = (m[a].cats[r.normalizedCategory] ?? 0) + 1;
      if (r.date > m[a].lastDate) m[a].lastDate = r.date;
      if (r.closedDate) {
        const d = (new Date(r.closedDate).getTime() - new Date(r.date).getTime()) / 86_400_000;
        if (d > 0) m[a].resDays.push(d);
      }
    }
    return Object.entries(m).sort(([, a], [, b]) => b.count - a.count).slice(0, 10)
      .map(([address, { count, cats, lastDate, lat, lng, resDays }]) => ({
        address, count, lat, lng, lastDate,
        topCategory: Object.entries(cats).sort(([, a], [, b]) => b - a)[0]?.[0] as Category ?? "Other",
        avgResDays: resDays.length > 0 ? resDays.reduce((s, d) => s + d, 0) / resDays.length : null,
      }));
  }, [rows311]);

  const constructionPermits = useMemo(() =>
    permits.filter(p => {
      const t = (p.type ?? "").toLowerCase();
      return t.includes("new construction") || t.includes("demolition");
    }),
  [permits]);

  const permitStreets = useMemo(() => {
    const sm: Record<string, number> = {};
    for (const p of constructionPermits) {
      const parts = p.address.split(" ");
      const street = parts.slice(1).join(" ") || p.address;
      sm[street] = (sm[street] ?? 0) + 1;
    }
    return Object.entries(sm).sort(([, a], [, b]) => b - a);
  }, [constructionPermits]);

  if (!config) return null;

  const mapCenter: [number, number] = [config.center_lat ?? 37.79, config.center_lng ?? -122.40];
  const geoJSON: GeoJSON.FeatureCollection | null = config.boundary_geojson
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: config.boundary_geojson as GeoJSON.MultiPolygon, properties: {} }] }
    : null;
  const mapBounds = config.boundary_geojson ? boundsFromMultiPolygon(config.boundary_geojson.coordinates) : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{
          fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700,
          color: COLORS.charcoal, margin: 0,
        }}>
          Clean & Safe Report
        </h1>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6,
        }}>
          311 service requests within {config.name} — last 90 days{histRows311 ? " (12-month trends loaded)" : ""}
        </p>
      </div>

      {/* ── Loading experience ────────────────────────────────── */}
      <CBDLoadingExperience
        config={config}
        loading={loading}
        itemCount={rows311.length}
        variant="clean-safe"
      />

      {/* ── Fetch error ──────────────────────────────────────── */}
      {fetchError && !loading && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 12, padding: "20px 24px", marginBottom: 24,
          fontFamily: FONTS.body, fontSize: 14, color: "#991B1B",
          textAlign: "center",
        }}>
          {fetchError}
        </div>
      )}

      {!loading && !fetchError && (
        <div style={{ animation: "cp-page-in 0.3s ease-out" }}>
          {/* ── Summary bar ────────────────────────────────────────── */}
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24,
          }}>
            {[
              { label: "Total Requests", value: String(rows311.length), color: "#8B5CF6" },
              { label: "Open", value: String(rows311.length - resolutionStats.closedCount), color: "#EA580C" },
              { label: "Resolved", value: String(resolutionStats.closedCount), color: "#10B981" },
              { label: "Avg Resolution", value: resolutionStats.avgDays > 0 ? `${resolutionStats.avgDays.toFixed(1)}d` : "\u2014", color: "#3B82F6" },
              { label: "Categories", value: String(CATEGORIES.length), color: "#6B7280" },
              {
                label: "Resolution Rate",
                value: rows311.length > 0 ? `${(resolutionStats.rate * 100).toFixed(0)}%` : "\u2014",
                color: resolutionStats.rate >= 0.75 ? "#10B981" : resolutionStats.rate >= 0.50 ? "#F59E0B" : "#EF4444",
              },
            ].map(s => (
              <div key={s.label} style={{
                flex: "1 1 120px", minWidth: 100,
                background: COLORS.white, borderRadius: 12,
                border: `1px solid ${COLORS.lightBorder}`,
                borderLeft: `4px solid ${s.color}`,
                padding: "14px 12px", textAlign: "center",
              }}>
                <div style={{
                  fontFamily: FONTS.display, fontSize: 24, fontWeight: 700,
                  color: s.color, lineHeight: 1.1,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 500,
                  color: COLORS.warmGray, marginTop: 4, textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Section 1: 311 Request Map ──────────────────────── */}
          <Section title="311 Request Map" accent={accent}>
            <CategoryFilters active={catFilter} onChange={toggleCat} />
            <div style={{
              borderRadius: 10, overflow: "hidden",
              height: 420, border: `1px solid ${COLORS.lightBorder}`,
            }}>
              <MapContainer
                center={mapCenter} zoom={config.default_zoom}
                style={{ width: "100%", height: "100%" }}
                zoomControl={true} attributionControl={false}
              >
                <TileLayer
                  url={MAPBOX_TILE((import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "")}
                  maxZoom={19} tileSize={512} zoomOffset={-1}
                />
                <FitBounds bounds={mapBounds} />
                <MapFlyTo target={flyTo} />

                {geoJSON && (
                  <GeoJSON data={geoJSON} style={() => ({
                    color: accent, weight: 2, dashArray: "6 4",
                    fillColor: accent, fillOpacity: 0.04,
                  })} />
                )}

                {filtered311.slice(0, 2000).map((r, i) => (
                  <Marker key={`311-${i}`} position={[r.lat, r.lng]} icon={threeOneOneIcon(r.category)}>
                    <Popup>
                      <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                        <strong style={{ color: CAT_COLORS[r.normalizedCategory] }}>{r.normalizedCategory}</strong>
                        {r.subtype && <div style={{ fontSize: 12, color: COLORS.midGray }}>{r.subtype}</div>}
                        <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                          <tbody>
                            <tr><td style={{ color: "#999", paddingRight: 10 }}>Address</td><td>{r.address}</td></tr>
                            <tr><td style={{ color: "#999", paddingRight: 10 }}>Date</td><td>{r.date}</td></tr>
                            <tr><td style={{ color: "#999", paddingRight: 10 }}>Status</td><td>{r.status ?? "\u2014"}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div style={{
              display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10,
              fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
            }}>
              {CATEGORIES.map(cat => (
                <span key={cat} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[cat] }} />
                  {cat}
                </span>
              ))}
              <span style={{ marginLeft: "auto" }}>{filtered311.length} requests shown</span>
            </div>
          </Section>

          {/* ── Section 2: Hotspots + Trends side by side ────────── */}
          <style>{`
            @media (max-width: 768px) {
              .cs-two-col { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div className="cs-two-col" style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 24,
          }}>

            {/* Left: Top Hotspots */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: `1px solid ${COLORS.lightBorder}`,
              padding: "20px 24px",
              display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
                color: accent, margin: "0 0 16px",
              }}>
                Top Hotspots
              </h2>
              {hotspots.length > 0 ? (
                <div style={{ overflowX: "auto", flex: 1 }}>
                  <table style={{
                    width: "100%", borderCollapse: "collapse",
                    fontFamily: FONTS.body, fontSize: 13,
                  }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLORS.lightBorder}` }}>
                        {["#", "Address", "Total", "Top Category", "Avg Resolution", "Last Report"].map(h => (
                          <th key={h} style={{
                            textAlign: "left", padding: "8px 12px",
                            fontSize: 11, fontWeight: 700, color: COLORS.warmGray,
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hotspots.map((h, i) => (
                        <tr key={h.address}
                          onClick={() => setFlyTo([h.lat, h.lng])}
                          style={{
                            cursor: "pointer",
                            borderBottom: `1px solid ${COLORS.lightBorder}`,
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = COLORS.cream; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <td style={{ padding: "10px 12px", color: COLORS.warmGray, fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: accent }}>{h.address}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{h.count}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 12, fontSize: 11,
                              background: CAT_COLORS[h.topCategory] + "18",
                              color: CAT_COLORS[h.topCategory], fontWeight: 600,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: CAT_COLORS[h.topCategory] }} />
                              {h.topCategory}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {h.avgResDays !== null ? (
                              <span style={{
                                fontWeight: 700, fontSize: 12,
                                color: h.avgResDays < 3 ? "#10B981" : h.avgResDays <= 7 ? "#F59E0B" : "#EF4444",
                              }}>
                                {h.avgResDays.toFixed(1)}d
                              </span>
                            ) : (
                              <span style={{ color: COLORS.warmGray }}>{"\u2014"}</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: COLORS.midGray }}>{h.lastDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>No hotspot data.</p>
              )}
              <p style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 8 }}>
                Click any address to zoom the map above.
              </p>
            </div>

            {/* Right: Monthly Trends */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: `1px solid ${COLORS.lightBorder}`,
              padding: "20px 24px",
              display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
                color: accent, margin: "0 0 12px",
              }}>
                Trends
              </h2>
              {histLoading && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                  marginBottom: 8,
                }}>
                  <div className="sk" style={{ width: 12, height: 12, borderRadius: "50%" }} />
                  Loading 12-month historical data...
                </div>
              )}

              {/* Open vs Resolved area chart */}
              {weeklyOpenClose.length > 1 && (
                <>
                  <h3 style={{
                    fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
                    color: COLORS.charcoal, margin: "0 0 6px",
                  }}>
                    Open vs Resolved (weekly)
                  </h3>
                  <div style={{ height: 160, marginBottom: 16 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyOpenClose} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: FONTS.body }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fontFamily: FONTS.body }} />
                        <Tooltip contentStyle={{
                          fontFamily: FONTS.body, fontSize: 12, borderRadius: 8,
                          border: `1px solid ${COLORS.lightBorder}`,
                        }} />
                        <Area type="monotone" dataKey="Opened" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} strokeWidth={2} />
                        <Area type="monotone" dataKey="Resolved" stroke="#10B981" fill="#10B981" fillOpacity={0.25} strokeWidth={2} />
                        <Legend wrapperStyle={{ fontFamily: FONTS.body, fontSize: 10 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray,
                    marginBottom: 16, lineHeight: 1.4,
                  }}>
                    Green above blue = clearing backlog. Blue above green = falling behind.
                  </p>
                </>
              )}

              {/* Category trends line chart */}
              <h3 style={{
                fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
                color: COLORS.charcoal, margin: "0 0 6px",
              }}>
                By Category (monthly)
              </h3>
              {trendData.length > 0 ? (
                <div style={{ flex: 1, minHeight: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: FONTS.body }} />
                      <YAxis tick={{ fontSize: 11, fontFamily: FONTS.body }} />
                      <Tooltip contentStyle={{
                        fontFamily: FONTS.body, fontSize: 12, borderRadius: 8,
                        border: `1px solid ${COLORS.lightBorder}`,
                      }} />
                      <Legend wrapperStyle={{ fontFamily: FONTS.body, fontSize: 11 }} />
                      {CATEGORIES.map(cat => (
                        <Line key={cat} type="monotone" dataKey={cat}
                          stroke={CAT_COLORS[cat]} strokeWidth={2}
                          dot={{ r: 3 }} activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                  No trend data available.
                </p>
              )}
            </div>
          </div>

          {/* ── Section 3: AI Operational Analysis ──────────────── */}
          <Section title="AI Operational Analysis" accent={accent}>
            {aiLoading ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="sk" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  Analyzing 311 patterns...
                </div>
                <div className="sk" style={{ height: 14, width: "100%", marginTop: 12, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "90%", marginTop: 8, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "80%", marginTop: 8, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "70%", marginTop: 8, borderRadius: 4 }} />
              </div>
            ) : aiAnalysis ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 1.7 }}>
                {renderMarkdownBlock(aiAnalysis)}
              </div>
            ) : null}
          </Section>

          {/* ── Section 4: Permit Impact Flags ──────────────────── */}
          <Section title="Permit Impact Flags" accent={accent}>
            {constructionPermits.length > 0 ? (
              <>
                <div style={{
                  background: "#FEF3CD", border: "1px solid #FFC107",
                  borderRadius: 10, padding: "14px 18px", marginBottom: 16,
                  fontFamily: FONTS.body, fontSize: 13, color: "#856404", lineHeight: 1.6,
                }}>
                  <strong>
                    {constructionPermits.length} active construction/demolition permit{constructionPermits.length !== 1 ? "s" : ""}
                  </strong>
                  {permitStreets.length > 0 && (
                    <> on {permitStreets.slice(0, 3).map(([st]) => st).join(", ")}</>
                  )}{" "}
                  may generate increased debris and sidewalk obstructions.
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%", borderCollapse: "collapse",
                    fontFamily: FONTS.body, fontSize: 12,
                  }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLORS.lightBorder}` }}>
                        {["Address", "Type", "Est. Cost", "Status"].map(h => (
                          <th key={h} style={{
                            textAlign: "left", padding: "6px 10px",
                            fontSize: 11, fontWeight: 700, color: COLORS.warmGray,
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {constructionPermits.slice(0, 10).map((p, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.address}</td>
                          <td style={{ padding: "8px 10px" }}>{p.type}</td>
                          <td style={{ padding: "8px 10px" }}>{p.cost ? `$${(p.cost / 1000).toFixed(0)}K` : "\u2014"}</td>
                          <td style={{ padding: "8px 10px", color: COLORS.midGray }}>{p.status ?? "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{
                fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
                background: COLORS.cream, borderRadius: 10, padding: "14px 18px",
              }}>
                No active construction or demolition permits within the district boundary.
              </p>
            )}

            {permits.length > constructionPermits.length && (
              <p style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 10 }}>
                {permits.length} total active permits in district ({permits.length - constructionPermits.length} alterations/other)
              </p>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
