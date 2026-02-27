/**
 * CommissionMap.tsx — Interactive project map for the Commission page.
 *
 * All markers are orange CircleMarkers. One dot per unique geocoded address
 * (deduplication happens in Commission.tsx). Auto-fits to show all dots on
 * initial load. "Show All" resets the view.
 *
 * Two-way sync:
 *   Card expand  → MapController flies to that marker (selectedKey)
 *   Dot click    → onSelectMarker(address, keys) — parent decides expand vs. filter
 */
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import type { DistrictConfig } from "../districts";
import type { GeoFeature } from "../services/neighborhoodBoundaries";

// ── District defaults ─────────────────────────────────────────────────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "0":  [37.757, -122.440],
  "1":  [37.778, -122.477], "2":  [37.793, -122.434], "3":  [37.797, -122.406],
  "4":  [37.757, -122.493], "5":  [37.772, -122.440], "6":  [37.778, -122.413],
  "7":  [37.743, -122.457], "8":  [37.758, -122.440], "9":  [37.749, -122.413],
  "10": [37.748, -122.393], "11": [37.721, -122.435],
};
const DISTRICT_ZOOM: Record<string, number> = {
  "0": 12,
  "1": 14, "2": 14, "3": 15, "4": 13, "5": 14,
  "6": 14, "7": 14, "8": 14, "9": 14, "10": 13, "11": 14,
};

const ORANGE = "#D4643B";
const BOUNDARY_PANE = "cpBoundaryPane";

// ── Types ─────────────────────────────────────────────────────────────────────
/**
 * One entry per unique geocoded address in the visible card list.
 * `keys` lists the groupKeys of every card sharing that address.
 */
export interface CommissionMarker {
  key:     string;    // groupKey of first card at this location
  keys:    string[];  // all groupKeys at this location (length ≥ 1)
  address: string;
  lat:     number;
  lng:     number;
  count:   number;    // = keys.length
}

// ── District boundary dashed outline ─────────────────────────────────────────
function DistrictOutline({ districtBoundary }: { districtBoundary?: GeoFeature | null }) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!map.getPane(BOUNDARY_PANE)) {
      const pane = map.createPane(BOUNDARY_PANE);
      pane.style.zIndex = "390";
      pane.style.pointerEvents = "none";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (districtBoundary) {
      layerRef.current = L.geoJSON(districtBoundary as GeoJsonObject, {
        pane: BOUNDARY_PANE,
        style: () => ({ color: ORANGE, weight: 1.5, dashArray: "5 4", fillOpacity: 0, opacity: 0.45 }),
      }).addTo(map);
    }
    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtBoundary]);

  return null;
}

// ── Map controller ────────────────────────────────────────────────────────────
function MapController({
  markers,
  showAllTrigger,
  districtConfig,
  focusLat,
  focusLng,
}: {
  markers:        CommissionMarker[];
  showAllTrigger: number;
  districtConfig: DistrictConfig;
  focusLat:       number | null;
  focusLng:       number | null;
}) {
  const map = useMap();
  // Track which district we've auto-fitted so we don't jump when more cards load
  const fittedForDistrict = useRef<string>("");

  // Auto-fit to all markers the first time they arrive for the current district
  useEffect(() => {
    if (markers.length === 0) return;
    if (fittedForDistrict.current === districtConfig.number) return;
    const bounds = L.latLngBounds(markers.map(m => L.latLng(m.lat, m.lng)));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
      fittedForDistrict.current = districtConfig.number;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, districtConfig.number]);

  // "Show All" — fit to all markers with a smooth animation
  useEffect(() => {
    if (showAllTrigger === 0 || markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map(m => L.latLng(m.lat, m.lng)));
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 0.45 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllTrigger]);

  // Card expanded → fly to resolved coordinates.
  // Using primitive lat/lng (not selectedKey + marker-lookup) so this effect
  // also fires when geocoding completes after the card was already expanded.
  useEffect(() => {
    if (focusLat == null || focusLng == null) return;
    map.flyTo([focusLat, focusLng], 16, { duration: 0.45 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLat, focusLng]);

  return null;
}

// ── Public props ──────────────────────────────────────────────────────────────
export interface CommissionMapProps {
  markers:         CommissionMarker[];
  /** groupKey of the currently expanded card — used for dot highlighting */
  selectedKey:     string | null;
  /** Resolved lat/lng of the expanded card. Passed as primitives so the flyTo
   *  effect re-fires when geocoding completes, even if selectedKey hasn't changed. */
  focusLat?:       number | null;
  focusLng?:       number | null;
  /** Increment to trigger fit-all-markers animation */
  showAllTrigger:  number;
  districtConfig:  DistrictConfig;
  districtBoundary?: GeoFeature | null;
  onSelectMarker:  (address: string, keys: string[]) => void;
  onShowAll:       () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CommissionMap({
  markers,
  selectedKey,
  focusLat   = null,
  focusLng   = null,
  showAllTrigger,
  districtConfig,
  districtBoundary,
  onSelectMarker,
  onShowAll,
}: CommissionMapProps) {
  const center = DISTRICT_CENTERS[districtConfig.number] ?? [37.773, -122.431];
  const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;

  return (
    <div style={{
      position: "relative", marginBottom: 28,
      borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)", overflow: "hidden",
    }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: 240, width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <MapController
          markers={markers}
          focusLat={focusLat}
          focusLng={focusLng}
          showAllTrigger={showAllTrigger}
          districtConfig={districtConfig}
        />
        <DistrictOutline districtBoundary={districtBoundary} />

        {markers.map(m => {
          const isSelected = !!selectedKey && m.keys.includes(selectedKey);
          return (
            <CircleMarker
              key={m.key}
              center={[m.lat, m.lng]}
              radius={isSelected ? 9 : 6}
              pathOptions={{
                color:       isSelected ? "#8B3A1F" : ORANGE,
                fillColor:   ORANGE,
                fillOpacity: isSelected ? 1 : 0.82,
                weight:      isSelected ? 2.5 : 1.5,
              }}
              eventHandlers={{ click: () => onSelectMarker(m.address, m.keys) }}
            >
              <Popup>
                <div style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13, lineHeight: 1.5, minWidth: 150,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: "#1A1A2E" }}>
                    {m.address}
                  </div>
                  <div style={{ color: ORANGE, fontWeight: 600, fontSize: 12 }}>
                    {m.count === 1 ? "1 project" : `${m.count} projects here`}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* "Show All" reset button */}
      {markers.length > 0 && (
        <button
          onClick={onShowAll}
          style={{
            position: "absolute", bottom: 10, left: 12, zIndex: 1000,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(0,0,0,0.14)",
            borderRadius: 8, padding: "5px 12px",
            fontSize: 12, fontWeight: 600,
            fontFamily: "system-ui, sans-serif", color: "#3D3832",
            cursor: "pointer", backdropFilter: "blur(4px)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.09)",
          }}
        >
          Show All
        </button>
      )}

      {/* Project count badge */}
      {markers.length > 0 && (
        <div style={{
          position: "absolute", top: 10, right: 12, zIndex: 1000,
          background: "rgba(255,255,255,0.92)", borderRadius: 8,
          padding: "5px 10px", backdropFilter: "blur(4px)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#555",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, flexShrink: 0 }} />
          {markers.length} project{markers.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Attribution */}
      <div style={{
        position: "absolute", bottom: 5, right: 10, zIndex: 1000,
        fontSize: 10, color: "#bbb", fontFamily: "system-ui, sans-serif", pointerEvents: "none",
      }}>
        © OSM © CARTO
      </div>
    </div>
  );
}
