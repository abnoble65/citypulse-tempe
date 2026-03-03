/**
 * EsriMap.tsx — Full-screen ArcGIS map page for CityPulse.
 *
 * Layers (all toggleable):
 *   • Active Projects  — geocoded Supabase rows, color-coded by project type
 *   • Eviction Notices — DataSF 5cei-gny5, clustered red dots
 *   • Zoning           — DataSF 3i4a-hu95, semi-transparent polygons (off by default)
 *   • Neighborhoods    — DataSF jwn9-ihcz, outline + labels
 *
 * Filtering: selecting a neighborhood pill zooms the map to that polygon's extent.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { supabase } from "../services/supabase";
import type { DistrictConfig } from "../districts";
import { loadNeighborhoodBoundaries } from "../utils/geoFilter";

// ── ArcGIS SDK ────────────────────────────────────────────────────────────────
// Configure BEFORE other @arcgis imports.
import esriConfig from "@arcgis/core/config";
esriConfig.assetsPath = "/arcgis/assets";
if (import.meta.env.VITE_ARCGIS_API_KEY) {
  esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY as string;
}

// Alias Map to avoid conflict with JS built-in Map and our exported EsriMap function
import ArcGISMap      from "@arcgis/core/Map";
import ArcGISMapView  from "@arcgis/core/views/MapView";
import GraphicsLayer  from "@arcgis/core/layers/GraphicsLayer";
import GeoJSONLayer   from "@arcgis/core/layers/GeoJSONLayer";
import Graphic        from "@arcgis/core/Graphic";
import Point          from "@arcgis/core/geometry/Point";
import Extent         from "@arcgis/core/geometry/Extent";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol   from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleFillSymbol   from "@arcgis/core/symbols/SimpleFillSymbol";
import PopupTemplate      from "@arcgis/core/PopupTemplate";
import Color              from "@arcgis/core/Color";

// ── Constants ─────────────────────────────────────────────────────────────────

const SF_CENTER = { lat: 37.7749, lng: -122.4194 };
const SF_ZOOM   = 13;
const DATASF    = "https://data.sfgov.org/resource";

// Color tuples [r, g, b, a] — RGB 0-255, alpha 0-1
const CLR = {
  affordable: [76,  153, 100, 0.9] as [number,number,number,number],
  demolition: [180,  50,  50, 0.9] as [number,number,number,number],
  standard:   [212, 100,  59, 0.9] as [number,number,number,number],
  evicDot:    [200,  50,  50, 1.0] as [number,number,number,number],
};

function zoningFill(code: string): [number,number,number,number] {
  const c = (code ?? "").toUpperCase();
  if (/^R(H|M|C|E)/.test(c))      return [100, 160, 220, 0.30];
  if (/^(NC|C-)/.test(c))          return [220, 200,  80, 0.30];
  if (/^(M-|PDR)/.test(c))         return [150, 150, 150, 0.30];
  if (/^(P|OS)/.test(c))           return [100, 180, 100, 0.30];
  return [200, 160, 120, 0.25];
}

function projectColors(desc: string | null): [number,number,number,number] {
  const d = (desc ?? "").toLowerCase();
  if (d.includes("affordable") || d.includes("bmr") || d.includes("below market"))
    return CLR.affordable;
  if (d.includes("demolition") || d.includes("ellis act"))
    return CLR.demolition;
  return CLR.standard;
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface EsriMapPageProps {
  districtConfig: DistrictConfig;
  onNavigate:     (page: string) => void;
}

interface LayerState {
  projects:      boolean;
  evictions:     boolean;
  zoning:        boolean;
  neighborhoods: boolean;
}

interface SupabaseProject {
  id:                  string;
  address:             string | null;
  lat:                 number;
  lng:                 number;
  project_description: string | null;
  action:              string | null;
  case_number:         string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flatten nested coordinate arrays down to [lng, lat] pairs for bbox calculation. */
function flatCoords(c: unknown): number[][] {
  if (!Array.isArray(c)) return [];
  if (typeof c[0] === "number") return [c as number[]];
  return (c as unknown[]).flatMap(flatCoords);
}

function extentFromCoords(c: unknown): Extent | null {
  const pairs = flatCoords(c);
  if (!pairs.length) return null;
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const [x, y] of pairs) {
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }
  return isFinite(xmin)
    ? new Extent({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } })
    : null;
}

// ── Layer toggle panel ────────────────────────────────────────────────────────

