/**
 * CBDPermits.tsx — Permit activity within a CBD boundary.
 *
 * Sections:
 *  1. Summary bar (4 metric cards)
 *  2. Map + Recent permits list (60/40)
 *  3. Notable projects (AI summary)
 *  4. Type breakdown (horizontal bar chart)
 */

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

import { useCBD } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { fetchPermitsForCBD, type CBDPermitRow } from "../../utils/cbdFetch";
import { CBDLoadingExperience } from "../../components/CBDLoadingExperience";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import Anthropic from "@anthropic-ai/sdk";
import { useLanguage, getLanguageInstruction } from "../../contexts/LanguageContext";

const MAPBOX_TILE = (token: string) =>
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${token}`;

// ── Permit type colors ──────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  "otc alterations permit": "#3B82F6",
  "alterations permit": "#6366F1",
  "new construction": "#10B981",
  "demolitions": "#EF4444",
  "sign - erect": "#F59E0B",
  "additions alterations or repairs": "#8B5CF6",
};

function typeColor(type: string): string {
  const t = type.toLowerCase();
  for (const [key, color] of Object.entries(TYPE_COLORS)) {
    if (t.includes(key)) return color;
  }
  return "#6B7280";
}

function typeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("new construction")) return "New Construction";
  if (t.includes("demolition")) return "Demolition";
  if (t.includes("otc alteration")) return "OTC Alteration";
  if (t.includes("alteration")) return "Alteration";
  if (t.includes("sign")) return "Sign";
  return type.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Map helpers ─────────────────────────────────────────────────────────

function boundsFromMultiPolygon(coords: number[][][][]): L.LatLngBounds | null {
  const pts: L.LatLng[] = [];
  for (const poly of coords)
    for (const ring of poly)
      for (const [lng, lat] of ring)
        pts.push(L.latLng(lat, lng));
  return pts.length ? L.latLngBounds(pts) : null;
}

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

function permitIcon(type: string, cost: number): L.DivIcon {
  const color = typeColor(type);
  const size = cost > 1_000_000 ? 28 : cost > 100_000 ? 22 : 16;
  const half = size / 2;
  const label = type.toLowerCase().includes("new construction") ? "N"
    : type.toLowerCase().includes("demolition") ? "D"
    : type.toLowerCase().includes("sign") ? "S" : "A";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.42)}px;line-height:1;
      color:#fff;font-weight:700;
      box-shadow:0 1px 4px rgba(0,0,0,0.2);
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

// ── Format helpers ──────────────────────────────────────────────────────

function fmtCost(cost: number): string {
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(0)}K`;
  return cost > 0 ? `$${cost.toFixed(0)}` : "\u2014";
}

// ── Main component ──────────────────────────────────────────────────────

