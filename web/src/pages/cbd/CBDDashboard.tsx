/**
 * CBDDashboard.tsx — Landing page for a CBD portal.
 *
 * Shows hero, stat cards (permits/311/evictions filtered to CBD boundary),
 * AI operational briefing, mini map preview, and quick-link cards.
 */

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useCBD, type CBDConfig } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { isPointInCBD, type CBDBoundaryEntry } from "../../utils/geoFilter";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import Anthropic from "@anthropic-ai/sdk";

const DATASF = "https://data.sfgov.org/resource";

// ── Types ──────────────────────────────────────────────────────────────────

interface PermitPoint { lat: number; lng: number; type: string; cost: number; address: string }
interface ThreeOneOnePoint { lat: number; lng: number; category: string; address: string; date: string }
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

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, loading }: {
  label: string; value: string | number; accent: string; loading: boolean;
}) {
  return (
    <div style={{
      flex: "1 1 140px",
      background: COLORS.white,
      borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      padding: "20px 16px",
      textAlign: "center",
      minWidth: 120,
    }}>
      <div style={{
        fontFamily: FONTS.display, fontSize: 32, fontWeight: 700,
        color: loading ? COLORS.warmGray : accent,
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
      transition: "border-color 0.15s",
      minWidth: 140,
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = COLORS.lightBorder)}
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

// ── Main component ─────────────────────────────────────────────────────────

interface CBDDashboardProps {
  onNavigate: (subPath: string) => void;
}

export function CBDDashboard({ onNavigate }: CBDDashboardProps) {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";

  const [stats, setStats] = useState<CBDStats>({ permits: [], threeOneOne: [], evictions: [] });
  const [statsLoading, setStatsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const boundaryEntry = useMemo(() => config ? buildBoundaryEntry(config) : null, [config]);
  const cbdBoundaries = useMemo(() => boundaryEntry ? [boundaryEntry] : [], [boundaryEntry]);

  // Fetch raw DataSF data and filter to CBD boundary
  useEffect(() => {
    if (!config?.boundary_geojson || !cbdBoundaries.length) return;
    setStatsLoading(true);

    const district = config.supervisor_district ? String(config.supervisor_district) : null;
    const cutoff90 = new Date();
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffStr = cutoff90.toISOString().split("T")[0];

    const permitWhere = district
      ? `supervisor_district='${district}' AND location IS NOT NULL`
      : `location IS NOT NULL`;

    const threeOneOneWhere = district
      ? `supervisor_district='${district}' AND requested_datetime >= '${cutoffStr}T00:00:00.000' AND lat IS NOT NULL`
      : `requested_datetime >= '${cutoffStr}T00:00:00.000' AND lat IS NOT NULL`;

    const evictionWhere = district
      ? `supervisor_district='${district}' AND file_date>'2023-01-01'`
      : `file_date>'2023-01-01'`;

    Promise.all([
      fetch(`${DATASF}/i98e-djp9.json?${new URLSearchParams({
        $where: permitWhere, $select: "location,permit_type_definition,estimated_cost,street_number,street_name,street_suffix", $limit: "2000",
      })}`).then(r => r.json()).catch(() => []),

      fetch(`${DATASF}/vw6y-z8j6.json?${new URLSearchParams({
        $where: threeOneOneWhere, $select: "lat,long,service_name,address,requested_datetime", $limit: "2000",
      })}`).then(r => r.json()).catch(() => []),

      fetch(`${DATASF}/5cei-gny5.json?${new URLSearchParams({
        $where: evictionWhere, $select: "shape,address,file_date", $limit: "500",
      })}`).then(r => r.json()).catch(() => []),
    ]).then(([permitRows, threeOneOneRows, evictionRows]) => {
      const permits: PermitPoint[] = (permitRows as any[])
        .filter((r: any) => r.location?.coordinates)
        .map((r: any) => ({
          lat: r.location.coordinates[1],
          lng: r.location.coordinates[0],
          type: r.permit_type_definition ?? "",
          cost: parseFloat(r.estimated_cost) || 0,
          address: [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" "),
        }))
        .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

      const threeOneOne: ThreeOneOnePoint[] = (threeOneOneRows as any[])
        .filter((r: any) => r.lat && r.long)
        .map((r: any) => ({
          lat: parseFloat(r.lat), lng: parseFloat(r.long),
          category: r.service_name ?? "", address: r.address ?? "",
          date: (r.requested_datetime ?? "").split("T")[0],
        }))
        .filter(p => !isNaN(p.lat) && isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

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
    });
  }, [config, cbdBoundaries]);

  // Generate AI summary once stats are loaded
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

Focus on: permit activity within the district, 311 service request trends, and any notable developments. Be data-driven and actionable. Keep it under 200 words.`;

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
  }, [statsLoading, config, stats, aiSummary]);

  if (!config) return null;

  const mapCenter: [number, number] = [config.center_lat ?? 37.79, config.center_lng ?? -122.40];
  const geoJSON: GeoJSON.FeatureCollection | null = config.boundary_geojson
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: config.boundary_geojson as GeoJSON.MultiPolygon, properties: {} }] }
    : null;
  const mapBounds = config.boundary_geojson ? boundsFromMultiPolygon(config.boundary_geojson.coordinates) : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div style={{ padding: "32px 0 24px" }}>
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

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Active Permits" value={stats.permits.length} accent={accent} loading={statsLoading} />
        <StatCard label="311 Requests (90d)" value={stats.threeOneOne.length} accent={accent} loading={statsLoading} />
        <StatCard label="Eviction Notices" value={stats.evictions.length} accent={accent} loading={statsLoading} />
        <StatCard label="Businesses" value="—" accent={accent} loading={false} />
      </div>

      {/* ── AI Summary ──────────────────────────────────────────────── */}
      <div style={{
        background: COLORS.white, borderRadius: 12,
        border: `1px solid ${COLORS.lightBorder}`,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <h2 style={{
          fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
          color: COLORS.charcoal, margin: "0 0 12px",
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

      {/* ── Map preview ─────────────────────────────────────────────── */}
      <div style={{
        background: COLORS.white, borderRadius: 12,
        border: `1px solid ${COLORS.lightBorder}`,
        overflow: "hidden", marginBottom: 24,
        height: 320,
      }}>
        <MapContainer
          center={mapCenter}
          zoom={config.default_zoom}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
          ref={map => { if (map && mapBounds) map.fitBounds(mapBounds.pad(0.1)); }}
        >
          <TileLayer
            url={`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${(import.meta as any).env?.VITE_MAPBOX_TOKEN ?? ""}`}
            maxZoom={19} tileSize={512} zoomOffset={-1}
          />

          {geoJSON && (
            <GeoJSON
              data={geoJSON}
              style={() => ({
                color: accent, weight: 2, dashArray: "6 4",
                fillColor: accent, fillOpacity: 0.04,
              })}
            />
          )}

          {/* Permit markers */}
          {stats.permits.slice(0, 200).map((p, i) => (
            <CircleMarker key={`p-${i}`} center={[p.lat, p.lng]} radius={4}
              pathOptions={{ color: "#fff", weight: 1, fillColor: "#4A7FD0", fillOpacity: 0.8 }}
            >
              <Popup><div style={{ fontFamily: FONTS.body, fontSize: 12 }}><strong>{p.address}</strong><br />{p.type}</div></Popup>
            </CircleMarker>
          ))}

          {/* 311 markers */}
          {stats.threeOneOne.slice(0, 300).map((r, i) => (
            <CircleMarker key={`311-${i}`} center={[r.lat, r.lng]} radius={3}
              pathOptions={{ color: "#fff", weight: 1, fillColor: "#7C3AED", fillOpacity: 0.7 }}
            >
              <Popup><div style={{ fontFamily: FONTS.body, fontSize: 12 }}><strong>{r.category}</strong><br />{r.address}</div></Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

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
