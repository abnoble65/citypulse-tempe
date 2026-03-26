/**
 * MapPage.tsx — Full-screen dark map for Tempe permit + zoning data.
 *
 * Dark CartoDB base map, interactive filter chips, slide-in detail panel,
 * stats bar, map style toggle, and zoning overlay.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Marker,
  Pane,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon path (broken by bundlers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

import { COLORS, FONTS } from "../theme";
import type { DistrictConfig } from "../districts";

// @ts-ignore — JS module
import { fetchRecentPermits, fetchZoningDistricts } from "../services/tempeApi.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPE_CENTER: [number, number] = [33.4255, -111.9400];
const DEFAULT_ZOOM = 14;

const TILE_URLS = {
  dark:      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light:     "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  topo:      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
};
type MapStyle = keyof typeof TILE_URLS;
const MAP_STYLE_LABELS: Record<MapStyle, string> = { dark: "Dark", light: "Light", satellite: "Satellite", topo: "Topo" };
const MAP_STYLE_ORDER: MapStyle[] = ["dark", "light", "satellite", "topo"];

const TILE_ATTRIBUTIONS: Record<MapStyle, string> = {
  dark:      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  light:     '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  satellite: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; Esri',
  topo:      '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

/** Cutoff for "recent" permit glow — issued in last 30 days */
const RECENT_CUTOFF = new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0];

// ── Tempe landmark labels ─────────────────────────────────────────────────────

const LANDMARKS: Array<{ name: string; position: [number, number] }> = [
  { name: "Tempe Town Lake",    position: [33.4285, -111.9172] },
  { name: "ASU Main Campus",    position: [33.4242, -111.9281] },
  { name: "Mill Avenue",        position: [33.4262, -111.9397] },
  { name: "Tempe Marketplace",  position: [33.3978, -111.9089] },
];

function landmarkIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      background: rgba(13,59,110,0.85);
      color: white;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid rgba(245,166,35,0.6);
      font-family: 'Lexend', sans-serif;
    ">${name}</div>`,
    iconAnchor: [0, 0],
  });
}

// ── Permit type classification ────────────────────────────────────────────────

type PermitCategory = "building" | "engineering" | "water" | "other";
const ALL_CATEGORIES: PermitCategory[] = ["building", "engineering", "water", "other"];

function classifyPermit(permitType: string): PermitCategory {
  const s = permitType.toLowerCase();
  if (s.includes("water") || s.includes("sewer") || s.includes("fire") || s.includes("drainage"))
    return "water";
  if (s.includes("engineering") || s.includes("paving") || s.includes("grading"))
    return "engineering";
  if (s.includes("building") || s.includes("residential") || s.includes("commercial"))
    return "building";
  return "other";
}

const CATEGORY_COLORS: Record<PermitCategory, string> = {
  building:    "#1B5FA8",
  engineering: "#F5A623",
  water:       "#4A90C4",
  other:       "#888780",
};

const CATEGORY_LABELS: Record<PermitCategory, string> = {
  building:    "Building",
  engineering: "Eng / Paving",
  water:       "Water / Sewer",
  other:       "Other",
};

// ── Zoning classification ─────────────────────────────────────────────────────

type ZoneCategory = "mixed-use" | "high-density" | "single-family" | "commercial" | "industrial" | "other";

const ZONE_CODE_GROUPS: Record<string, ZoneCategory> = {
  "MU-2": "mixed-use", "MU-3": "mixed-use", "MU-4": "mixed-use", "MU-ED": "mixed-use",
  "R-3": "high-density", "R-3R": "high-density", "R-4": "high-density", "R-5": "high-density",
  "R1-4": "single-family", "R1-5": "single-family", "R1-6": "single-family", "R1-PAD": "single-family",
  "CC": "commercial", "CSS": "commercial", "PCC-1": "commercial", "PCC-2": "commercial",
  "GI": "industrial", "LI": "industrial",
};

function classifyZone(code: string): ZoneCategory {
  return ZONE_CODE_GROUPS[code] ?? "other";
}