export function CBDPermits() {
  const { config } = useCBD();
  const { language } = useLanguage();
  const accent = config?.accent_color ?? "#E8652D";

  const [permits, setPermits] = useState<CBDPermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ── Fetch permits ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.boundary_geojson) return;
    setLoading(true);
    setFetchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetchPermitsForCBD(config, { days: 365, limit: 2000, signal: controller.signal })
      .then(rows => {
        clearTimeout(timeout);
        setPermits(rows);
        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeout);
        setFetchError(err?.name === "AbortError"
          ? "Unable to load permit data \u2014 request timed out."
          : "Unable to load permit data. Try refreshing.");
        setLoading(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [config]);

  // Regenerate AI on language change
  useEffect(() => { setAiSummary(""); }, [language]);

  // ── AI notable projects ───────────────────────────────────────────────
  useEffect(() => {
    if (loading || !config || permits.length === 0 || aiSummary) return;
    const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setAiSummary("*AI analysis unavailable.*"); return; }

    setAiLoading(true);
    const top = permits
      .filter(p => p.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const topList = top.map(p =>
      `${p.address}: ${p.type}, $${(p.cost / 1000).toFixed(0)}K, status: ${p.status}, filed: ${p.filedDate}`
    ).join("\n");

    const typeCounts: Record<string, number> = {};
    for (const p of permits) {
      const l = typeLabel(p.type);
      typeCounts[l] = (typeCounts[l] ?? 0) + 1;
    }
    const typeBreakdown = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([t, n]) => `${t}: ${n}`).join(", ");

    const prompt = `You are a development analyst for the ${config.name} Community Benefit District in San Francisco. Summarize the 3-5 most notable permit filings by cost and significance. Be specific with addresses and dollar amounts. Write 2-3 concise paragraphs.

DATA (last 12 months within ${config.name}):
- Total permits: ${permits.length}
- Type breakdown: ${typeBreakdown}
- Top permits by cost:
${topList}

Focus on what these permits mean for the district: new construction, major renovations, potential disruption. End with a brief outlook.${getLanguageInstruction(language)}`;

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }).then(res => {
      setAiSummary(res.content[0]?.type === "text" ? res.content[0].text : "");
    }).catch(() => {
      setAiSummary("*Unable to generate analysis.*");
    }).finally(() => setAiLoading(false));
  }, [loading, config, permits, aiSummary, language]);

  // ── Derived data ──────────────────────────────────────────────────────

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().split("T")[0];

  const newThisMonth = useMemo(
    () => permits.filter(p => p.filedDate >= thirtyDaysStr).length,
    [permits, thirtyDaysStr],
  );

  const totalValue = useMemo(
    () => permits.reduce((s, p) => s + p.cost, 0),
    [permits],
  );

  const topType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of permits) {
      const l = typeLabel(p.type);
      counts[l] = (counts[l] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
    return sorted[0]?.[0] ?? "\u2014";
  }, [permits]);

  const typeBreakdownData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of permits) {
      const l = typeLabel(p.type);
      counts[l] = (counts[l] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, color: typeColor(name) }));
  }, [permits]);

  if (!config) return null;

  const mapCenter: [number, number] = [config.center_lat ?? 37.79, config.center_lng ?? -122.40];
  const geoJSON: GeoJSON.FeatureCollection | null = config.boundary_geojson
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: config.boundary_geojson as GeoJSON.MultiPolygon, properties: {} }] }
    : null;
  const mapBounds = config.boundary_geojson ? boundsFromMultiPolygon(config.boundary_geojson.coordinates) : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* Header */}
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700, color: COLORS.charcoal, margin: 0 }}>
          Permits
        </h1>
        <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6 }}>
          Building permit activity within {config.name} — last 12 months
        </p>
      </div>

      <CBDLoadingExperience config={config} loading={loading} itemCount={permits.length} variant="dashboard" />

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
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
            {[
              { label: "Active Permits", value: String(permits.length), color: "#8B5CF6" },
              { label: "New This Month", value: String(newThisMonth), color: "#3B82F6" },
              { label: "Total Est. Value", value: fmtCost(totalValue), color: "#10B981" },
              { label: "Top Type", value: topType, color: "#F59E0B" },
            ].map(s => (
              <div key={s.label} style={{
                flex: "1 1 140px", minWidth: 120,
                background: COLORS.white, borderRadius: 12,
                border: "1px solid #e5e7eb", borderLeft: `4px solid ${s.color}`,
                padding: "14px 12px", textAlign: "center",
              }}>
                <div style={{
                  fontFamily: FONTS.display, fontSize: 22, fontWeight: 700,
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

          {/* Map + List */}
          <style>{`
            @media (max-width: 1024px) {
              .cbd-permit-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div className="cbd-permit-grid" style={{
            display: "grid", gridTemplateColumns: "60fr 40fr",
            gap: 24, marginBottom: 40,
          }}>
            {/* Map */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: "1px solid #e5e7eb", padding: 16,
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: "#1a1a2e", margin: "0 0 12px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                Permit Map
              </h2>
              <div style={{ borderRadius: 10, overflow: "hidden", height: 400, border: `1px solid ${COLORS.lightBorder}` }}>
                <MapContainer center={mapCenter} zoom={config.default_zoom} style={{ width: "100%", height: "100%" }} zoomControl attributionControl={false}>
                  <TileLayer url={MAPBOX_TILE((import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "")} maxZoom={19} tileSize={512} zoomOffset={-1} />
                  <FitBounds bounds={mapBounds} />
                  <MapFlyTo target={flyTo} />
                  {geoJSON && (
                    <GeoJSON data={geoJSON} style={() => ({
                      color: accent, weight: 2, dashArray: "6 4",
                      fillColor: accent, fillOpacity: 0.04,
                    })} />
                  )}
                  {permits.slice(0, 500).map((p, i) => (
                    <Marker key={i} position={[p.lat, p.lng]} icon={permitIcon(p.type, p.cost)}>
                      <Popup>
                        <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                          <strong>{p.address}</strong>
                          <div style={{ fontSize: 12, color: COLORS.midGray, marginTop: 4 }}>{typeLabel(p.type)}</div>
                          <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                            <tbody>
                              <tr><td style={{ color: "#999", paddingRight: 10 }}>Cost</td><td>{fmtCost(p.cost)}</td></tr>
                              <tr><td style={{ color: "#999", paddingRight: 10 }}>Status</td><td>{p.status}</td></tr>
                              <tr><td style={{ color: "#999", paddingRight: 10 }}>Filed</td><td>{p.filedDate}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Recent Permits List */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: "1px solid #e5e7eb", padding: 16,
              display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: "#1a1a2e", margin: "0 0 12px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                Recent Permits
              </h2>
              <div style={{ flex: 1, maxHeight: 380, overflowY: "auto" }}>
                {permits.slice(0, 50).map((p, i) => (
                  <div key={i}
                    onClick={() => setFlyTo([p.lat, p.lng])}
                    style={{
                      padding: "10px 12px", cursor: "pointer",
                      borderBottom: `1px solid ${COLORS.lightBorder}`,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#FAFAFA"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
                      {p.address}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, marginTop: 4,
                      fontFamily: FONTS.body, fontSize: 11,
                    }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "1px 8px", borderRadius: 10,
                        background: typeColor(p.type) + "18",
                        color: typeColor(p.type), fontWeight: 600, fontSize: 10,
                      }}>
                        {typeLabel(p.type)}
                      </span>
                      <span style={{ color: COLORS.midGray }}>{fmtCost(p.cost)}</span>
                      <span style={{ color: COLORS.warmGray, marginLeft: "auto" }}>{p.filedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notable Projects — AI */}
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
              Notable Projects
            </h2>
            {aiLoading ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="sk" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  Analyzing permit filings...
                </div>
                <div className="sk" style={{ height: 14, width: "100%", marginTop: 12, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "85%", marginTop: 8, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "70%", marginTop: 8, borderRadius: 4 }} />
              </div>
            ) : aiSummary ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 1.7 }}>
                {renderMarkdownBlock(aiSummary)}
              </div>
            ) : null}
          </div>

          {/* Type Breakdown */}
          {typeBreakdownData.length > 0 && (
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 40,
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: "#1a1a2e", margin: "0 0 16px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                Type Breakdown
              </h2>
              <div style={{ height: Math.max(200, typeBreakdownData.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeBreakdownData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fontFamily: FONTS.body }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontFamily: FONTS.body }} width={130} />
                    <Tooltip
                      contentStyle={{
                        fontFamily: FONTS.body, fontSize: 12, borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                      formatter={(value: any) => [value, "Permits"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                      {typeBreakdownData.map((d, i) => (
                        <Cell key={i} fill={d.color} fillOpacity={0.75} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
