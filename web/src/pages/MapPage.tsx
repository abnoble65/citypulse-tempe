/**
 * MapPage.tsx — Full-screen Leaflet map at /map.
 *
 * Layers (toggleable):
 *   • Building Permits    — DataSF 83ki-hu3p, color by type, size by cost
 *   • Eviction Notices    — DataSF 5cei-gny5, red circles
 *   • Affordable Housing  — DataSF aaxw-2cb8, geocoded, green squares
 *   • Neighborhoods       — DataSF jwn9-ihcz, outline + labels
 *
 * FilterBar selects neighborhood → map zooms to polygon.
 * Map fills calc(100vh - 60px) with FilterBar inside via flex.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  GeoJSON,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { geocodeAddresses } from "../services/geocoder";
import type { DistrictConfig } from "../districts";
import { loadNeighborhoodBoundaries } from "../utils/geoFilter";
import { ViewIn3DButton } from "../components/ViewIn3D";
import { cleanPermitLabel } from "../services/aggregator";

// ── Constants ─────────────────────────────────────────────────────────────────

const DATASF = "https://data.sfgov.org/resource";

const MAPBOX_TILE_URL =
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN ?? ""}`;

const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "0":  [37.757, -122.440],
  "1":  [37.778, -122.477], "2":  [37.793, -122.434], "3":  [37.797, -122.406],
  "4":  [37.757, -122.493], "5":  [37.772, -122.440], "6":  [37.778, -122.413],
  "7":  [37.743, -122.457], "8":  [37.758, -122.440], "9":  [37.749, -122.413],
  "10": [37.748, -122.393], "11": [37.721, -122.435],
};
const DISTRICT_ZOOM: Record<string, number> = {
  "0": 12,
  "1": 14, "2": 14, "3": 14, "4": 13, "5": 14,
  "6": 14, "7": 14, "8": 14, "9": 14, "10": 13, "11": 14,
};

// ── Permit type helpers ────────────────────────────────────────────────────────

type PermitType = "new" | "alteration" | "demolition" | "other";

function classifyPermit(def: string | null): PermitType {
  const s = (def ?? "").toLowerCase();
  if (s.includes("new construction"))                    return "new";
  if (s.includes("demolition"))                          return "demolition";
  if (s.includes("alteration") || s.includes("addition") ||
      s.includes("repair")     || s.includes("otc"))     return "alteration";
  return "other";
}

const PERMIT_COLOR: Record<PermitType, string> = {
  new:        "#B44040",
  alteration: "#4A7FD0",
  demolition: "#F59E0B",
  other:      "#8b8b8b",
};

const EVICTION_COLOR  = "#991b1b";
const AFFORDABLE_COLOR = "#22c55e";

function permitRadius(cost: number | null): number {
  if (!cost || cost <= 0) return 8;
  if (cost <    50_000)   return 8;
  if (cost <   250_000)   return 11;
  if (cost < 1_000_000)   return 14;
  if (cost < 5_000_000)   return 18;
  return 22;
}

function fmtCost(cost: number | null): string {
  if (!cost || cost <= 0) return "—";
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(2)}M`;
  if (cost >= 1_000)     return `$${Math.round(cost / 1_000)}K`;
  return `$${cost}`;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

function flatCoords(c: unknown): number[][] {
  if (!Array.isArray(c)) return [];
  if (typeof c[0] === "number") return [c as number[]];
  return (c as unknown[]).flatMap(flatCoords);
}

function boundsFromCoords(c: unknown): L.LatLngBounds | null {
  const pairs = flatCoords(c);
  if (!pairs.length) return null;
  const latlngs = pairs.map(([lng, lat]) => L.latLng(lat, lng));
  return L.latLngBounds(latlngs);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface MapPageProps {
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

interface LayerState {
  permits:      boolean;
  evictions:    boolean;
  affordable:   boolean;
  neighborhoods: boolean;
}

interface PermitRow {
  permit_number?:          string;
  street_number?:          string;
  street_name?:            string;
  street_suffix?:          string;
  permit_type_definition?: string;
  estimated_cost?:         string | number;
  status?:                 string;
  description?:            string;
  location?:               { type: string; coordinates: [number, number] };
}

interface EvictionRow {
  address?:                string;
  file_date?:              string;
  non_payment?:            boolean;
  owner_move_in?:          boolean;
  ellis_act_withdrawal?:   boolean;
  breach?:                 boolean;
  neighborhood?:           string;
  shape?:                  { type: string; coordinates: [number, number] };
}

interface AHRow {
  project_id:                          string;
  project_name?:                       string;
  plannning_approval_address?:         string;
  project_status:                      string;
  total_project_units?:                string;
  mohcd_affordable_units?:             string;
  affordable_percent?:                 string;
  estimated_construction_completion?:  string;
}

interface AHMarker {
  lat: number;
  lng: number;
  name: string;
  address: string;
  status: string;
  units: string;
  pct: string;
  completion: string;
}

// ── Layer toggle panel ────────────────────────────────────────────────────────

const LAYER_META: { key: keyof LayerState; label: string; color: string }[] = [
  { key: "permits",       label: "Building Permits",        color: "#4A7FD0" },
  { key: "affordable",    label: "Affordable Housing",      color: AFFORDABLE_COLOR },
  { key: "evictions",     label: "Eviction Notices",        color: EVICTION_COLOR },
  { key: "neighborhoods", label: "Neighborhood Boundaries", color: "#94a3b8" },
];

function LayerPanel({
  layers, onChange,
}: {
  layers:   LayerState;
  onChange: (key: keyof LayerState, val: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      position: "absolute", top: 12, right: 12, zIndex: 1000,
      background: "rgba(255,255,255,0.97)", borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
      overflow: "hidden", minWidth: 218,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "10px 14px",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: FONTS.heading, fontWeight: 700, fontSize: 13,
          color: COLORS.charcoal,
          borderBottom: open ? `1px solid ${COLORS.lightBorder}` : "none",
        }}
      >
        Layers
        <span style={{ fontSize: 10, color: COLORS.warmGray }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "8px 14px 12px" }}>
          {LAYER_META.map(({ key, label, color }) => (
            <label key={key} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "5px 0", cursor: "pointer", userSelect: "none",
              fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal,
            }}>
              <input
                type="checkbox" checked={layers[key]}
                onChange={e => onChange(key, e.target.checked)}
                style={{ accentColor: color, width: 14, height: 14, cursor: "pointer" }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: color, flexShrink: 0,
                }} />
                {label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Map legend (bottom-left) ──────────────────────────────────────────────────

function MapLegend({ layers }: { layers: LayerState }) {
  return (
    <div style={{
      position: "absolute", bottom: 36, left: 12, zIndex: 1000,
      background: "rgba(255,255,255,0.95)", borderRadius: 10,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
      padding: "8px 12px",
    }}>
      {/* Permit sub-types */}
      {layers.permits && (
        <>
          <div style={{
            fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
            color: COLORS.warmGray, textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 5,
          }}>
            Permits
          </div>
          {([
            { label: "New Construction", color: PERMIT_COLOR.new },
            { label: "Alteration",       color: PERMIT_COLOR.alteration },
            { label: "Demolition",       color: PERMIT_COLOR.demolition },
            { label: "Other",            color: PERMIT_COLOR.other },
          ] as const).map(({ label, color }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "2px 0", fontFamily: FONTS.body,
              fontSize: 11, color: COLORS.charcoal,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: color, flexShrink: 0,
              }} />
              {label}
            </div>
          ))}
          <div style={{
            fontFamily: FONTS.body, fontSize: 10,
            color: COLORS.warmGray, marginTop: 4, fontStyle: "italic",
          }}>
            Circle size = estimated cost
          </div>
        </>
      )}

      {/* Affordable Housing */}
      {layers.affordable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          marginTop: layers.permits ? 8 : 0, paddingTop: layers.permits ? 6 : 0,
          borderTop: layers.permits ? `1px solid ${COLORS.lightBorder}` : "none",
          fontFamily: FONTS.body, fontSize: 11, color: COLORS.charcoal,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: "50%",
            background: AFFORDABLE_COLOR, flexShrink: 0,
          }} />
          Affordable Housing
        </div>
      )}

      {/* Eviction Notices */}
      {layers.evictions && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          marginTop: (layers.permits || layers.affordable) ? 6 : 0,
          paddingTop: (layers.permits || layers.affordable) ? 6 : 0,
          borderTop: (layers.permits || layers.affordable) ? `1px solid ${COLORS.lightBorder}` : "none",
          fontFamily: FONTS.body, fontSize: 11, color: COLORS.charcoal,
        }}>
          <span style={{
            width: 10, height: 10,
            background: EVICTION_COLOR,
            flexShrink: 0,
            transform: "rotate(45deg)",
          }} />
          Eviction Notice
        </div>
      )}
    </div>
  );
}

