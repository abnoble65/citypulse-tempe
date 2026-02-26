/**
 * MapView.tsx — CityPulse permit location map
 *
 * Renders a Leaflet map with circle markers for each permit.
 * Color-coded by permit type. Zooms to the active neighborhood zip
 * when the filter changes. Lazy-loadable (no SSR concerns — Vite SPA).
 */
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPermit } from "../services/aggregator";
import type { DistrictConfig } from "../districts";

// ── District center coordinates (lat, lng) for "show all" view ─────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "1":  [37.778, -122.477],
  "2":  [37.793, -122.434],
  "3":  [37.797, -122.406],
  "4":  [37.757, -122.493],
  "5":  [37.772, -122.440],
  "6":  [37.778, -122.413],
  "7":  [37.743, -122.457],
  "8":  [37.758, -122.440],
  "9":  [37.749, -122.413],
  "10": [37.748, -122.393],
  "11": [37.721, -122.435],
};

const DISTRICT_ZOOM: Record<string, number> = {
  "1": 14, "2": 14, "3": 15, "4": 13, "5": 14,
  "6": 14, "7": 14, "8": 14, "9": 14, "10": 13, "11": 14,
};

// ── Permit type → marker color ──────────────────────────────────────────────
function permitColor(typeDef: string): string {
  const t = typeDef.toLowerCase();
  if (t.includes("new construction"))                                    return "#E05050"; // red
  if (t.includes("altera") || t.includes("addition") || t.includes("otc")) return "#4A7FD0"; // blue
  if (t.includes("demol"))                                               return "#D4643B"; // orange
  return "#4D9A6A"; // green — change of use, signs, grade, etc.
}

// ── Legend ──────────────────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { color: "#E05050", label: "New Construction" },
  { color: "#4A7FD0", label: "Alteration / Renovation" },
  { color: "#D4643B", label: "Demolition" },
  { color: "#4D9A6A", label: "Other" },
];

// ── Inner controller (must live inside MapContainer) ────────────────────────
function MapController({
  permits,
  districtConfig,
  activeZip,
}: {
  permits: MapPermit[];
  districtConfig: DistrictConfig;
  activeZip: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (activeZip) {
      const zipPermits = permits.filter(p => p.zipcode === activeZip);
      if (zipPermits.length >= 2) {
        const lats = zipPermits.map(p => p.lat);
        const lngs = zipPermits.map(p => p.lng);
        map.flyToBounds(
          [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
          { padding: [48, 48], maxZoom: 16, duration: 0.7 },
        );
      } else if (zipPermits.length === 1) {
        map.flyTo([zipPermits[0].lat, zipPermits[0].lng], 16, { duration: 0.7 });
      }
    } else {
      const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
      const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;
      map.flyTo(center, zoom, { duration: 0.7 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZip, districtConfig.number]);

  return null;
}

// ── Public component ─────────────────────────────────────────────────────────
export interface MapViewProps {
  permits: MapPermit[];
  districtConfig: DistrictConfig;
  activeZip: string | null;
}

export function MapView({ permits, districtConfig, activeZip }: MapViewProps) {
  const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
  const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;

  const visiblePermits = activeZip
    ? permits.filter(p => p.zipcode === activeZip)
    : permits;

  return (
    <div style={{ position: "relative" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: 420, borderRadius: 16, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapController
          permits={permits}
          districtConfig={districtConfig}
          activeZip={activeZip}
        />
        {visiblePermits.map(p => (
          <CircleMarker
            key={p.permit_number}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{
              color: permitColor(p.permit_type_definition),
              fillColor: permitColor(p.permit_type_definition),
              fillOpacity: 0.72,
              weight: 1.5,
            }}
          >
            <Popup>
              <div style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 13, lineHeight: 1.55, minWidth: 180,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: "#1A1A2E" }}>
                  {p.address || "—"}
                </div>
                <div style={{ color: "#555", marginBottom: 2 }}>
                  {p.permit_type_definition}
                </div>
                <div style={{ color: "#888", fontSize: 12 }}>
                  {p.status} · Filed {p.filed_date}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 16, right: 16, zIndex: 1000,
        background: "rgba(255,255,255,0.93)", borderRadius: 10,
        padding: "10px 14px", backdropFilter: "blur(4px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
      }}>
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 5, fontFamily: "system-ui, sans-serif", fontSize: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: item.color, flexShrink: 0,
            }} />
            <span style={{ color: "#444" }}>{item.label}</span>
          </div>
        ))}
        <div style={{
          marginTop: 6, paddingTop: 6,
          borderTop: "1px solid #eee",
          fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#999",
        }}>
          {visiblePermits.length} permit{visiblePermits.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
