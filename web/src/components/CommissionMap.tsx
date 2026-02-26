/**
 * CommissionMap.tsx — Compact context map for the Commission page.
 *
 * CartoDB Positron tiles, no zoom controls, 220px tall.
 * Markers are color-coded by action outcome (green / amber / red).
 * Clicking a marker fires onSelectMarker(key) for two-way card↔map sync.
 */
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DistrictConfig } from "../districts";

// ── District center coordinates ─────────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────────────────────
export interface CommissionMarker {
  key: string;
  address: string;
  action: "Approved" | "Continued" | "Disapproved";
  lat: number;
  lng: number;
}

// ── Marker color by outcome ──────────────────────────────────────────────────
function markerColor(action: "Approved" | "Continued" | "Disapproved"): string {
  if (action === "Approved")    return "#4D9A6A"; // green
  if (action === "Disapproved") return "#E05050"; // red
  return "#D4943B";                               // amber — Continued / unknown
}

// ── Inner controller (must live inside MapContainer) ────────────────────────
function MapController({
  markers,
  selectedKey,
  districtConfig,
}: {
  markers: CommissionMarker[];
  selectedKey: string | null;
  districtConfig: DistrictConfig;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedKey) {
      const m = markers.find(mk => mk.key === selectedKey);
      if (m) {
        map.flyTo([m.lat, m.lng], 16, { duration: 0.5 });
        return;
      }
    }
    const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
    const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;
    map.flyTo(center, zoom, { duration: 0.5 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, districtConfig.number]);

  return null;
}

// ── Public component ─────────────────────────────────────────────────────────
export interface CommissionMapProps {
  markers: CommissionMarker[];
  selectedKey: string | null;
  districtConfig: DistrictConfig;
  onSelectMarker: (key: string) => void;
}

export function CommissionMap({
  markers,
  selectedKey,
  districtConfig,
  onSelectMarker,
}: CommissionMapProps) {
  const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
  const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;

  return (
    <div style={{ position: "relative", marginBottom: 28 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: 220, borderRadius: 20, width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <MapController
          markers={markers}
          selectedKey={selectedKey}
          districtConfig={districtConfig}
        />
        {markers.map(m => {
          const isSelected = m.key === selectedKey;
          const color = markerColor(m.action);
          return (
            <CircleMarker
              key={m.key}
              center={[m.lat, m.lng]}
              radius={isSelected ? 10 : 7}
              pathOptions={{
                color: isSelected ? "#1A1A2E" : color,
                fillColor: color,
                fillOpacity: isSelected ? 0.95 : 0.75,
                weight: isSelected ? 2.5 : 1.5,
              }}
              eventHandlers={{ click: () => onSelectMarker(m.key) }}
            >
              <Popup>
                <div style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13, lineHeight: 1.5, minWidth: 160,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 3, color: "#1A1A2E" }}>
                    {m.address}
                  </div>
                  <div style={{ color, fontWeight: 600 }}>{m.action}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Minimal attribution — bottom right */}
      <div style={{
        position: "absolute", bottom: 6, right: 10, zIndex: 1000,
        fontSize: 10, color: "#999", fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
      }}>
        © OSM © CARTO
      </div>

      {/* Project count badge — bottom left */}
      {markers.length > 0 && (
        <div style={{
          position: "absolute", bottom: 8, left: 12, zIndex: 1000,
          background: "rgba(255,255,255,0.92)", borderRadius: 8,
          padding: "4px 10px", fontSize: 11,
          fontFamily: "system-ui, sans-serif", color: "#555",
          backdropFilter: "blur(4px)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
        }}>
          {markers.length} project{markers.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Legend — bottom left, above badge */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 1000,
        background: "rgba(255,255,255,0.92)", borderRadius: 10,
        padding: "8px 12px", backdropFilter: "blur(4px)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.1)",
      }}>
        {[
          { color: "#4D9A6A", label: "Approved" },
          { color: "#D4943B", label: "Continued" },
          { color: "#E05050", label: "Disapproved" },
        ].map(item => (
          <div key={item.label} style={{
            display: "flex", alignItems: "center", gap: 7,
            marginBottom: 4, fontFamily: "system-ui, sans-serif", fontSize: 11,
          }}>
            <div style={{
              width: 9, height: 9, borderRadius: "50%",
              background: item.color, flexShrink: 0,
            }} />
            <span style={{ color: "#555" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