const LAYER_META: { key: keyof LayerState; label: string; color: string }[] = [
  { key: "projects",      label: "Active Projects",          color: COLORS.orange },
  { key: "evictions",     label: "Eviction Notices",         color: "#B43232" },
  { key: "neighborhoods", label: "Neighborhood Boundaries",  color: "#4A6FA5" },
  { key: "zoning",        label: "Zoning Districts",         color: "#B49A32" },
];

function LayerPanel({
  layers,
  onChange,
}: {
  layers:   LayerState;
  onChange: (key: keyof LayerState, val: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      position: "absolute", top: 12, right: 12, zIndex: 10,
      background: COLORS.white, borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
      overflow: "hidden", minWidth: 210,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", fontFamily: FONTS.heading,
          fontWeight: 700, fontSize: 13, color: COLORS.charcoal,
        }}
      >
        Layers
        <span style={{ fontSize: 10, color: COLORS.warmGray }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          {LAYER_META.map(({ key, label, color }) => (
            <label key={key} style={{
              display: "flex", alignItems: "center", gap: 9, paddingBottom: 9,
              cursor: "pointer", userSelect: "none",
              fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal,
            }}>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={e => onChange(key, e.target.checked)}
                style={{ accentColor: color, width: 14, height: 14, cursor: "pointer" }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                {label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export function EsriMap({ districtConfig, onNavigate }: EsriMapPageProps) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const viewRef          = useRef<ArcGISMapView | null>(null);
  const projectsLayerRef = useRef<GraphicsLayer  | null>(null);
  const evictLayerRef    = useRef<GeoJSONLayer   | null>(null);
  const zoningLayerRef   = useRef<GeoJSONLayer   | null>(null);
  const nhLayerRef       = useRef<GeoJSONLayer   | null>(null);

  const [filter, setFilter] = useState(districtConfig.allLabel);
  const [layers, setLayers] = useState<LayerState>({
    projects:      true,
    evictions:     true,
    zoning:        false,
    neighborhoods: true,
  });
  const [mapReady, setMapReady] = useState(false);

  // ── Initialise map once ───────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    // Inject ArcGIS light-theme CSS
    if (!document.getElementById("arcgis-css")) {
      const link     = document.createElement("link");
      link.id        = "arcgis-css";
      link.rel       = "stylesheet";
      link.href      = "/arcgis/assets/esri/themes/light/main.css";
      document.head.appendChild(link);
    }

    // ── Evictions layer ───────────────────────────────────────────────────
    const evictUrl = districtConfig.number === "0"
      ? `${DATASF}/5cei-gny5.geojson?$limit=1500&$where=file_date>'2020-01-01'`
      : `${DATASF}/5cei-gny5.geojson?$limit=800&$where=supervisor_district='${districtConfig.number}' AND file_date>'2018-01-01'`;

    const evictLayer = new GeoJSONLayer({
      url:     evictUrl,
      title:   "Eviction Notices",
      visible: true,
      renderer: {
        type:   "simple",
        symbol: new SimpleMarkerSymbol({
          style: "circle", size: 7,
          color:   new Color(CLR.evicDot),
          outline: { color: new Color([255, 255, 255, 0.7]), width: 0.8 },
        }),
      } as any,
      featureReduction: {
        type:            "cluster",
        clusterRadius:   "80px",
        clusterMinSize:  "18px",
        clusterMaxSize:  "38px",
        labelingInfo: [{
          labelExpressionInfo: { expression: "$feature.cluster_count" },
          symbol: { type: "text", color: "white", font: { size: 11, weight: "bold" } },
        }],
        symbol: {
          type: "simple-marker",
          color: new Color([200, 50, 50, 0.85]),
          outline: { color: new Color([255, 255, 255, 0.9]), width: 1.5 },
        },
      } as any,
      popupTemplate: new PopupTemplate({
        title:   "Eviction Notice — {address}",
        content: `<table class="esri-widget__table">
          <tr><th>Date Filed</th><td>{file_date}</td></tr>
          <tr><th>Non-Payment</th><td>{non_payment}</td></tr>
          <tr><th>Owner Move-In</th><td>{owner_move_in}</td></tr>
          <tr><th>Ellis Act</th><td>{ellis_act_withdrawal}</td></tr>
        </table>`,
      }),
    });

    // ── Zoning layer ──────────────────────────────────────────────────────
    // 3i4a-hu95 has geometry embedded in the JSON "the_geom" field.
    // DataSF's GeoJSON endpoint doesn't export it, so we fetch JSON and
    // build a Blob URL at runtime (handled in a separate effect after mount).
    const zoningLayer = new GeoJSONLayer({
      url:     makeEmptyGeoJSONUrl(),
      title:   "Zoning Districts",
      visible: false,
      renderer: {
        type:   "simple",
        symbol: new SimpleFillSymbol({
          color:   new Color([200, 160, 120, 0.25]),
          outline: new SimpleLineSymbol({ color: new Color([150, 120, 80, 0.35]), width: 0.4 }),
        }),
      } as any,
      popupTemplate: new PopupTemplate({
        title:   "{districtna}",
        content: "<b>Zoning:</b> {zoning_sim}",
      }),
    });

    // ── Neighborhood boundaries layer ─────────────────────────────────────
    const nhLayer = new GeoJSONLayer({
      url:     `${DATASF}/jwn9-ihcz.geojson?$limit=200`,
      title:   "Neighborhood Boundaries",
      visible: true,
      renderer: {
        type:   "simple",
        symbol: new SimpleFillSymbol({
          color:   new Color([0, 0, 0, 0]),
          outline: new SimpleLineSymbol({ color: new Color([80, 100, 140, 0.6]), width: 1.2 }),
        }),
      } as any,
      labelingInfo: [{
        labelExpressionInfo: { expression: "$feature.name" },
        symbol: {
          type:      "text",
          color:     new Color([50, 70, 110, 0.9]),
          haloColor: new Color([255, 255, 255, 0.8]),
          haloSize:  1.5,
          font:      { size: 10, weight: "bold" },
        },
        minScale: 150_000,
      }] as any,
      labelsVisible: true,
      popupEnabled:  false,
    });

    // ── Projects graphics layer (data loaded separately) ──────────────────
    const projectsLayer = new GraphicsLayer({ title: "Active Projects", visible: true });

    const map = new ArcGISMap({
      basemap: import.meta.env.VITE_ARCGIS_API_KEY ? "streets-navigation-vector" : "gray-vector",
      layers:  [zoningLayer, nhLayer, evictLayer, projectsLayer],
    });

    const view = new ArcGISMapView({
      container: containerRef.current!,
      map,
      center: [SF_CENTER.lng, SF_CENTER.lat],
      zoom:   SF_ZOOM,
      popup:  { dockEnabled: false } as any,
      ui:     { components: ["zoom", "attribution"] as any },
    });

    viewRef.current        = view;
    projectsLayerRef.current = projectsLayer;
    evictLayerRef.current   = evictLayer;
    zoningLayerRef.current  = zoningLayer;
    nhLayerRef.current      = nhLayer;

    view.when(() => setMapReady(true)).catch(() => setMapReady(true));

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once — all dynamic updates via separate effects

  // ── Fetch Supabase project markers ────────────────────────────────────────

  useEffect(() => {
    const layer = projectsLayerRef.current;
    if (!layer) return;
    layer.removeAll();

    const isCitywide = districtConfig.number === "0";
    let q = supabase
      .from("projects")
      .select("id,address,lat,lng,project_description,action,case_number")
      .not("lat", "is", null);

    if (!isCitywide) {
      const orTerms = [
        `district.ilike.%${districtConfig.label}%`,
        ...districtConfig.pipelineNeighborhoods.map(n => `address.ilike.%${n}%`),
      ].join(",");
      q = q.or(orTerms);
    }

    q.limit(500).then(({ data }) => {
      if (!data) return;
      const graphics = (data as SupabaseProject[])
        .filter(p => p.lat && p.lng)
        .map(p => {
          const [r, g, b, a] = projectColors(p.project_description);
          return new Graphic({
            geometry: new Point({ latitude: p.lat, longitude: p.lng }),
            symbol:   new SimpleMarkerSymbol({
              style:   "circle",
              size:    10,
              color:   new Color([r, g, b, a]),
              outline: { color: new Color([255, 255, 255, 0.8]), width: 1 },
            }),
            attributes: {
              id:          p.id,
              address:     p.address ?? "",
              description: (p.project_description ?? "").slice(0, 120),
              action:      p.action ?? "",
              case_number: p.case_number ?? "",
            },
            popupTemplate: new PopupTemplate({
              title:   "{address}",
              content: `
                <p style="margin:0 0 8px;font-size:13px">{description}</p>
                <p style="margin:0"><strong>Status:</strong> {action}</p>
                <p style="margin:4px 0 10px"><strong>Case:</strong> {case_number}</p>
                <a href="#"
                  onclick="window.dispatchEvent(new CustomEvent('cp-nav',{detail:'Commission'}));return false;"
                  style="color:#D4643B;font-weight:600;font-size:13px;">
                  View in Commission page →
                </a>
              `,
            }),
          });
        });
      layer.addMany(graphics);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtConfig, mapReady]);

  // ── Fetch zoning polygons and rebuild layer after map is ready ────────────

  useEffect(() => {
    if (!mapReady || !zoningLayerRef.current) return;
    const isCitywide = districtConfig.number === "0";
    const url = isCitywide
      ? `${DATASF}/3i4a-hu95.json?$limit=1000`
      : `${DATASF}/3i4a-hu95.json?$limit=500&$where=supervisor_district='${districtConfig.number}'`;

    fetch(url)
      .then(r => r.json())
      .then((rows: Array<{ the_geom: unknown; zoning_sim: string; districtna: string }>) => {
        const features = rows
          .filter(r => r.the_geom)
          .map(r => ({
            type:       "Feature",
            geometry:   r.the_geom,
            properties: {
              zoning_sim:  r.zoning_sim,
              districtna:  r.districtna,
              zoning_class: r.zoning_sim?.slice(0, 3) ?? "?",
              fill_color:   zoningFill(r.zoning_sim ?? "").join(","),
            },
          }));
        const geojson = { type: "FeatureCollection", features };
        const blob    = new Blob([JSON.stringify(geojson)], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);

        // Build per-type renderer
        const codes   = [...new Set(features.map(f => (f.properties.zoning_sim ?? "").slice(0, 3)))];
        const infos   = codes.map(code => {
          const [r, g, b, a] = zoningFill(code);
          return {
            value:  code,
            symbol: new SimpleFillSymbol({
              color:   new Color([r, g, b, a]),
              outline: new SimpleLineSymbol({ color: new Color([80, 80, 80, 0.25]), width: 0.3 }),
            }),
          };
        });

        const layer = zoningLayerRef.current!;
        layer.url      = blobUrl;
        layer.renderer = {
          type:           "unique-value",
          field:          "zoning_class",
          defaultSymbol:  new SimpleFillSymbol({
            color:   new Color([200, 160, 120, 0.25]),
            outline: new SimpleLineSymbol({ color: new Color([100, 80, 60, 0.3]), width: 0.3 }),
          }),
          uniqueValueInfos: infos,
        } as any;
      })
      .catch(() => {}); // zoning is optional; silent fail
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, districtConfig.number]);

  // ── Navigate to Commission when popup link clicked ────────────────────────

  useEffect(() => {
    const handler = (e: CustomEvent) => onNavigate(e.detail as string);
    window.addEventListener("cp-nav", handler as EventListener);
    return () => window.removeEventListener("cp-nav", handler as EventListener);
  }, [onNavigate]);

  // ── Sync layer visibility ─────────────────────────────────────────────────

  useEffect(() => {
    if (projectsLayerRef.current) projectsLayerRef.current.visible = layers.projects;
    if (evictLayerRef.current)    evictLayerRef.current.visible    = layers.evictions;
    if (zoningLayerRef.current)   zoningLayerRef.current.visible   = layers.zoning;
    if (nhLayerRef.current)       nhLayerRef.current.visible       = layers.neighborhoods;
  }, [layers]);

  // ── Zoom to selected neighborhood ─────────────────────────────────────────

  const zoomToNeighborhood = useCallback(async (geoName: string | null) => {
    const view = viewRef.current;
    if (!view) return;

    if (!geoName) {
      view.goTo({ center: [SF_CENTER.lng, SF_CENTER.lat], zoom: SF_ZOOM }, { duration: 600 });
      return;
    }

    const boundaries = await loadNeighborhoodBoundaries();
    const feat = boundaries.get(geoName);
    if (!feat) return;

    const extent = extentFromCoords(feat.geometry.coordinates);
    if (extent) {
      view.goTo(extent.expand(1.25), { duration: 650 }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const nh = districtConfig.neighborhoods.find(n => n.name === filter);
    zoomToNeighborhood(nh?.geoName ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, zoomToNeighborhood]);

  // ── District change → reset filter ───────────────────────────────────────

  useEffect(() => {
    setFilter(districtConfig.allLabel);
  }, [districtConfig.allLabel]);

  // ── Layer toggle ──────────────────────────────────────────────────────────

  const toggleLayer = useCallback((key: keyof LayerState, val: boolean) => {
    setLayers(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
      <FilterBar
        districtConfig={districtConfig}
        selected={filter}
        onSelect={setFilter}
      />

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        <LayerPanel layers={layers} onChange={toggleLayer} />

        {!mapReady && (
          <div style={{
            position: "absolute", inset: 0, background: COLORS.cream,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
          }}>
            Loading map…
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utility: empty GeoJSON Blob URL for placeholder layers ────────────────────

function makeEmptyGeoJSONUrl(): string {
  const blob = new Blob(
    [JSON.stringify({ type: "FeatureCollection", features: [] })],
    { type: "application/json" },
  );
  return URL.createObjectURL(blob);
}