// ── Map view controller (flies to neighborhood on filter change) ──────────────

function MapController({
  districtConfig, filter,
}: {
  districtConfig: DistrictConfig;
  filter: string;
}) {
  const map = useMap();

  useEffect(() => {
    const nh = districtConfig.neighborhoods.find(n => n.name === filter);
    const geoName = nh?.geoName ?? null;

    if (!geoName) {
      const center = DISTRICT_CENTERS[districtConfig.number] ?? DISTRICT_CENTERS["3"];
      const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;
      map.flyTo(center, zoom, { duration: 0.65 });
      return;
    }

    loadNeighborhoodBoundaries().then(boundaries => {
      const feat = boundaries.get(geoName);
      if (!feat) return;
      const bounds = boundsFromCoords(feat.geometry.coordinates);
      if (bounds) map.flyToBounds(bounds.pad(0.15), { duration: 0.65 });
    });
  }, [map, districtConfig, filter]);

  return null;
}

// ── Neighborhood labels (SVG overlay) ─────────────────────────────────────────

function NeighborhoodLabels({ geojson }: { geojson: GeoJSON.FeatureCollection | null }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!geojson) return;

    const group = L.layerGroup();
    for (const feat of geojson.features) {
      const name = feat.properties?.name;
      if (!name) continue;
      // Compute centroid from coordinates
      const coords = flatCoords((feat.geometry as any).coordinates);
      if (!coords.length) continue;
      let sumLat = 0, sumLng = 0;
      for (const [lng, lat] of coords) { sumLat += lat; sumLng += lng; }
      const centroid = L.latLng(sumLat / coords.length, sumLng / coords.length);

      const icon = L.divIcon({
        className: "nh-label",
        html: `<span style="
          font-family: ${FONTS.body};
          font-size: 14px;
          font-weight: 700;
          color: rgba(55,75,115,0.95);
          background: rgba(255,255,255,0.75);
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          pointer-events: none;
        ">${name}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(centroid, { icon, interactive: false }).addTo(group);
    }
    group.addTo(map);
    layerRef.current = group;

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map, geojson]);

  return null;
}

// ── Main page component ───────────────────────────────────────────────────────

export function MapPage({ districtConfig, onNavigate }: MapPageProps) {
  const [filter, setFilter] = useState(districtConfig.allLabel);
  const [layers, setLayers] = useState<LayerState>({
    permits: true, evictions: false, affordable: true, neighborhoods: true,
  });

  const [permits, setPermits]       = useState<PermitRow[]>([]);
  const [evictions, setEvictions]   = useState<EvictionRow[]>([]);
  const [ahMarkers, setAhMarkers]  = useState<AHMarker[]>([]);
  const [nhGeoJSON, setNhGeoJSON]  = useState<GeoJSON.FeatureCollection | null>(null);
  const [districtGeoJSON, setDistrictGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);

  const center = DISTRICT_CENTERS[districtConfig.number] ?? DISTRICT_CENTERS["3"];
  const zoom   = DISTRICT_ZOOM[districtConfig.number]   ?? 14;

  // ── Commission popup link handler ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: CustomEvent) => onNavigate(e.detail as string);
    window.addEventListener("cp-nav", handler as EventListener);
    return () => window.removeEventListener("cp-nav", handler as EventListener);
  }, [onNavigate]);

  // ── Reset filter when district changes ─────────────────────────────────────
  useEffect(() => { setFilter(districtConfig.allLabel); }, [districtConfig.allLabel]);

  // ── Fetch building permits (DataSF i98e-djp9) ───────────────────────────────
  useEffect(() => {
    const distWhere = districtConfig.number === "0"
      ? `location IS NOT NULL`
      : `supervisor_district='${districtConfig.number}' AND location IS NOT NULL`;

    const params = new URLSearchParams({
      $where:  distWhere,
      $select: "permit_number,street_number,street_name,street_suffix,permit_type_definition,estimated_cost,status,description,location",
      $limit:  "1500",
      $order:  "estimated_cost DESC",
    });

    fetch(`${DATASF}/i98e-djp9.json?${params}`)
      .then(r => r.json())
      .then((rows: PermitRow[]) => {
        const valid = rows.filter(r => r.location?.coordinates);
        console.log(`[MapPage] permits: ${rows.length} total, ${valid.length} with coords`);
        setPermits(valid);
      })
      .catch(err => console.warn("[MapPage] permits fetch failed:", err));
  }, [districtConfig]);

  // ── Fetch evictions (DataSF 5cei-gny5) ───────────────────────────────────────
  useEffect(() => {
    const evictWhere = districtConfig.number === "0"
      ? `file_date>'2019-01-01'`
      : `supervisor_district='${districtConfig.number}' AND file_date>'2019-01-01'`;

    const params = new URLSearchParams({
      $where:  evictWhere,
      $select: "address,file_date,non_payment,owner_move_in,ellis_act_withdrawal,breach,neighborhood,shape",
      $limit:  "1200",
    });

    fetch(`${DATASF}/5cei-gny5.json?${params}`)
      .then(r => r.json())
      .then((rows: EvictionRow[]) => {
        const valid = rows.filter(r => r.shape?.coordinates);
        console.log(`[MapPage] evictions: ${rows.length} total, ${valid.length} with coords`);
        setEvictions(valid);
      })
      .catch(err => console.warn("[MapPage] evictions fetch failed:", err));
  }, [districtConfig]);

  // ── Fetch affordable housing + geocode ─────────────────────────────────────
  useEffect(() => {
    const ahWhere = districtConfig.number === "0"
      ? "project_id IS NOT NULL"
      : `supervisor_district='${districtConfig.number}'`;

    const params = new URLSearchParams({
      $where:  ahWhere,
      $select: "project_id,project_name,plannning_approval_address,project_status,total_project_units,mohcd_affordable_units,affordable_percent,estimated_construction_completion",
      $limit:  "200",
    });

    fetch(`${DATASF}/aaxw-2cb8.json?${params}`)
      .then(r => r.json())
      .then(async (projects: AHRow[]) => {
        const addresses = projects
          .map(p => p.plannning_approval_address)
          .filter((a): a is string => !!a && a.length > 3);

        const coordMap = await geocodeAddresses(addresses);

        const markers: AHMarker[] = projects
          .filter(p => p.plannning_approval_address && coordMap.has(p.plannning_approval_address))
          .map(p => {
            const ll  = coordMap.get(p.plannning_approval_address!)!;
            const pct = p.affordable_percent
              ? `${Math.round(parseFloat(p.affordable_percent))}%`
              : "—";
            const completion = p.estimated_construction_completion
              ? new Date(p.estimated_construction_completion).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : "—";
            return {
              lat: ll.lat, lng: ll.lng,
              name:       p.project_name ?? "Affordable Housing Project",
              address:    p.plannning_approval_address ?? "",
              status:     p.project_status ?? "—",
              units:      p.mohcd_affordable_units ?? p.total_project_units ?? "—",
              pct,
              completion,
            };
          });
        setAhMarkers(markers);
      })
      .catch(err => console.warn("[MapPage] affordable housing fetch failed:", err));
  }, [districtConfig]);

  // ── Fetch neighborhood boundaries GeoJSON ──────────────────────────────────
  useEffect(() => {
    fetch(`${DATASF}/jwn9-ihcz.geojson?$limit=200`)
      .then(r => r.json())
      .then((geojson: unknown) => {
        const g = geojson as { type?: string; features?: unknown[]; error?: boolean };
        if (g.error || g.type !== "FeatureCollection" || !Array.isArray(g.features)) {
          console.warn("[MapPage] neighborhoods: invalid GeoJSON", g);
          return;
        }
        setNhGeoJSON(geojson as GeoJSON.FeatureCollection);
      })
      .catch(err => console.warn("[MapPage] neighborhoods fetch failed:", err));
  }, []);

  // ── Fetch supervisor district boundary (for "All District X" outline) ────
  useEffect(() => {
    if (districtConfig.number === "0") { setDistrictGeoJSON(null); return; }
    const url = `${DATASF}/f2zs-jevy.geojson?$where=sup_dist_num='${districtConfig.number}'&$limit=1`;
    fetch(url)
      .then(r => r.json())
      .then((geojson: unknown) => {
        // Validate: must be a FeatureCollection with at least one feature
        const g = geojson as { type?: string; features?: unknown[]; error?: boolean };
        if (g.error || g.type !== "FeatureCollection" || !Array.isArray(g.features) || g.features.length === 0) {
          console.warn("[MapPage] district boundary: invalid GeoJSON or no features", g);
          setDistrictGeoJSON(null);
          return;
        }
        setDistrictGeoJSON(geojson as GeoJSON.FeatureCollection);
      })
      .catch(err => { console.warn("[MapPage] district boundary fetch failed:", err); setDistrictGeoJSON(null); });
  }, [districtConfig]);

  // ── Layer toggle ──────────────────────────────────────────────────────────
  const toggleLayer = useCallback((key: keyof LayerState, val: boolean) => {
    setLayers(prev => ({ ...prev, [key]: val }));
  }, []);

  // Resolve selected neighborhood geoName for highlighting
  const selectedGeoName = useMemo(() => {
    const nh = districtConfig.neighborhoods.find(n => n.name === filter);
    return nh?.geoName ?? null;
  }, [districtConfig, filter]);

  // Compute bounding box of selected neighborhood for marker filtering
  const selectedBounds = useMemo(() => {
    if (!selectedGeoName || !nhGeoJSON) return null;
    const feat = nhGeoJSON.features.find(f => f.properties?.name === selectedGeoName);
    if (!feat) return null;
    return boundsFromCoords((feat.geometry as any).coordinates);
  }, [selectedGeoName, nhGeoJSON]);

  // Pre-filter marker data by bounds so React sees different arrays (not nulls inside .map)
  const filteredPermits = useMemo(() => {
    const valid = permits.filter(r => {
      if (!r.location?.coordinates) return false;
      const [lng, lat] = r.location.coordinates;
      if (isNaN(lat) || isNaN(lng)) return false;
      if (selectedBounds && !selectedBounds.contains(L.latLng(lat, lng))) return false;
      return true;
    });
    return valid;
  }, [permits, selectedBounds]);

  const filteredEvictions = useMemo(() => {
    return evictions.filter(r => {
      if (!r.shape?.coordinates) return false;
      const [lng, lat] = r.shape.coordinates;
      if (isNaN(lat) || isNaN(lng)) return false;
      if (selectedBounds && !selectedBounds.contains(L.latLng(lat, lng))) return false;
      return true;
    });
  }, [evictions, selectedBounds]);

  const filteredAffordable = useMemo(() => {
    return ahMarkers.filter(m => !selectedBounds || selectedBounds.contains(L.latLng(m.lat, m.lng)));
  }, [ahMarkers, selectedBounds]);

  // GeoJSON key must change when data OR selection changes to force re-render
  const nhKey = useMemo(
    () => `nh-${nhGeoJSON ? nhGeoJSON.features.length : 0}-${selectedGeoName ?? "all"}`,
    [nhGeoJSON, selectedGeoName],
  );

  const nhStyle = useCallback((feature: GeoJSON.Feature | undefined) => {
    if (!feature) return {};
    const name = feature.properties?.name;
    const isSelected = selectedGeoName && name === selectedGeoName;
    const base = isSelected
      ? { color: "#E8652D", weight: 3, fillColor: "#E8652D", fillOpacity: 0.08 }
      : { color: "#94a3b8", weight: 1, fillColor: "transparent", fillOpacity: 0 };
    return { ...base, interactive: false };
  }, [selectedGeoName]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ width: "100%", height: "100%" }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url={MAPBOX_TILE_URL}
            attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
            tileSize={512}
            zoomOffset={-1}
          />

          <MapController districtConfig={districtConfig} filter={filter} />

          {/* District boundary outline (shown when "All District X" is selected) */}
          {!selectedGeoName && districtGeoJSON && layers.neighborhoods && (
            <GeoJSON
              key={`dist-${districtConfig.number}`}
              data={districtGeoJSON}
              style={() => ({
                color: "#E8652D", weight: 3,
                fillColor: "#E8652D", fillOpacity: 0.04,
                interactive: false,
              })}
            />
          )}

          {/* Neighborhood Boundaries */}
          {layers.neighborhoods && nhGeoJSON && (
            <>
              <GeoJSON
                key={nhKey}
                data={nhGeoJSON}
                style={nhStyle}
              />
              <NeighborhoodLabels geojson={nhGeoJSON} />
            </>
          )}

          {/* Building Permits */}
          {layers.permits && filteredPermits.map((r) => {
            const [lng, lat] = r.location!.coordinates;
            const cost  = r.estimated_cost != null ? parseFloat(String(r.estimated_cost)) : null;
            const ptype = classifyPermit(r.permit_type_definition ?? null);
            const color = PERMIT_COLOR[ptype];
            const addr = [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" ") || "Unknown address";

            return (
              <CircleMarker
                key={`p-${r.permit_number ?? `${lat},${lng}`}`}
                center={[lat, lng]}
                radius={permitRadius(cost)}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: color,
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                    <strong>{addr}</strong>
                    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Type</td><td>{cleanPermitLabel(r.permit_type_definition ?? "Permit")}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Status</td><td>{(r.status ?? "—").replace(/\b\w/g, c => c.toUpperCase())}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Est. Cost</td><td>{fmtCost(cost)}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Permit #</td><td>{r.permit_number ?? ""}</td></tr>
                      </tbody>
                    </table>
                    {r.description && (
                      <p style={{ margin: "8px 0 4px", fontSize: 12, color: COLORS.midGray }}>{(r.description).slice(0, 160)}</p>
                    )}
                    <ViewIn3DButton compact payload={{
                      address: addr, lat, lng, parcel_apn: null,
                      district: districtConfig.label,
                      active_layers: ["permits"],
                    }} />
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Eviction Notices — diamond markers */}
          {layers.evictions && filteredEvictions.map((r) => {
            const [lng, lat] = r.shape!.coordinates;

            const fmtBool = (v: boolean | undefined) => v === true ? "Yes" : v === false ? "No" : "—";
            const fmtDate = (d?: string) => {
              if (!d) return "—";
              try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
              catch { return d; }
            };

            const icon = L.divIcon({
              className: "",
              html: `<div style="
                width:12px;height:12px;
                background:${EVICTION_COLOR};
                border:2px solid #fff;
                transform:rotate(45deg);
                box-shadow:0 1px 4px rgba(0,0,0,0.3);
              "></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });

            return (
              <Marker
                key={`e-${r.address ?? ''}-${lat},${lng}`}
                position={[lat, lng]}
                icon={icon}
              >
                <Popup>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                    <strong>Eviction Notice — {r.address ?? "Unknown"}</strong>
                    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Date Filed</td><td>{fmtDate(r.file_date)}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Non-Payment</td><td>{fmtBool(r.non_payment)}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Owner Move-In</td><td>{fmtBool(r.owner_move_in)}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Ellis Act</td><td>{fmtBool(r.ellis_act_withdrawal)}</td></tr>
                        <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Breach</td><td>{fmtBool(r.breach)}</td></tr>
                      </tbody>
                    </table>
                    <ViewIn3DButton compact payload={{
                      address: r.address ?? null, lat, lng, parcel_apn: null,
                      district: districtConfig.label,
                      active_layers: ["evictions"],
                    }} />
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Affordable Housing */}
          {layers.affordable && filteredAffordable.map((m) => (
            <CircleMarker
              key={`ah-${m.address}-${m.lat},${m.lng}`}
              center={[m.lat, m.lng]}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: AFFORDABLE_COLOR,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                  <strong>{m.name}</strong>
                  <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
                    <tbody>
                      <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Address</td><td>{m.address}</td></tr>
                      <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Status</td><td>{m.status}</td></tr>
                      <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Affordable Units</td><td>{m.units}</td></tr>
                      <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>% Affordable</td><td>{m.pct}</td></tr>
                      <tr><td style={{ color: COLORS.warmGray, paddingRight: 10 }}>Est. Completion</td><td>{m.completion}</td></tr>
                    </tbody>
                  </table>
                  <ViewIn3DButton compact payload={{
                    address: m.address, lat: m.lat, lng: m.lng, parcel_apn: null,
                    district: districtConfig.label,
                    active_layers: ["affordable"],
                  }} />
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Floating layer toggle panel */}
        <LayerPanel layers={layers} onChange={toggleLayer} />

        {/* Map legend */}
        {(layers.permits || layers.affordable || layers.evictions) && <MapLegend layers={layers} />}
      </div>
    </div>
  );
}
