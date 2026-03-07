/**
 * CBDDashboard.tsx — Landing page for a CBD portal.
 *
 * Hero, stat cards (permits/311/evictions filtered to CBD boundary),
 * AI operational briefing, expandable map preview, quick-link cards.
 *
 * Enhancements:
 *  - Category divIcon markers (emoji inside colored circle)
 *  - Colored stat cards with left accent border
 *  - Expandable full-screen map overlay
 *  - 16:9 map preview with "Click to explore" hover
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useCBD, type CBDConfig } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { isPointInCBD, type CBDBoundaryEntry } from "../../utils/geoFilter";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import { CBDLoadingExperience } from "../../components/CBDLoadingExperience";
import { fetch311ForCBD } from "../../utils/cbdFetch";
import Anthropic from "@anthropic-ai/sdk";
import { useLanguage, getLanguageInstruction } from "../../contexts/LanguageContext";

const DATASF = "https://data.sfgov.org/resource";
const MAPBOX_TILE = (token: string) =>
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${token}`;

// ── Stat card colors ──────────────────────────────────────────────────────

const STAT_COLORS = {
  permits:     "#3B82F6",
  threeOneOne: "#8B5CF6",
  evictions:   "#EF4444",
  businesses:  "#10B981",
};

// ── Types ──────────────────────────────────────────────────────────────────

interface PermitPoint { lat: number; lng: number; type: string; cost: number; address: string; status?: string }
interface ThreeOneOnePoint { lat: number; lng: number; category: string; address: string; date: string; status?: string }
interface EvictionPoint { lat: number; lng: number; address: string; date: string }

interface CBDStats {
  permits: PermitPoint[];
  threeOneOne: ThreeOneOnePoint[];
  evictions: EvictionPoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildBoundaryEntry(config: CBDConfig): CBDBoundaryEntry | null {
  if (!config.boundary_geojson) return null;
  return { name: config.name, geometry: config.boundary_geojson };
}

function boundsFromMultiPolygon(coords: number[][][][]): L.LatLngBounds | null {
  const pts: L.LatLng[] = [];
  for (const poly of coords)
    for (const ring of poly)
      for (const [lng, lat] of ring)
        pts.push(L.latLng(lat, lng));
  return pts.length ? L.latLngBounds(pts) : null;
}

// ── Category icon divIcons ────────────────────────────────────────────────

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

function permitIcon(type: string, size = 24): L.DivIcon {
  const s = (type ?? "").toLowerCase();
  if (s.includes("new construction"))           return iconCircle("\u{1F3D7}", "#EF4444", size);
  if (s.includes("demolition"))                  return iconCircle("\u{1F3DA}", "#F59E0B", size);
  return iconCircle("\u{1F527}", "#3B82F6", size); // alteration / other
}

function threeOneOneIcon(category: string, size = 24): L.DivIcon {
  const s = (category ?? "").toLowerCase();
  if (s.includes("graffiti"))                    return iconCircle("G", "#7C3AED", size);
  if (s.includes("street") && s.includes("clean")) return iconCircle("C", "#92400E", size);
  if (s.includes("sidewalk") && s.includes("clean")) return iconCircle("C", "#92400E", size);
  if (s.includes("encampment"))                  return iconCircle("E", "#DC2626", size);
  if (s.includes("sidewalk") || s.includes("block")) return iconCircle("\u26A0", "#EA580C", size);
  return iconCircle("?", "#6B7280", size);
}

function evictionIcon(size = 24): L.DivIcon {
  const half = size / 2;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${Math.round(size * 0.6)}px;height:${Math.round(size * 0.6)}px;
      background:#991b1b;border:2px solid #fff;
      transform:rotate(45deg);
      box-shadow:0 1px 4px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

// ── FitBounds helper (inside MapContainer) ─────────────────────────────────

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => { if (bounds) map.fitBounds(bounds.pad(0.1)); }, [map, bounds]);
  return null;
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color, loading }: {
  label: string; value: string | number; color: string; loading: boolean;
}) {
  return (
    <div style={{
      flex: "1 1 140px",
      background: COLORS.white,
      borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      borderLeft: `4px solid ${color}`,
      padding: "20px 16px",
      textAlign: "center",
      minWidth: 120,
    }}>
      <div style={{
        fontFamily: FONTS.display, fontSize: 32, fontWeight: 700,
        color: loading ? COLORS.warmGray : color,
        lineHeight: 1.1,
      }}>
        {loading ? "..." : value}
      </div>
      <div style={{
        fontFamily: FONTS.body, fontSize: 12, fontWeight: 500,
        color: COLORS.warmGray, marginTop: 6, textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Quick link card ────────────────────────────────────────────────────────

function QuickLink({ label, description, accent, onClick }: {
  label: string; description: string; accent: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: "1 1 160px",
      background: COLORS.white,
      borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      padding: "16px 14px",
      textAlign: "left",
      cursor: "pointer",
      transition: "border-color 0.15s, box-shadow 0.15s",
      minWidth: 140,
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.boxShadow = `0 2px 12px ${accent}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = COLORS.lightBorder;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 700, color: COLORS.charcoal }}>
        {label}
      </div>
      <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 4 }}>
        {description}
      </div>
    </button>
  );
}

// ── Layer toggle for expanded map ─────────────────────────────────────────

interface OverlayLayers { permits: boolean; threeOneOne: boolean; evictions: boolean }

function OverlayLayerPanel({ layers, onChange }: {
  layers: OverlayLayers;
  onChange: (key: keyof OverlayLayers, val: boolean) => void;
}) {
  const meta: { key: keyof OverlayLayers; label: string; color: string }[] = [
    { key: "permits",      label: "Permits",    color: STAT_COLORS.permits },
    { key: "threeOneOne",  label: "311",         color: STAT_COLORS.threeOneOne },
    { key: "evictions",    label: "Evictions",   color: STAT_COLORS.evictions },
  ];
  return (
    <div style={{
      position: "absolute", top: 12, right: 12, zIndex: 1001,
      background: "rgba(255,255,255,0.97)", borderRadius: 10,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
      padding: "10px 14px",
    }}>
      {meta.map(({ key, label, color }) => (
        <label key={key} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 0", cursor: "pointer", userSelect: "none",
          fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal,
        }}>
          <input type="checkbox" checked={layers[key]}
            onChange={e => onChange(key, e.target.checked)}
            style={{ accentColor: color, width: 14, height: 14, cursor: "pointer" }}
          />
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
          {label}
        </label>
      ))}
    </div>
  );
}

// ── Expanded map overlay ──────────────────────────────────────────────────

function ExpandedMapOverlay({ stats, config, onClose }: {
  stats: CBDStats; config: CBDConfig; onClose: () => void;
}) {
  const accent = config.accent_color;
  const mapCenter: [number, number] = [config.center_lat ?? 37.79, config.center_lng ?? -122.40];
  const geoJSON: GeoJSON.FeatureCollection | null = config.boundary_geojson
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: config.boundary_geojson as GeoJSON.MultiPolygon, properties: {} }] }
    : null;
  const mapBounds = config.boundary_geojson ? boundsFromMultiPolygon(config.boundary_geojson.coordinates) : null;
  const [layers, setLayers] = useState<OverlayLayers>({ permits: true, threeOneOne: true, evictions: true });
  const toggleLayer = useCallback((key: keyof OverlayLayers, val: boolean) => {
    setLayers(prev => ({ ...prev, [key]: val }));
  }, []);

  // Escape key closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <style>{`
        @keyframes cbd-overlay-in { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      `}</style>
      <div style={{
        position: "fixed", inset: 0, zIndex: 2000, background: "#fff",
        display: "flex", flexDirection: "column",
        animation: "cbd-overlay-in 0.3s ease forwards",
      }}>
        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", borderBottom: `1px solid ${COLORS.lightBorder}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700, color: accent,
          }}>
            {config.name} — Map
          </span>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${COLORS.lightBorder}`,
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: COLORS.charcoal,
          }}>
            Close
          </button>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer
            center={mapCenter}
            zoom={config.default_zoom}
            style={{ width: "100%", height: "100%" }}
            zoomControl={true}
            attributionControl={false}
          >
            <TileLayer
              url={MAPBOX_TILE((import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "")}
              maxZoom={19} tileSize={512} zoomOffset={-1}
            />
            <FitBounds bounds={mapBounds} />

            {geoJSON && (
              <GeoJSON data={geoJSON} style={() => ({
                color: accent, weight: 2, dashArray: "6 4",
                fillColor: accent, fillOpacity: 0.04,
              })} />
            )}

            {layers.permits && stats.permits.slice(0, 500).map((p, i) => (
              <Marker key={`p-${i}`} position={[p.lat, p.lng]} icon={permitIcon(p.type, 24)}>
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                    <strong>{p.address}</strong>
                    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr><td style={{ color: "#999", paddingRight: 10 }}>Type</td><td>{p.type || "Permit"}</td></tr>
                        <tr><td style={{ color: "#999", paddingRight: 10 }}>Est. Cost</td><td>{p.cost ? `$${(p.cost / 1000).toFixed(0)}K` : "—"}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </Marker>
            ))}

            {layers.threeOneOne && stats.threeOneOne.slice(0, 500).map((r, i) => (
              <Marker key={`311-${i}`} position={[r.lat, r.lng]} icon={threeOneOneIcon(r.category, 24)}>
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                    <strong>{r.category || "311 Request"}</strong>
                    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr><td style={{ color: "#999", paddingRight: 10 }}>Address</td><td>{r.address}</td></tr>
                        <tr><td style={{ color: "#999", paddingRight: 10 }}>Date</td><td>{r.date}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </Marker>
            ))}

            {layers.evictions && stats.evictions.map((e, i) => (
              <Marker key={`ev-${i}`} position={[e.lat, e.lng]} icon={evictionIcon(24)}>
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                    <strong>Eviction Notice</strong>
                    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr><td style={{ color: "#999", paddingRight: 10 }}>Address</td><td>{e.address}</td></tr>
                        <tr><td style={{ color: "#999", paddingRight: 10 }}>Date</td><td>{e.date}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <OverlayLayerPanel layers={layers} onChange={toggleLayer} />
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface CBDDashboardProps {
  onNavigate: (subPath: string) => void;
}

export function CBDDashboard({ onNavigate }: CBDDashboardProps) {
  const { config } = useCBD();
  const { language } = useLanguage();
  const accent = config?.accent_color ?? "#E8652D";

  const [stats, setStats] = useState<CBDStats>({ permits: [], threeOneOne: [], evictions: [] });
  const [statsLoading, setStatsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapHover, setMapHover] = useState(false);

  const boundaryEntry = useMemo(() => config ? buildBoundaryEntry(config) : null, [config]);
  const cbdBoundaries = useMemo(() => boundaryEntry ? [boundaryEntry] : [], [boundaryEntry]);

  // Fetch data: 311 via server-side spatial filter, permits/evictions via district
  useEffect(() => {
    if (!config?.boundary_geojson || !cbdBoundaries.length) return;
    setStatsLoading(true);

    const district = config.supervisor_district ? String(config.supervisor_district) : null;

    const permitWhere = district
      ? `supervisor_district='${district}' AND location IS NOT NULL`
      : `location IS NOT NULL`;
    const evictionWhere = district
      ? `supervisor_district='${district}' AND file_date>'2023-01-01'`
      : `file_date>'2023-01-01'`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    Promise.all([
      fetch(`${DATASF}/i98e-djp9.json?${new URLSearchParams({
        $where: permitWhere,
        $select: "location,permit_type_definition,estimated_cost,street_number,street_name,street_suffix,status",
        $limit: "2000",
      })}`, { signal: controller.signal }).then(r => r.json()).catch(() => []),

      // 311: server-side lat/lng bounding box filter — no client-side polygon
      fetch311ForCBD(config, { days: 90, limit: 2000, signal: controller.signal }),

      fetch(`${DATASF}/5cei-gny5.json?${new URLSearchParams({
        $where: evictionWhere,
        $select: "shape,address,file_date",
        $limit: "500",
      })}`, { signal: controller.signal }).then(r => r.json()).catch(() => []),
    ]).then(([permitRows, threeOneOneRows, evictionRows]) => {
      clearTimeout(timeout);

      const permits: PermitPoint[] = (permitRows as any[])
        .filter((r: any) => r.location?.coordinates)
        .map((r: any) => ({
          lat: r.location.coordinates[1], lng: r.location.coordinates[0],
          type: r.permit_type_definition ?? "", cost: parseFloat(r.estimated_cost) || 0,
          address: [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" "),
          status: r.status,
        }))
        .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

      // 311 already filtered server-side by bounding box — map to local type
      const threeOneOne: ThreeOneOnePoint[] = threeOneOneRows.map(r => ({
        lat: r.lat, lng: r.lng,
        category: r.category, address: r.address,
        date: r.date, status: r.status,
      }));

      const evictions: EvictionPoint[] = (evictionRows as any[])
        .filter((r: any) => r.shape?.coordinates)
        .map((r: any) => ({
          lat: r.shape.coordinates[1], lng: r.shape.coordinates[0],
          address: r.address ?? "", date: (r.file_date ?? "").split("T")[0],
        }))
        .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

      console.log(`[CBDDashboard] ${config.name}: ${permits.length} permits, ${threeOneOne.length} 311, ${evictions.length} evictions`);
      setStats({ permits, threeOneOne, evictions });
      setStatsLoading(false);
    }).catch(err => {
      clearTimeout(timeout);
      console.warn("[CBDDashboard] fetch failed:", err);
      setStatsLoading(false);
    });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [config, cbdBoundaries]);

  // Generate AI summary once stats are loaded (regenerates on language change)
  useEffect(() => {
    setAiSummary("");
  }, [language]);

  useEffect(() => {
    if (statsLoading || !config || aiSummary) return;
    const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setAiSummary("*AI summary unavailable — API key not configured.*"); return; }

    setAiLoading(true);
    const catCounts: Record<string, number> = {};
    for (const r of stats.threeOneOne) catCounts[r.category] = (catCounts[r.category] ?? 0) + 1;
    const topCats = Object.entries(catCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([cat, count]) => `${cat}: ${count}`).join(", ");

    const prompt = `You are an operations analyst for the ${config.name} Community Benefit District in San Francisco. Write a concise 3-paragraph operational briefing for the executive director and board members.

DATA (last 90 days within CBD boundary):
- Active building permits: ${stats.permits.length}
- 311 service requests: ${stats.threeOneOne.length}
- Top 311 categories: ${topCats || "none"}
- Eviction notices: ${stats.evictions.length}

Focus on: permit activity within the district, 311 service request trends, and any notable developments. Be data-driven and actionable. Keep it under 200 words.${getLanguageInstruction(language)}`;

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }).then(res => {
      const text = res.content[0]?.type === "text" ? res.content[0].text : "";
      setAiSummary(text);
    }).catch(err => {
      console.warn("[CBDDashboard] AI summary failed:", err);
      setAiSummary("*Unable to generate AI summary at this time.*");
    }).finally(() => setAiLoading(false));
  }, [statsLoading, config, stats, aiSummary, language]);

  if (!config) return null;

  const mapCenter: [number, number] = [config.center_lat ?? 37.79, config.center_lng ?? -122.40];
  const geoJSON: GeoJSON.FeatureCollection | null = config.boundary_geojson
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: config.boundary_geojson as GeoJSON.MultiPolygon, properties: {} }] }
    : null;
  const mapBounds = config.boundary_geojson ? boundsFromMultiPolygon(config.boundary_geojson.coordinates) : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* ── Hero with subtle gradient ─────────────────────────────── */}
      <div style={{
        padding: "32px 24px 24px",
        margin: "0 -16px",
        background: `linear-gradient(180deg, ${accent}0D 0%, transparent 100%)`,
      }}>
        <h1 style={{
          fontFamily: FONTS.heading, fontSize: 32, fontWeight: 700,
          color: COLORS.charcoal, margin: 0, lineHeight: 1.2,
        }}>
          {config.name}
        </h1>
        {config.description && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, color: COLORS.midGray,
            marginTop: 10, lineHeight: 1.6, maxWidth: 640,
          }}>
            {config.description}
          </p>
        )}
        <div style={{
          display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap",
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
        }}>
          {config.executive_director && (
            <span>Executive Director: <strong style={{ color: COLORS.charcoal }}>{config.executive_director}</strong></span>
          )}
          <span>Updated: <strong style={{ color: COLORS.charcoal }}>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>
        </div>
      </div>

      {/* ── Loading experience ────────────────────────────────────── */}
      <CBDLoadingExperience
        config={config}
        loading={statsLoading}
        itemCount={stats.threeOneOne.length}
        variant="dashboard"
      />

      {/* ── Stat cards with colored left borders ──────────────────── */}
      {!statsLoading && (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, animation: "cp-page-in 0.3s ease-out" }}>
        <StatCard label="Active Permits" value={stats.permits.length} color={STAT_COLORS.permits} loading={false} />
        <StatCard label="311 Requests (90d)" value={stats.threeOneOne.length} color={STAT_COLORS.threeOneOne} loading={false} />
        <StatCard label="Eviction Notices" value={stats.evictions.length} color={STAT_COLORS.evictions} loading={false} />
        <StatCard label="Businesses" value="\u2014" color={STAT_COLORS.businesses} loading={false} />
      </div>
      )}

      {/* ── AI Summary ──────────────────────────────────────────────── */}
      <div style={{
        background: COLORS.white, borderRadius: 12,
        border: `1px solid ${COLORS.lightBorder}`,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <h2 style={{
          fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
          color: accent, margin: "0 0 12px",
        }}>
          Operational Briefing
        </h2>
        {aiLoading ? (
          <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="sk" style={{ width: 16, height: 16, borderRadius: "50%" }} />
              Generating AI briefing...
            </div>
            <div className="sk" style={{ height: 14, width: "100%", marginTop: 12, borderRadius: 4 }} />
            <div className="sk" style={{ height: 14, width: "90%", marginTop: 8, borderRadius: 4 }} />
            <div className="sk" style={{ height: 14, width: "80%", marginTop: 8, borderRadius: 4 }} />
          </div>
        ) : aiSummary ? (
          <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 1.7 }}>
            {renderMarkdownBlock(aiSummary)}
          </div>
        ) : null}
      </div>

      {/* ── Map preview (16:9, clickable) ─────────────────────────── */}
      <div
        style={{
          position: "relative",
          background: COLORS.white, borderRadius: 12,
          border: `1px solid ${COLORS.lightBorder}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          overflow: "hidden", marginBottom: 24,
          aspectRatio: "16 / 9",
          cursor: "pointer",
        }}
        onClick={() => setMapExpanded(true)}
        onMouseEnter={() => setMapHover(true)}
        onMouseLeave={() => setMapHover(false)}
      >
        {/* Expand button */}
        <button
          onClick={e => { e.stopPropagation(); setMapExpanded(true); }}
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 500,
            background: "rgba(255,255,255,0.92)", border: `1px solid ${COLORS.lightBorder}`,
            borderRadius: 8, padding: "5px 10px", cursor: "pointer",
            fontFamily: FONTS.body, fontSize: 12, fontWeight: 600, color: COLORS.charcoal,
            display: "flex", alignItems: "center", gap: 5,
            boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
          }}
        >
          <span style={{ fontSize: 14 }}>{"\u26F6"}</span> Expand
        </button>

        {/* "Click to explore" overlay on hover */}
        {mapHover && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            transition: "opacity 0.15s",
          }}>
            <span style={{
              fontFamily: FONTS.body, fontSize: 14, fontWeight: 600,
              color: COLORS.white, background: "rgba(0,0,0,0.55)",
              padding: "8px 20px", borderRadius: 24,
            }}>
              Click to explore
            </span>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={config.default_zoom}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          zoomControl={false}
          attributionControl={false}
          ref={map => { if (map && mapBounds) map.fitBounds(mapBounds.pad(0.1)); }}
        >
          <TileLayer
            url={MAPBOX_TILE((import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "")}
            maxZoom={19} tileSize={512} zoomOffset={-1}
          />

          {geoJSON && (
            <GeoJSON data={geoJSON} style={() => ({
              color: accent, weight: 2, dashArray: "6 4",
              fillColor: accent, fillOpacity: 0.04,
            })} />
          )}

          {/* Preview markers — smaller icons (16px) */}
          {stats.permits.slice(0, 150).map((p, i) => (
            <Marker key={`pp-${i}`} position={[p.lat, p.lng]} icon={permitIcon(p.type, 16)} />
          ))}
          {stats.threeOneOne.slice(0, 200).map((r, i) => (
            <Marker key={`3p-${i}`} position={[r.lat, r.lng]} icon={threeOneOneIcon(r.category, 16)} />
          ))}
        </MapContainer>
      </div>

      {/* ── Expanded map overlay ──────────────────────────────────── */}
      {mapExpanded && config && (
        <ExpandedMapOverlay
          stats={stats}
          config={config}
          onClose={() => setMapExpanded(false)}
        />
      )}

      {/* ── Quick links ─────────────────────────────────────────────── */}
      <h2 style={{
        fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
        color: COLORS.charcoal, margin: "0 0 12px",
      }}>
        Explore
      </h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <QuickLink label="Clean & Safe" description="Operations dashboard" accent={accent} onClick={() => onNavigate("clean-safe")} />
        <QuickLink label="Permits" description="Building permit activity" accent={accent} onClick={() => onNavigate("permits")} />
        <QuickLink label="311 Requests" description="Service request trends" accent={accent} onClick={() => onNavigate("311")} />
        <QuickLink label="Business" description="Business activity" accent={accent} onClick={() => onNavigate("business")} />
        <QuickLink label="Board Packet" description="Monthly board materials" accent={accent} onClick={() => onNavigate("board-packet")} />
        <QuickLink label="Map" description="Interactive district map" accent={accent} onClick={() => onNavigate("map")} />
      </div>
    </div>
  );
}
