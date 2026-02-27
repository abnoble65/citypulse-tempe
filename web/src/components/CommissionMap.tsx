/**
 * CommissionMap.tsx — Compact context map for the Commission page.
 *
 * CartoDB Positron tiles, no zoom controls, 220px tall.
 * Markers are color-coded by action outcome (green / amber / red).
 * Clicking a marker fires onSelectMarker(key) for two-way card↔map sync.
 */
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, GeoJsonObject } from "geojson";
import type { DistrictConfig } from "../districts";
import type { GeoFeature } from "../services/neighborhoodBoundaries";

// ── District center coordinates ─────────────────────────────────────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "0":  [37.757, -122.440], // SF citywide
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
  "0": 12,
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

// ── Boundary path style (shared logic with MapView) ─────────────────────────
function boundaryStyle(name: string, activeNeighborhoodName: string | null): L.PathOptions {
  const hasActive = !!activeNeighborhoodName;
  const isActive  = name === activeNeighborhoodName;
  return {
    className:   "cp-boundary",
    color:       "#D4643B",
    fillColor:   "#D4643B",
    weight:      hasActive && isActive ? 2 : 1,
    opacity:     hasActive ? (isActive ? 0.85 : 0.12) : 0.30,
    fillOpacity: hasActive ? (isActive ? 0.10 : 0.02) : 0.04,
    fill:        true,
  };
}

const BOUNDARY_PANE = "cpBoundaryPane";

function BoundaryLayer({
  boundaries,
  activeNeighborhoodName,
  districtBoundary,
}: {
  boundaries: Map<string, Feature>;
  activeNeighborhoodName: string | null;
  districtBoundary?: GeoFeature | null;
}) {
  const map = useMap();
  const layersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const districtLayerRef = useRef<L.GeoJSON | null>(null);

  // Dedicated pane below overlayPane so boundaries never obscure markers.
  useEffect(() => {
    if (!map.getPane(BOUNDARY_PANE)) {
      map.createPane(BOUNDARY_PANE);
      const pane = map.getPane(BOUNDARY_PANE)!;
      pane.style.zIndex = "390";
      pane.style.pointerEvents = "none";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const [, layer] of layersRef.current) map.removeLayer(layer);
    layersRef.current.clear();

    for (const [name, feature] of boundaries) {
      const layer = L.geoJSON(feature as GeoJsonObject, {
        pane: BOUNDARY_PANE,
        style: () => boundaryStyle(name, activeNeighborhoodName),
      }).addTo(map);
      layersRef.current.set(name, layer);
    }

    return () => {
      for (const [, layer] of layersRef.current) map.removeLayer(layer);
      layersRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaries]);

  useEffect(() => {
    for (const [name, layer] of layersRef.current) {
      layer.setStyle(boundaryStyle(name, activeNeighborhoodName));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNeighborhoodName]);

  // District outline — dashed orange, no fill
  useEffect(() => {
    if (districtLayerRef.current) {
      map.removeLayer(districtLayerRef.current);
      districtLayerRef.current = null;
    }
    if (districtBoundary) {
      districtLayerRef.current = L.geoJSON(districtBoundary as GeoJsonObject, {
        pane: BOUNDARY_PANE,
        style: () => ({ color: "#D4643B", weight: 2.5, dashArray: "6 4", fillOpacity: 0, opacity: 0.75 }),
      }).addTo(map);
    }
    return () => {
      if (districtLayerRef.current) {
        map.removeLayer(districtLayerRef.current);
        districtLayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtBoundary]);

  return null;
}

// ── Inner controller (must live inside MapContainer) ────────────────────────
function MapController({
  markers,
  selectedKey,
  districtConfig,
  boundaries,
  activeNeighborhoodName,
  districtBoundary,
}: {
  markers: CommissionMarker[];
  selectedKey: string | null;
  districtConfig: DistrictConfig;
  boundaries?: Map<string, Feature>;
  activeNeighborhoodName?: string | null;
  districtBoundary?: GeoFeature | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Priority 1: selected marker
    if (selectedKey) {
      const m = markers.find(mk => mk.key === selectedKey);
      if (m) {
        map.flyTo([m.lat, m.lng], 16, { duration: 0.5 });
        return;
      }
    }
    // Priority 2: neighborhood filter → zoom to boundary
    if (activeNeighborhoodName && boundaries) {
      const feature = boundaries.get(activeNeighborhoodName);
      if (feature) {
        const bounds = L.geoJSON(feature as GeoJsonObject).getBounds();
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 16, duration: 0.6 });
          return;
        }
      }
    }
    // Priority 2.5: district boundary fit
    if (!activeNeighborhoodName && districtBoundary) {
      const bounds = L.geoJSON(districtBoundary as GeoJsonObject).getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [32, 32], maxZoom: 14, duration: 0.6 });
        return;
      }
    }
    // Priority 3: district center
    const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
    const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;
    map.flyTo(center, zoom, { duration: 0.5 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, activeNeighborhoodName, districtConfig.number, districtBoundary]);

  return null;
}

// ── Public component ─────────────────────────────────────────────────────────
export interface CommissionMapProps {
  markers: CommissionMarker[];
  selectedKey: string | null;
  districtConfig: DistrictConfig;
  onSelectMarker: (key: string) => void;
  boundaries?: Map<string, Feature>;
  activeNeighborhoodName?: string | null;
  districtBoundary?: GeoFeature | null;
}

export function CommissionMap({
  markers,
  selectedKey,
  districtConfig,
  onSelectMarker,
  boundaries,
  activeNeighborhoodName = null,
  districtBoundary,
}: CommissionMapProps) {
  const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
  const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;

  return (
    <div style={{
      position: "relative", marginBottom: 28,
      borderRadius: 20,
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      overflow: "hidden",  // clips map corners without needing radius on inner div
    }}>
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
          boundaries={boundaries}
          activeNeighborhoodName={activeNeighborhoodName}
          districtBoundary={districtBoundary}
        />
        {boundaries && boundaries.size > 0 && (
          <BoundaryLayer
            boundaries={boundaries}
            activeNeighborhoodName={activeNeighborhoodName}
            districtBoundary={districtBoundary}
          />
        )}
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

      {/* Legend — only shown once markers are present */}
      {markers.length > 0 && <div style={{
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
      </div>}
    </div>
  );
}
