/**
 * MapPage.tsx — Full-screen Leaflet map for Tempe permit data.
 *
 * Fetches 90 days of building permits from Tempe ArcGIS and renders
 * color-coded circle markers with click-to-inspect popups.
 */

import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { COLORS, FONTS } from "../theme";
import type { DistrictConfig } from "../districts";

// @ts-ignore — JS module
import { fetchRecentPermits } from "../services/tempeApi.js";

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
  if (s.includes("building") || s.includes("residential") || s.includes("commercial"))
    return "building";
  if (s.includes("engineering") || s.includes("paving") || s.includes("grading"))
    return "engineering";
  if (s.includes("water") || s.includes("sewer") || s.includes("fire"))
    return "water";
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
  water:       "Water / Sewer / Fire",
  other:       "Other",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCost(cost: number | null | undefined): string {
  if (!cost || cost <= 0) return "—";
  return cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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

interface MapPageProps {
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapPage({ districtConfig: _districtConfig, onNavigate: _onNavigate }: MapPageProps) {
  const [permits, setPermits] = useState<TempePermit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchRecentPermits(90)
      .then((data: TempePermit[]) => setPermits(data.filter(p => p.lat != null && p.lng != null)))
      .catch((err: Error) => console.warn("[MapPage] permit fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const tileUrl = import.meta.env.VITE_MAPBOX_TOKEN ? MAPBOX_TILE_URL : OSM_TILE_URL;

  // Category counts for legend
  const categoryCounts = useMemo(() => {
    const counts: Record<PermitCategory, number> = { building: 0, engineering: 0, water: 0, other: 0 };
    for (const p of permits) {
      counts[classifyPermit(p.permitType)]++;
    }
    return counts;
  }, [permits]);

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)" }}>
      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: COLORS.white, borderRadius: 20,
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
          Loading Tempe permits…
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
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 24, left: 12, zIndex: 1000,
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
              border: `1px solid ${CATEGORY_COLORS[cat]}`,
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

      {/* Permit count badge */}
      {!loading && (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 1000,
          background: COLORS.white, borderRadius: 20,
          padding: "6px 14px", fontSize: 12, fontWeight: 600,
          fontFamily: FONTS.body, color: COLORS.charcoal,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}>
          {permits.length} permits
        </div>
      )}
    </div>
  );
}
