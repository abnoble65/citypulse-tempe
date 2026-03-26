/**
 * MapPage.tsx — Full-screen Leaflet map for Tempe permit + zoning data.
 *
 * Fetches 90 days of building permits and zoning districts from Tempe ArcGIS.
 * Permits render as color-coded circle markers; zoning as toggleable polygon overlay.
 */

import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Popup,
  Pane,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { COLORS, FONTS } from "../theme";
import type { DistrictConfig } from "../districts";

// @ts-ignore — JS module
import { fetchRecentPermits, fetchZoningDistricts } from "../services/tempeApi.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPE_CENTER: [number, number] = [33.4255, -111.9400];
const DEFAULT_ZOOM = 13;

const MAPBOX_TILE_URL =
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN ?? ""}`;

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// ── Permit type classification ────────────────────────────────────────────────

type PermitCategory = "building" | "engineering" | "water" | "other";

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
  engineering: "Engineering / Paving",
  water:       "Water / Sewer / Drainage",
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
  "mixed-use":     "#F5A623",
  "high-density":  "#1B5FA8",
  "single-family": "#4A90C4",
  "commercial":    "#0D3B6E",
  "industrial":    "#888780",
  "other":         "transparent",
};

const ZONE_LABELS: Record<Exclude<ZoneCategory, "other">, string> = {
  "mixed-use":     "Mixed-Use",
  "high-density":  "High Density Residential",
  "single-family": "Single Family",
  "commercial":    "Commercial",
  "industrial":    "Industrial",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCost(cost: number | null | undefined): string {
  if (!cost || cost <= 0) return "—";
  return cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Convert ArcGIS rings [[lng,lat],...] to Leaflet positions [[lat,lng],...] */
function ringsToLatLngs(rings: number[][][]): [number, number][][] {
  return rings.map(ring => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
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

interface MapPageProps {
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapPage({ districtConfig: _districtConfig, onNavigate: _onNavigate }: MapPageProps) {
  const [permits, setPermits] = useState<TempePermit[]>([]);
  const [zones, setZones]     = useState<TempeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showZoning, setShowZoning] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRecentPermits(90),
      fetchZoningDistricts(),
    ])
      .then(([permitData, zoneData]: [TempePermit[], TempeZone[]]) => {
        setPermits(permitData.filter(p => p.lat != null && p.lng != null));
        setZones(zoneData.filter(z => z.geometry?.rings?.length));
      })
      .catch((err: Error) => console.warn("[MapPage] data fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const tileUrl = import.meta.env.VITE_MAPBOX_TOKEN ? MAPBOX_TILE_URL : OSM_TILE_URL;

  // Permit category counts for legend
  const categoryCounts = useMemo(() => {
    const counts: Record<PermitCategory, number> = { building: 0, engineering: 0, water: 0, other: 0 };
    for (const p of permits) {
      counts[classifyPermit(p.permitType)]++;
    }
    return counts;
  }, [permits]);

  // Filter zones to only those with visible colors
  const visibleZones = useMemo(() => {
    return zones.filter(z => classifyZone(z.zoningCode) !== "other");
  }, [zones]);

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)" }}>
      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 1500, background: COLORS.white, borderRadius: 20,
          padding: "8px 20px", fontSize: 13, fontWeight: 600,
          fontFamily: FONTS.body, color: COLORS.charcoal,
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#F5A623",
            animation: "pulse-glow 1.4s ease-in-out infinite",
          }} />
          Loading Tempe data…
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={TEMPE_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        {/* Zoning polygons — rendered in a lower pane so permits stay on top */}
        {showZoning && (
          <Pane name="zoning-pane" style={{ zIndex: 350 }}>
            {visibleZones.map((z, i) => {
              const cat = classifyZone(z.zoningCode);
              const color = ZONE_COLORS[cat];
              const positions = ringsToLatLngs(z.geometry!.rings);
              return (
                <Polygon
                  key={i}
                  positions={positions}
                  pathOptions={{
                    color,
                    weight: 1.5,
                    opacity: 0.6,
                    fillColor: color,
                    fillOpacity: 0.3,
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.5, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: COLORS.charcoal }}>
                        {z.zoningCode}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
                        <span style={{ color: COLORS.midGray }}>Zone</span>
                        <span>{z.description || "—"}</span>
                        {z.maxHeight != null && (
                          <>
                            <span style={{ color: COLORS.midGray }}>Max Height</span>
                            <span>{z.maxHeight} ft</span>
                          </>
                        )}
                        {z.maxDensity != null && (
                          <>
                            <span style={{ color: COLORS.midGray }}>Max Density</span>
                            <span>{z.maxDensity} du/ac</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </Pane>
        )}

        {/* Permit pins — rendered in a higher pane so they stay on top */}
        <Pane name="permits-pane" style={{ zIndex: 450 }}>
          {permits.map((p, i) => {
            const cat = classifyPermit(p.permitType);
            const color = CATEGORY_COLORS[cat];
            return (
              <CircleMarker
                key={i}
                center={[p.lat!, p.lng!]}
                radius={8}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.7,
                  weight: 1.5,
                  opacity: 0.9,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.5, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: COLORS.charcoal }}>
                      {p.address || "No address"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
                      <span style={{ color: COLORS.midGray }}>Type</span>
                      <span>{p.permitType || "—"}</span>
                      <span style={{ color: COLORS.midGray }}>Value</span>
                      <span>{fmtCost(p.estimatedCost)}</span>
                      <span style={{ color: COLORS.midGray }}>Zone</span>
                      <span>{p.zone || "—"}</span>
                      <span style={{ color: COLORS.midGray }}>Status</span>
                      <span>{p.status || "—"}</span>
                      {p.issuedDate && (
                        <>
                          <span style={{ color: COLORS.midGray }}>Issued</span>
                          <span>{p.issuedDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </Pane>
      </MapContainer>

      {/* Legends — bottom left */}
      <div style={{
        position: "absolute", bottom: 24, left: 12, zIndex: 1500,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* Permit legend */}
        <div style={{
          background: "rgba(255,255,255,0.95)", borderRadius: 12,
          padding: "12px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          fontSize: 12, fontFamily: FONTS.body,
          backdropFilter: "blur(4px)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: COLORS.charcoal, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Permits — Last 90 Days
          </div>
          {(Object.keys(CATEGORY_COLORS) as PermitCategory[]).map(cat => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: CATEGORY_COLORS[cat],
                flexShrink: 0,
              }} />
              <span style={{ color: COLORS.charcoal }}>{CATEGORY_LABELS[cat]}</span>
              <span style={{ color: COLORS.warmGray, marginLeft: "auto" }}>{categoryCounts[cat]}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${COLORS.lightBorder}`, marginTop: 6, paddingTop: 6, color: COLORS.midGray, fontWeight: 600 }}>
            Total: {permits.length}
          </div>
        </div>

        {/* Zoning legend — only visible when overlay is ON */}
        {showZoning && (
          <div style={{
            background: "rgba(255,255,255,0.95)", borderRadius: 12,
            padding: "12px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            fontSize: 12, fontFamily: FONTS.body,
            backdropFilter: "blur(4px)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: COLORS.charcoal, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Zoning Districts
            </div>
            {(Object.keys(ZONE_LABELS) as Exclude<ZoneCategory, "other">[]).map(cat => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 14, height: 10, borderRadius: 2,
                  background: ZONE_COLORS[cat],
                  opacity: 0.5,
                  border: `1px solid ${ZONE_COLORS[cat]}`,
                  flexShrink: 0,
                }} />
                <span style={{ color: COLORS.charcoal }}>{ZONE_LABELS[cat]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top right controls */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 1500,
        display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end",
      }}>
        {/* Permit count badge */}
        {!loading && (
          <div style={{
            background: COLORS.white, borderRadius: 20,
            padding: "6px 14px", fontSize: 12, fontWeight: 600,
            fontFamily: FONTS.body, color: COLORS.charcoal,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            {permits.length} permits
          </div>
        )}

        {/* Zoning overlay toggle */}
        <button
          onClick={() => setShowZoning(v => !v)}
          style={{
            background: showZoning ? COLORS.orange : COLORS.white,
            color: showZoning ? COLORS.white : COLORS.charcoal,
            border: `1px solid ${showZoning ? COLORS.orange : COLORS.lightBorder}`,
            borderRadius: 20, padding: "6px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: FONTS.body,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            transition: "all 0.15s ease",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: showZoning ? COLORS.white : COLORS.warmGray,
            opacity: showZoning ? 1 : 0.5,
          }} />
          Zoning Overlay
        </button>
      </div>
    </div>
  );
}