const ZONE_COLORS: Record<ZoneCategory, string> = {
  "mixed-use": "#F5A623", "high-density": "#1B5FA8", "single-family": "#4A90C4",
  "commercial": "#0D3B6E", "industrial": "#888780", "other": "transparent",
};

const ZONE_CATEGORY_LABELS: Record<ZoneCategory, string> = {
  "mixed-use": "Mixed-Use", "high-density": "High Density", "single-family": "Single Family",
  "commercial": "Commercial", "industrial": "Industrial", "other": "Other",
};

const ZONE_LEGEND_CATS: Exclude<ZoneCategory, "other">[] = ["mixed-use", "high-density", "single-family", "commercial", "industrial"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCost(cost: number | null | undefined): string {
  if (!cost || cost <= 0) return "—";
  return cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtCostShort(cost: number): string {
  if (cost >= 1_000_000_000) return `$${(cost / 1_000_000_000).toFixed(1)}B`;
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${Math.round(cost / 1_000)}K`;
  return `$${cost}`;
}

function fmtDateLong(d: string | null): string {
  if (!d) return "—";
  try {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

function ringsToLatLngs(rings: number[][][]): [number, number][][] {
  return rings.map(ring => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
}

function statusColor(status: string): { bg: string; text: string } {
  const s = status.toLowerCase();
  if (s.includes("issued") || s.includes("complete") || s.includes("final")) return { bg: "#1a7a3a", text: "#fff" };
  if (s.includes("expired") || s.includes("void") || s.includes("cancel")) return { bg: "#b44040", text: "#fff" };
  return { bg: "#F5A623", text: "#1A3A5C" };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TempePermit {
  address: string;
  issuedDate: string | null;
  estimatedCost: number;
  zone: string;
  permitType: string;
  status: string;
  housingUnits: number;
  lat: number | null;
  lng: number | null;
}

interface TempeZone {
  zoningCode: string;
  description: string;
  maxHeight: number | null;
  maxDensity: number | null;
  geometry: { rings: number[][][] } | null;
}

type SelectedItem =
  | { type: "permit"; data: TempePermit }
  | { type: "zone"; data: TempeZone };

interface MapPageProps {
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

// ── Tile layer switcher (react-leaflet requires re-mounting TileLayer) ────────

function TileSwitcher({ style }: { style: MapStyle }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [style, map]);
  return (
    <TileLayer
      key={style}
      url={TILE_URLS[style]}
      attribution={TILE_ATTRIBUTIONS[style]}
    />
  );
}

// ── Map click handler (close panel only on base map canvas click) ─────────────

function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({
    click: (e) => {
      // Only close panel if the click target is the map canvas itself,
      // not a marker or polygon (which handle their own clicks via L.DomEvent.stopPropagation)
      const target = e.originalEvent?.target as HTMLElement | undefined;
      if (target?.classList?.contains("leaflet-container") ||
          target?.closest?.(".leaflet-pane")) {
        onMapClick();
      }
    },
  });
  return null;
}

// ── Logo mark (inline) ──────────────────────────────────────────────────────

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" width="20" height="20" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="7" fill="#0D3B6E"/>
      <rect x="6" y="7" width="20" height="4" rx="1.5" fill="white"/>
      <rect x="14" y="11" width="4" height="14" rx="1.5" fill="white"/>
      <polyline points="6,22 10,22 12,16 16,28 20,18 22,22 26,22"
        fill="none" stroke="#F5A623" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapPage({ districtConfig: _districtConfig, onNavigate }: MapPageProps) {
  const [permits, setPermits] = useState<TempePermit[]>([]);
  const [zones, setZones]     = useState<TempeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showZoning, setShowZoning] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");
  const [activeFilters, setActiveFilters] = useState<Record<PermitCategory, boolean>>({
    building: true, engineering: true, water: true, other: true,
  });
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRecentPermits(90), fetchZoningDistricts()])
      .then(([permitData, zoneData]: [TempePermit[], TempeZone[]]) => {
        setPermits(permitData.filter(p => p.lat != null && p.lng != null));
        setZones(zoneData.filter(z => z.geometry?.rings?.length));
      })
      .catch((err: Error) => console.warn("[MapPage] data fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const toggleFilter = useCallback((cat: PermitCategory) => {
    setActiveFilters(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const cycleMapStyle = useCallback(() => {
    setMapStyle(prev => {
      const idx = MAP_STYLE_ORDER.indexOf(prev);
      return MAP_STYLE_ORDER[(idx + 1) % MAP_STYLE_ORDER.length];
    });
  }, []);

  // ── Computed stats ──────────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Record<PermitCategory, number> = { building: 0, engineering: 0, water: 0, other: 0 };
    for (const p of permits) counts[classifyPermit(p.permitType)]++;
    return counts;
  }, [permits]);

  const totalValue = useMemo(() => permits.reduce((s, p) => s + (p.estimatedCost || 0), 0), [permits]);
  const mixedUseCount = useMemo(() => permits.filter(p => p.zone.startsWith("MU-")).length, [permits]);

  const filteredPermits = useMemo(() =>
    permits.filter(p => activeFilters[classifyPermit(p.permitType)]),
  [permits, activeFilters]);

  const visibleZones = useMemo(() =>
    zones.filter(z => classifyZone(z.zoningCode) !== "other"),
  [zones]);

  const panelOpen = selected !== null;

  // ── Styles ──────────────────────────────────────────────────────────────────

  const pillBase: React.CSSProperties = {
    borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600,
    fontFamily: FONTS.body, cursor: "pointer", transition: "all 0.15s ease",
    border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    display: "flex", alignItems: "center", gap: 6,
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)", overflow: "hidden" }}>
      {/* Leaflet zoom control override + dark scrollbar */}
      <style>{`
        .leaflet-control-zoom a {
          background: #0D3B6E !important;
          color: #fff !important;
          border: none !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 16px !important;
          border-radius: 8px !important;
          margin-bottom: 2px !important;
        }
        .leaflet-control-zoom a:hover { background: #1B5FA8 !important; }
        .leaflet-control-zoom { border: none !important; border-radius: 10px !important; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important; }
        .leaflet-popup-content-wrapper { border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; background: transparent !important; }
        .leaflet-popup-tip-container { display: none !important; }
        .leaflet-popup-close-button { display: none !important; }
        .leaflet-popup-content { margin: 0 !important; }
      `}</style>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 1500, background: "#0D3B6E", borderRadius: 24,
          padding: "8px 20px", fontSize: 13, fontWeight: 600,
          fontFamily: FONTS.body, color: "#fff",
          boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#F5A623",
            animation: "pulse-glow 1.4s ease-in-out infinite",
          }} />
          Loading Tempe data…
        </div>
      )}

      {/* ── Stats Bar — top left ─────────────────────────────────────────── */}
      {!loading && (
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 1500,
          background: "#0D3B6E", borderRadius: 24, padding: "8px 18px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
          fontFamily: FONTS.body, fontSize: 12, color: "#fff",
        }}>
          <LogoMark />
          <span style={{ fontWeight: 700 }}>{permits.length} permits</span>
          <span style={{ color: "#F5A623", fontWeight: 700 }}>{fmtCostShort(totalValue)} total value</span>
          <span>{mixedUseCount} mixed-use</span>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>90 days</span>
        </div>
      )}

      {/* ── Filter Chips — below stats bar ───────────────────────────────── */}
      {!loading && (
        <div style={{
          position: "absolute", top: 56, left: 12, zIndex: 1500,
          display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          {ALL_CATEGORIES.map(cat => {
            const active = activeFilters[cat];
            const color = CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                style={{
                  ...pillBase,
                  background: active ? color : "#2A3A4A",
                  color: active ? "#fff" : color,
                  border: active ? "none" : `1px solid ${color}`,
                  padding: "5px 12px", fontSize: 11,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: active ? "#fff" : color,
                  flexShrink: 0,
                }} />
                {CATEGORY_LABELS[cat]}
                <span style={{ opacity: 0.7, marginLeft: 2 }}>{categoryCounts[cat]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Top Right Controls ────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 12, right: panelOpen ? 232 : 12, zIndex: 1500,
        display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end",
        transition: "right 0.3s ease",
      }}>
        {/* Zoning overlay toggle */}
        <button
          onClick={() => setShowZoning(v => !v)}
          style={{
            ...pillBase,
            background: showZoning ? "#F5A623" : "#0D3B6E",
            color: showZoning ? "#1A3A5C" : "#fff",
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: showZoning ? "#1A3A5C" : "rgba(255,255,255,0.4)",
          }} />
          Zoning
        </button>

        {/* Map style toggle */}
        <button onClick={cycleMapStyle} style={{ ...pillBase, background: "#0D3B6E", color: "#fff" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          {MAP_STYLE_LABELS[mapStyle]}
        </button>

        {/* Zoning legend — only when overlay is ON */}
        {showZoning && (
          <div style={{
            background: "rgba(13,59,110,0.92)", borderRadius: 12,
            padding: "10px 14px", fontSize: 11, fontFamily: FONTS.body,
            backdropFilter: "blur(4px)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Zoning
            </div>
            {ZONE_LEGEND_CATS.map(cat => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{
                  width: 12, height: 8, borderRadius: 2,
                  background: ZONE_COLORS[cat], opacity: 0.6, flexShrink: 0,
                }} />
                <span style={{ color: "rgba(255,255,255,0.8)" }}>{ZONE_CATEGORY_LABELS[cat]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <MapContainer
        center={TEMPE_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileSwitcher style={mapStyle} />
        <MapClickHandler onMapClick={() => setSelected(null)} />

        {/* Zoning polygons */}
        {showZoning && (
          <Pane name="zoning-pane" style={{ zIndex: 350 }}>
            {visibleZones.map((z, i) => {
              const cat = classifyZone(z.zoningCode);
              const color = ZONE_COLORS[cat];
              return (
                <Polygon
                  key={i}
                  positions={ringsToLatLngs(z.geometry!.rings)}
                  pathOptions={{ color, weight: 1.5, opacity: 0.6, fillColor: color, fillOpacity: 0.3 }}
                  eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setSelected({ type: "zone", data: z }); } }}
                />
              );
            })}
          </Pane>
        )}

        {/* Permit glow rings for recent permits (last 30 days) */}
        <Pane name="glow-pane" style={{ zIndex: 440 }}>
          {filteredPermits.map((p, i) => {
            const isRecent = p.issuedDate != null && p.issuedDate >= RECENT_CUTOFF;
            if (!isRecent) return null;
            const color = CATEGORY_COLORS[classifyPermit(p.permitType)];
            return (
              <CircleMarker
                key={`glow-${i}`}
                center={[p.lat!, p.lng!]}
                radius={16}
                pathOptions={{
                  color: "transparent", fillColor: color, fillOpacity: 0.15,
                  weight: 0, opacity: 0,
                }}
                interactive={false}
              />
            );
          })}
        </Pane>

        {/* Permit pins */}
        <Pane name="permits-pane" style={{ zIndex: 450 }}>
          {filteredPermits.map((p, i) => {
            const cat = classifyPermit(p.permitType);
            const color = CATEGORY_COLORS[cat];
            return (
              <CircleMarker
                key={i}
                center={[p.lat!, p.lng!]}
                radius={10}
                pathOptions={{
                  color: "#fff", fillColor: color, fillOpacity: 0.85,
                  weight: 2, opacity: 0.9,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setSelected({ type: "permit", data: p });
                  },
                }}
              />
            );
          })}
        </Pane>

        {/* Landmark labels */}
        {LANDMARKS.map(lm => (
          <Marker
            key={lm.name}
            position={lm.position}
            icon={landmarkIcon(lm.name)}
            interactive={false}
          />
        ))}
      </MapContainer>

      {/* ── Slide-in Detail Panel ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 220, zIndex: 1500, background: "#fff",
        transform: panelOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
        display: "flex", flexDirection: "column",
        boxShadow: panelOpen ? "-4px 0 20px rgba(0,0,0,0.2)" : "none",
        overflow: "hidden",
      }}>
        {/* Panel header */}
        <div style={{
          background: "#0D3B6E", padding: "12px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {selected?.type === "zone" ? "Zoning District" : "Permit Detail"}
          </span>
          <button
            onClick={() => setSelected(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}
          >×</button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", fontFamily: FONTS.body, fontSize: 13 }}>
          {selected?.type === "permit" && (() => {
            const p = selected.data;
            const cat = classifyPermit(p.permitType);
            const zoneCat = classifyZone(p.zone);
            const sc = statusColor(p.status);
            return (
              <>
                {/* Type badge */}
                <div style={{
                  display: "inline-block", background: CATEGORY_COLORS[cat], color: "#fff",
                  borderRadius: 10, padding: "3px 10px", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10,
                }}>
                  {CATEGORY_LABELS[cat]}
                </div>

                {/* Address */}
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.charcoal, lineHeight: 1.25, marginBottom: 14, fontFamily: "'Urbanist',sans-serif" }}>
                  {p.address || "No address"}
                </div>

                <div style={{ height: 1, background: COLORS.lightBorder, marginBottom: 14 }} />

                {/* Est. Value */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Est. Value</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#0D3B6E", fontFamily: "'Urbanist',sans-serif" }}>{fmtCost(p.estimatedCost)}</div>
                </div>

                {/* Zone */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Zone</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: COLORS.charcoal }}>{p.zone || "—"}</span>
                    {zoneCat !== "other" && (
                      <span style={{
                        background: ZONE_COLORS[zoneCat], color: "#fff", borderRadius: 8,
                        padding: "2px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      }}>
                        {ZONE_CATEGORY_LABELS[zoneCat]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Status</div>
                  <span style={{
                    background: sc.bg, color: sc.text, borderRadius: 10,
                    padding: "3px 10px", fontSize: 11, fontWeight: 700,
                  }}>
                    {p.status || "Unknown"}
                  </span>
                </div>

                {/* Issued date */}
                {p.issuedDate && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Issued</div>
                    <div style={{ color: COLORS.charcoal }}>{fmtDateLong(p.issuedDate)}</div>
                  </div>
                )}

                <div style={{ height: 1, background: COLORS.lightBorder, marginBottom: 14 }} />

                {/* Briefing link */}
                <button
                  onClick={() => onNavigate("Briefing")}
                  style={{
                    width: "100%", background: "#0D3B6E", color: "#fff",
                    border: "none", borderRadius: 12, padding: "10px 0",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'Urbanist',sans-serif",
                  }}
                >
                  View AI Briefing →
                </button>
              </>
            );
          })()}

          {selected?.type === "zone" && (() => {
            const z = selected.data;
            const cat = classifyZone(z.zoningCode);
            return (
              <>
                {/* Zone code */}
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.charcoal, fontFamily: "'Urbanist',sans-serif", marginBottom: 6 }}>
                  {z.zoningCode}
                </div>

                {/* Description */}
                <div style={{ fontSize: 14, color: COLORS.midGray, marginBottom: 12 }}>
                  {z.description || "—"}
                </div>

                {/* Category badge */}
                {cat !== "other" && (
                  <div style={{
                    display: "inline-block", background: ZONE_COLORS[cat], color: "#fff",
                    borderRadius: 10, padding: "3px 10px", fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 14,
                  }}>
                    {ZONE_CATEGORY_LABELS[cat]}
                  </div>
                )}

                <div style={{ height: 1, background: COLORS.lightBorder, marginBottom: 14 }} />

                {z.maxHeight != null && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Max Height</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0D3B6E", fontFamily: "'Urbanist',sans-serif" }}>{z.maxHeight} ft</div>
                  </div>
                )}

                {z.maxDensity != null && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Max Density</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0D3B6E", fontFamily: "'Urbanist',sans-serif" }}>{z.maxDensity} du/ac</div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
