/**
 * CBDMap.tsx — Full-page map exploration for a CBD.
 *
 * Fills the viewport with a Leaflet map and a collapsible sidebar
 * for layer toggles, filters, and feature detail cards.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useCBD } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { fetch311ForCBD, fetchPermitsForCBD, type CBD311Row, type CBDPermitRow } from "../../utils/cbdFetch";
import { fetchBusinessRegistrations, type DowntownBusiness } from "../../services/businessRegistrations";
import { fetchTransitStops, computeTransitScore, type TransitStop } from "../../services/transitAccess";

const MAPBOX_TILE = (token: string) =>
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${token}`;

// ── Layer definitions ───────────────────────────────────────────────────

type LayerKey = "permits" | "311" | "businesses" | "transit" | "boundary";

interface LayerDef {
  key: LayerKey;
  label: string;
  color: string;
  defaultOn: boolean;
}

const LAYERS: LayerDef[] = [
  { key: "permits",    label: "Building Permits", color: "#3B82F6", defaultOn: true },
  { key: "311",        label: "311 Requests",      color: "#8B5CF6", defaultOn: false },
  { key: "businesses", label: "Businesses",        color: "#10B981", defaultOn: false },
  { key: "transit",    label: "Transit Stops",     color: "#0EA5E9", defaultOn: false },
  { key: "boundary",   label: "CBD Boundary",      color: "#E8652D", defaultOn: true },
];

// ── Business category colors ────────────────────────────────────────────

const BIZ_CAT_COLORS: Record<string, string> = {
  "Food & Beverage":       "#F97316",
  "Retail":                "#8B5CF6",
  "Professional Services": "#3B82F6",
  "Arts & Entertainment":  "#EC4899",
  "Real Estate":           "#F59E0B",
  "Health & Wellness":     "#10B981",
  "Other":                 "#9CA3AF",
};

function mapBizCategory(naics: string): string {
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
  return "Other";
}

type DateRange = 30 | 90 | 180;

// ── Categories ──────────────────────────────────────────────────────────

const CAT_311: Record<string, string> = {
  Graffiti:          "#7C3AED",
  "Street Cleaning": "#92400E",
  Encampments:       "#DC2626",
  "Blocked Sidewalk":"#EA580C",
  Other:             "#6B7280",
};

function normalize311(serviceName: string): string {
  const s = (serviceName ?? "").toLowerCase();
  if (s.includes("graffiti")) return "Graffiti";
  if ((s.includes("street") || s.includes("sidewalk")) && s.includes("clean")) return "Street Cleaning";
  if (s.includes("encampment")) return "Encampments";
  if (s.includes("sidewalk") || s.includes("block")) return "Blocked Sidewalk";
  return "Other";
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

function circleIcon(label: string, color: string, size = 20): L.DivIcon {
  const h = size / 2;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.45)}px;line-height:1;
      color:#fff;font-weight:700;
      box-shadow:0 1px 3px rgba(0,0,0,0.2);
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [h, h],
  });
}

function permit311Icon(category: string): L.DivIcon {
  const cat = normalize311(category);
  const color = CAT_311[cat] ?? "#6B7280";
  const label = cat === "Graffiti" ? "G" : cat === "Street Cleaning" ? "C"
    : cat === "Encampments" ? "E" : cat === "Blocked Sidewalk" ? "\u26A0" : "?";
  return circleIcon(label, color, 18);
}

// ── Transit SVG icons ────────────────────────────────────────────────────

const MUNI_BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="14" rx="3"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="3" x2="12" y2="10"/><circle cx="7" cy="20" r="1.5" fill="#1a1a2e"/><circle cx="17" cy="20" r="1.5" fill="#1a1a2e"/><line x1="7" y1="17" x2="7" y2="18.5"/><line x1="17" y1="17" x2="17" y2="18.5"/></svg>`;

function muniIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:24px;height:24px;
      background:#fff;border-radius:5px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 1px 3px rgba(0,0,0,0.15);
    ">${MUNI_BUS_SVG}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function bartIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:#009AC7;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 1px 3px rgba(0,0,0,0.15);
      color:#fff;font-size:8px;font-weight:800;
      font-family:system-ui,sans-serif;letter-spacing:0.02em;
      line-height:1;
    ">BART</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function transitIcon(system: 'Muni' | 'BART'): L.DivIcon {
  return system === 'BART' ? bartIcon() : muniIcon();
}

function permitIcon(type: string, cost: number): L.DivIcon {
  const t = type.toLowerCase();
  const color = t.includes("new construction") ? "#10B981"
    : t.includes("demolition") ? "#EF4444"
    : t.includes("sign") ? "#F59E0B" : "#3B82F6";
  const label = t.includes("new construction") ? "N"
    : t.includes("demolition") ? "D"
    : t.includes("sign") ? "S" : "A";
  const size = cost > 1_000_000 ? 24 : cost > 100_000 ? 20 : 16;
  return circleIcon(label, color, size);
}

function fmtCost(cost: number): string {
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(0)}K`;
  return cost > 0 ? `$${cost.toFixed(0)}` : "\u2014";
}

function fmtCostFull(cost: number): string {
  if (!cost || cost <= 0) return "";
  return cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

// ── Selected feature types ──────────────────────────────────────────────

type SelectedFeature =
  | { type: "311"; data: CBD311Row }
  | { type: "permit"; data: CBDPermitRow };

// ── Main component ──────────────────────────────────────────────────────

export function CBDMap() {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layersOn, setLayersOn] = useState<Record<LayerKey, boolean>>(
    Object.fromEntries(LAYERS.map(l => [l.key, l.defaultOn])) as Record<LayerKey, boolean>,
  );
  const [dateRange, setDateRange] = useState<DateRange>(90);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  const [rows311, setRows311] = useState<CBD311Row[]>([]);
  const [permits, setPermits] = useState<CBDPermitRow[]>([]);
  const [businesses, setBusinesses] = useState<DowntownBusiness[]>([]);
  const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.boundary_geojson) return;
    setLoading(true);

    const controller = new AbortController();
    Promise.all([
      fetch311ForCBD(config, { days: dateRange, limit: 3000, signal: controller.signal }),
      fetchPermitsForCBD(config, { days: dateRange, limit: 2000, signal: controller.signal }),
      fetchBusinessRegistrations(config, { signal: controller.signal }).catch(() => [] as DowntownBusiness[]),
      fetchTransitStops(config, { signal: controller.signal }).catch(() => [] as TransitStop[]),
    ]).then(([r311, rPermit, rBiz, rTransit]) => {
      setRows311(r311);
      setPermits(rPermit);
      setBusinesses(rBiz.filter(b => b.status === "active" && b.coordinates));
      setTransitStops(rTransit);
      setLoading(false);
    }).catch(err => {
      if (err?.name !== "AbortError") console.error("[CBDMap] fetch error:", err);
      setLoading(false);
    });

    return () => controller.abort();
  }, [config, dateRange]);

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayersOn(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const counts = useMemo(() => ({
    permits: permits.length,
    "311": rows311.length,
    businesses: businesses.length,
    transit: transitStops.length,
    boundary: 1,
  }), [permits, rows311, businesses, transitStops]);

  if (!config) return null;

  const mapCenter: [number, number] = [config.center_lat ?? 37.79, config.center_lng ?? -122.40];
  const geoJSON: GeoJSON.FeatureCollection | null = config.boundary_geojson
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: config.boundary_geojson as GeoJSON.MultiPolygon, properties: {} }] }
    : null;
  const mapBounds = config.boundary_geojson ? boundsFromMultiPolygon(config.boundary_geojson.coordinates) : null;

  const sidebarW = 320;

  return (
    <>
      <style>{`
        .cbd-map-sidebar { transition: transform 0.25s ease; }
        .cbd-map-toggle {
          position: absolute; top: 50%; z-index: 1000;
          transform: translateY(-50%);
          width: 28px; height: 56px; border-radius: 0 8px 8px 0;
          background: #fff; border: 1px solid #e5e7eb; border-left: none;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 14px; color: ${COLORS.midGray};
          box-shadow: 2px 0 8px rgba(0,0,0,0.06);
        }
        .cbd-map-toggle:hover { background: #f9fafb; }
        .cbd-detail-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: 340px; max-width: 100%;
          background: #fff; border-left: 1px solid #e5e7eb;
          z-index: 500; box-shadow: -4px 0 16px rgba(0,0,0,0.08);
          transform: translateX(100%);
          transition: transform 0.25s ease;
          overflow-y: auto;
        }
        .cbd-detail-panel.open { transform: translateX(0); }
        @media (max-width: 768px) {
          .cbd-map-sidebar {
            position: fixed !important; bottom: 0 !important; left: 0 !important;
            right: 0 !important; top: auto !important;
            width: 100% !important; max-height: 45vh !important;
            border-radius: 16px 16px 0 0 !important;
            transform: translateY(0) !important;
          }
          .cbd-map-sidebar.closed {
            transform: translateY(calc(100% - 48px)) !important;
          }
          .cbd-map-toggle { display: none !important; }
          .cbd-map-area { width: 100% !important; }
          .cbd-detail-panel {
            position: fixed !important; bottom: 0 !important; left: 0 !important;
            right: 0 !important; top: auto !important;
            width: 100% !important; max-height: 55vh !important;
            border-radius: 16px 16px 0 0 !important;
            border-left: none !important;
            box-shadow: 0 -4px 16px rgba(0,0,0,0.12) !important;
            transform: translateY(100%) !important;
          }
          .cbd-detail-panel.open {
            transform: translateY(0) !important;
          }
        }
      `}</style>

      <div style={{
        display: "flex", height: "calc(100vh - 60px)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Sidebar */}
        <div
          className={`cbd-map-sidebar ${sidebarOpen ? "" : "closed"}`}
          style={{
            width: sidebarW, flexShrink: 0,
            background: "#fff", borderRight: "1px solid #e5e7eb",
            display: "flex", flexDirection: "column",
            transform: sidebarOpen ? "translateX(0)" : `translateX(-${sidebarW}px)`,
            position: "relative", zIndex: 10,
            overflowY: "auto",
          }}
        >
          {/* Toggle button */}
          <button
            className="cbd-map-toggle"
            onClick={() => setSidebarOpen(p => !p)}
            style={{ left: sidebarOpen ? sidebarW : 0 }}
          >
            {sidebarOpen ? "\u25C0" : "\u25B6"}
          </button>

          {/* Header */}
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          }}>
            <div style={{
              fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600, color: "#1a1a2e",
            }}>
              {config.name}
            </div>
            <div style={{
              fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 2,
            }}>
              {permits.length} permits &middot; {rows311.length} requests &middot; {transitStops.length} stops
            </div>
          </div>

          {/* Layer toggles (always visible) */}
            <div style={{ padding: "16px 20px", flex: 1 }}>
              {/* Layers */}
              <div style={{
                fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
              }}>
                Layers
              </div>
              {LAYERS.map(layer => (
                <label key={layer.key} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 0", cursor: "pointer",
                  borderBottom: `1px solid ${COLORS.lightBorder}`,
                  fontFamily: FONTS.body, fontSize: 13,
                }}>
                  <input
                    type="checkbox"
                    checked={layersOn[layer.key]}
                    onChange={() => toggleLayer(layer.key)}
                    style={{ accentColor: layer.color }}
                  />
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: layer.color, flexShrink: 0,
                  }} />
                  <span style={{ color: "#1a1a2e", flex: 1 }}>{layer.label}</span>
                  <span style={{
                    fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray,
                    background: COLORS.cream, padding: "1px 8px", borderRadius: 8,
                  }}>
                    {counts[layer.key]}
                  </span>
                </label>
              ))}

              {/* Date range */}
              <div style={{
                fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginTop: 20, marginBottom: 10,
              }}>
                Date Range
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {([30, 90, 180] as DateRange[]).map(d => (
                  <button key={d}
                    onClick={() => setDateRange(d)}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 8,
                      border: `1px solid ${dateRange === d ? accent : COLORS.lightBorder}`,
                      background: dateRange === d ? accent + "12" : "#fff",
                      color: dateRange === d ? accent : COLORS.midGray,
                      fontFamily: FONTS.body, fontSize: 12, fontWeight: dateRange === d ? 700 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  marginTop: 16, fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
                }}>
                  <div className="sk" style={{ width: 14, height: 14, borderRadius: "50%" }} />
                  Loading data...
                </div>
              )}

              {/* Legend */}
              <div style={{
                fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginTop: 24, marginBottom: 8,
              }}>
                311 Categories
              </div>
              {Object.entries(CAT_311).map(([cat, color]) => (
                <div key={cat} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray,
                  padding: "3px 0",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  {cat}
                </div>
              ))}

              <div style={{
                fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginTop: 16, marginBottom: 8,
              }}>
                Permits
              </div>
              {[
                ["New Construction", "#10B981"],
                ["Demolition", "#EF4444"],
                ["Alteration", "#3B82F6"],
                ["Sign", "#F59E0B"],
              ].map(([label, color]) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray,
                  padding: "3px 0",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  {label}
                </div>
              ))}

              {layersOn.businesses && (
                <>
                  <div style={{
                    fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    marginTop: 16, marginBottom: 8,
                  }}>
                    Business Categories
                  </div>
                  {Object.entries(BIZ_CAT_COLORS).map(([cat, color]) => (
                    <div key={cat} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray,
                      padding: "3px 0",
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      {cat}
                    </div>
                  ))}
                </>
              )}

              {layersOn.transit && (
                <>
                  <div style={{
                    fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    marginTop: 16, marginBottom: 8,
                  }}>
                    Transit
                  </div>
                  {[
                    ["Muni Stop", "#0EA5E9"],
                    ["BART Station", "#009AC7"],
                  ].map(([label, color]) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray,
                      padding: "3px 0",
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      {label}
                    </div>
                  ))}
                </>
              )}
            </div>
        </div>

        {/* Map area */}
        <div className="cbd-map-area" style={{
          flex: 1, position: "relative",
          marginLeft: sidebarOpen ? 0 : -sidebarW,
          transition: "margin-left 0.25s ease",
        }}>
          <MapContainer
            center={mapCenter} zoom={config.default_zoom}
            style={{ width: "100%", height: "100%" }}
            zoomControl attributionControl={false}
          >
            <TileLayer
              url={MAPBOX_TILE((import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "")}
              maxZoom={19} tileSize={512} zoomOffset={-1}
            />
            <FitBounds bounds={mapBounds} />
            <MapFlyTo target={flyTo} />

            {/* CBD boundary */}
            {layersOn.boundary && geoJSON && (
              <GeoJSON data={geoJSON} style={() => ({
                color: accent, weight: 2.5, dashArray: "6 4",
                fillColor: accent, fillOpacity: 0.04,
              })} />
            )}

            {/* 311 markers */}
            {layersOn["311"] && rows311.slice(0, 2000).map((r, i) => (
              <Marker key={`311-${i}`} position={[r.lat, r.lng]} icon={permit311Icon(r.category)}
                eventHandlers={{
                  click: () => {
                    setSelected({ type: "311", data: r });
                    if (!sidebarOpen) setSidebarOpen(true);
                  },
                }}
              >
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 12 }}>
                    <strong>{normalize311(r.category)}</strong><br />
                    {r.address}<br />
                    <span style={{ color: "#999" }}>{r.date}</span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Permit markers */}
            {layersOn.permits && permits.slice(0, 1000).map((p, i) => (
              <Marker key={`p-${i}`} position={[p.lat, p.lng]} icon={permitIcon(p.type, p.cost)}
                eventHandlers={{
                  click: () => {
                    setSelected({ type: "permit", data: p });
                    if (!sidebarOpen) setSidebarOpen(true);
                  },
                }}
              >
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 12 }}>
                    <strong>{p.address}</strong><br />
                    {p.type} &middot; {fmtCost(p.cost)}<br />
                    <span style={{ color: "#999" }}>{p.filedDate}</span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Business markers */}
            {layersOn.businesses && businesses.slice(0, 3000).map(b => {
              if (!b.coordinates) return null;
              const cat = mapBizCategory(b.category);
              const color = BIZ_CAT_COLORS[cat] ?? "#9CA3AF";
              return (
                <CircleMarker
                  key={b.id}
                  center={[b.coordinates.lat, b.coordinates.lng]}
                  radius={5}
                  pathOptions={{ color: "#fff", weight: 1.5, fillColor: color, fillOpacity: 0.85 }}
                >
                  <Popup>
                    <div style={{ fontFamily: FONTS.body, fontSize: 12, minWidth: 160 }}>
                      <strong>{b.name}</strong><br />
                      <span style={{
                        display: "inline-block", marginTop: 3, marginBottom: 3,
                        padding: "1px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                        background: color + "20", color,
                      }}>
                        {cat}
                      </span><br />
                      <span style={{ color: "#666" }}>{b.address}</span><br />
                      <span style={{ color: "#999", fontSize: 11 }}>Opened {b.openDate}</span>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Transit stop markers */}
            {layersOn.transit && transitStops.map(s => (
              <Marker
                key={s.stopId}
                position={[s.lat, s.lng]}
                icon={transitIcon(s.system)}
              >
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 12, minWidth: 160 }}>
                    <strong>{s.name}</strong><br />
                    <span style={{
                      display: "inline-block", marginTop: 3, marginBottom: 3,
                      padding: "1px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                      background: s.system === "BART" ? "#EAB30820" : "#0EA5E920",
                      color: s.system === "BART" ? "#EAB308" : "#0EA5E9",
                    }}>
                      {s.system}
                    </span><br />
                    {s.onStreet && s.atStreet && (
                      <span style={{ color: "#666" }}>{s.onStreet} &amp; {s.atStreet}</span>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* ── Right-side detail panel (slides over map) ──── */}
          <div className={`cbd-detail-panel ${selected ? "open" : ""}`}>
            {selected && (() => {
              const DRow = ({ label, value }: { label: string; value: string | undefined | null }) => {
                if (!value) return null;
                return (
                  <div style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    padding: "6px 0", borderBottom: `1px solid ${COLORS.lightBorder}`,
                    fontFamily: FONTS.body, fontSize: 12,
                  }}>
                    <span style={{
                      color: COLORS.warmGray, fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      flexShrink: 0, paddingTop: 1,
                    }}>{label}</span>
                    <span style={{ color: COLORS.charcoal, fontWeight: 500, textAlign: "right" }}>{value}</span>
                  </div>
                );
              };

              const RecordLink = ({ href, label }: { href: string; label: string }) => (
                <>
                  <div style={{ borderTop: `1px solid ${COLORS.lightBorder}`, margin: "16px 0 12px" }} />
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{
                    fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
                    color: COLORS.orange, textDecoration: "none",
                  }}>
                    {label} &rarr;
                  </a>
                </>
              );

              const typeLabel = selected.type === "311" ? "311 Request" : "Building Permit";

              return (
                <div style={{ padding: "18px 20px" }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {typeLabel}
                    </span>
                    <button onClick={() => setSelected(null)} style={{
                      background: "none", border: `1px solid ${COLORS.lightBorder}`,
                      borderRadius: 6, padding: "2px 10px", cursor: "pointer",
                      fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray,
                    }}>
                      Close
                    </button>
                  </div>

                  {/* ── Permit detail ───────────────── */}
                  {selected.type === "permit" && (() => {
                    const p = selected.data;
                    const estCost = fmtCostFull(p.cost);
                    const revCost = fmtCostFull(p.revisedCost);
                    return (
                      <>
                        <div style={{ fontFamily: FONTS.body, fontSize: 16, fontWeight: 700, color: COLORS.charcoal, marginBottom: 14, lineHeight: 1.3 }}>
                          {p.address || "Unknown"}
                        </div>
                        <DRow label="Permit #" value={p.permitNumber} />
                        <DRow label="Type" value={p.type} />
                        <DRow label="Status" value={p.status ? p.status.replace(/\b\w/g, c => c.toUpperCase()) : undefined} />
                        <DRow label="Filed" value={fmtDate(p.filedDate)} />
                        <DRow label="Issued" value={fmtDate(p.issuedDate)} />
                        <DRow label="Completed" value={fmtDate(p.completedDate)} />
                        <DRow label="Neighborhood" value={p.neighborhood} />
                        <DRow label="Estimated Cost" value={estCost} />
                        {revCost && revCost !== estCost && <DRow label="Revised Cost" value={revCost} />}
                        <DRow label="Existing Use" value={p.existingUse} />
                        <DRow label="Proposed Use" value={p.proposedUse} />
                        {p.description && (
                          <div style={{
                            marginTop: 14, padding: "10px 12px",
                            background: COLORS.cream, borderRadius: 8,
                            fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray,
                            lineHeight: 1.55, fontStyle: "italic",
                          }}>
                            {p.description}
                          </div>
                        )}
                        {p.permitNumber && (
                          <RecordLink
                            href={`https://dbiweb02.sfgov.org/dbipts/default.aspx?page=Permit&PermitNumber=${p.permitNumber}`}
                            label="View official record"
                          />
                        )}
                        {p.block && p.lot && (
                          <>
                            <div style={{ borderTop: `1px solid ${COLORS.lightBorder}`, margin: "16px 0 12px" }} />
                            <a
                              href={`/property/${p.block.padStart(4, "0")}${p.lot.padStart(3, "0")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "block", textAlign: "center",
                                padding: "10px 16px", borderRadius: 8,
                                background: "#E8652D", color: "#fff",
                                fontFamily: FONTS.body, fontSize: 13, fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              Open Property Report
                            </a>
                          </>
                        )}
                      </>
                    );
                  })()}

                  {/* ── 311 detail ──────────────────── */}
                  {selected.type === "311" && (() => {
                    const r = selected.data;
                    const cat = normalize311(r.category);
                    const catColor = CAT_311[cat] ?? "#6B7280";
                    return (
                      <>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 10px", borderRadius: 10, fontSize: 11,
                          background: catColor + "18", color: catColor, fontWeight: 600,
                          marginBottom: 8,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: catColor }} />
                          {cat}
                        </div>
                        <div style={{ fontFamily: FONTS.body, fontSize: 16, fontWeight: 700, color: COLORS.charcoal, marginBottom: 14, lineHeight: 1.3 }}>
                          {r.address || "Unknown"}
                        </div>
                        <DRow label="Request #" value={r.serviceRequestId} />
                        <DRow label="Category" value={r.subtype || r.category} />
                        <DRow label="Status" value={r.status} />
                        <DRow label="Opened" value={fmtDate(r.date)} />
                        <DRow label="Updated" value={fmtDate(r.updatedDate)} />
                        <DRow label="Closed" value={fmtDate(r.closedDate)} />
                        <DRow label="Neighborhood" value={r.neighborhood} />
                        <DRow label="Agency" value={r.agencyResponsible} />
                        {r.serviceDetails && (
                          <div style={{
                            marginTop: 14, padding: "10px 12px",
                            background: COLORS.cream, borderRadius: 8,
                            fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray,
                            lineHeight: 1.55, fontStyle: "italic",
                          }}>
                            {r.serviceDetails}
                          </div>
                        )}
                        {r.serviceRequestId && (
                          <RecordLink
                            href={`https://sf311.org/report/${r.serviceRequestId}`}
                            label="View official record"
                          />
                        )}
                      </>
                    );
                  })()}

                  {/* ── Transit Access score ──────────── */}
                  {transitStops.length > 0 && (() => {
                    const lat = selected.type === "permit" ? selected.data.lat : selected.data.lat;
                    const lng = selected.type === "permit" ? selected.data.lng : selected.data.lng;
                    const ts = computeTransitScore(lat, lng, transitStops);
                    const top3 = ts.nearbyStops.slice(0, 3);
                    if (ts.score === 0 && top3.length === 0) return null;
                    const scoreColor = ts.score >= 60 ? "#10B981" : ts.score >= 30 ? "#F59E0B" : "#EF4444";
                    return (
                      <>
                        <div style={{ borderTop: `1px solid ${COLORS.lightBorder}`, margin: "16px 0 12px" }} />
                        <div style={{
                          fontFamily: FONTS.body, fontSize: 10, fontWeight: 700, color: COLORS.warmGray,
                          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
                        }}>
                          Transit Access
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                          <span style={{
                            fontFamily: FONTS.display, fontSize: 28, fontWeight: 700,
                            color: scoreColor, lineHeight: 1,
                          }}>
                            {ts.score}
                          </span>
                          <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray }}>/100</span>
                          {ts.bartAccess && (
                            <span style={{
                              padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: "#EAB30820", color: "#EAB308", marginLeft: 4,
                            }}>
                              BART
                            </span>
                          )}
                        </div>
                        {top3.length > 0 && (
                          <div style={{ marginBottom: 4 }}>
                            {top3.map((ns, i) => (
                              <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "5px 0", borderBottom: `1px solid ${COLORS.lightBorder}`,
                                fontFamily: FONTS.body, fontSize: 11,
                              }}>
                                <span style={{
                                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                  background: ns.stop.system === "BART" ? "#EAB308" : "#0EA5E9",
                                }} />
                                <span style={{ flex: 1, color: COLORS.charcoal }}>{ns.stop.name}</span>
                                <span style={{ color: COLORS.warmGray, fontSize: 10, whiteSpace: "nowrap" }}>
                                  {ns.distanceM}m
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
            })()}
          </div>

          {/* Reset view button */}
          <button
            onClick={() => {
              setFlyTo(null);
              setTimeout(() => setFlyTo(mapCenter), 10);
            }}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 1000,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
              padding: "6px 14px", cursor: "pointer",
              fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            Reset View
          </button>
        </div>
      </div>
    </>
  );
}
