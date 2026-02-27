/**
 * SFDistrictMap.tsx — Interactive SF Supervisor District map for the Home page.
 *
 * Fetches all 11 district boundaries from DataSF in one request.
 * Click a district polygon to call onSelectDistrict(num).
 * Selected district fills orange; others fill warm off-white.
 * No zoom/pan controls — purely a selection aid.
 */
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import { fetchAllSFDistrictBoundaries } from "../services/neighborhoodBoundaries";
import type { GeoFeature } from "../services/neighborhoodBoundaries";

export interface SFDistrictMapProps {
  selectedDistrict: string;               // "0"–"11"
  onSelectDistrict: (num: string) => void;
  disabled?: boolean;
}

const SELECTED_FILL  = "#D4643B";
const DEFAULT_FILL   = "#EDE8E3";
const BORDER_COLOR   = "#FFFFFF";

function districtStyle(num: string, selected: string, hovered: string | null): L.PathOptions {
  const isSel = num === selected;
  const isHov = num === hovered;
  return {
    color:       BORDER_COLOR,
    weight:      isSel ? 2.5 : 1,
    fillColor:   isSel ? SELECTED_FILL : (isHov ? "#E8C4B2" : DEFAULT_FILL),
    fillOpacity: 0.85,
    opacity:     1,
  };
}

// Page background cream — must match body/page background
const PAGE_CREAM = "#FAF8F5";

// Large rectangle well beyond any visible area — forms the "outer ring" of the mask
const MASK_OUTER: [number, number][] = [
  [-124, 37.0], [-124, 38.5], [-121, 38.5], [-121, 37.0], [-124, 37.0],
];

/** Build an inverted GeoJSON polygon: world rect with SF district polygons as holes.
 *  Rendered with fillRule "evenodd" + cream fill → masks everything outside SF. */
function buildMaskGeoJSON(boundaries: Map<string, GeoFeature>): GeoJsonObject {
  const holes: number[][][] = [];
  for (const [, feature] of boundaries) {
    if (feature.geometry.type === "Polygon") {
      holes.push(feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === "MultiPolygon") {
      for (const polygon of feature.geometry.coordinates) {
        holes.push(polygon[0]);
      }
    }
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [MASK_OUTER, ...holes] },
  } as GeoJsonObject;
}

function DistrictLayer({
  selectedDistrict,
  onSelectDistrict,
  disabled,
}: SFDistrictMapProps) {
  const map = useMap();
  const layersRef   = useRef<Map<string, L.GeoJSON>>(new Map());
  const maskRef     = useRef<L.GeoJSON | null>(null);
  const hoveredRef  = useRef<string | null>(null);
  const selectedRef = useRef<string>(selectedDistrict);

  function refreshStyles() {
    for (const [num, layer] of layersRef.current) {
      layer.setStyle(districtStyle(num, selectedRef.current, hoveredRef.current));
    }
  }

  // Load boundaries once
  useEffect(() => {
    // Create a pane for the mask so it sits above districts but passes pointer events
    if (!map.getPane("sfMaskPane")) {
      const pane = map.createPane("sfMaskPane");
      pane.style.zIndex = "450";
      pane.style.pointerEvents = "none";
    }

    fetchAllSFDistrictBoundaries().then(boundaries => {
      // District polygon layers
      for (const [num, feature] of boundaries) {
        const layer = L.geoJSON(feature as GeoJsonObject, {
          style: () => districtStyle(num, selectedRef.current, hoveredRef.current),
        }).addTo(map);

        if (!disabled) {
          layer.on("click", () => onSelectDistrict(num));
          layer.on("mouseover", () => { hoveredRef.current = num; refreshStyles(); });
          layer.on("mouseout",  () => { hoveredRef.current = null; refreshStyles(); });
        }

        layersRef.current.set(num, layer);
      }

      // Inverted mask layer — cream fill everywhere outside SF, pointer-events none
      maskRef.current = L.geoJSON(buildMaskGeoJSON(boundaries), {
        pane: "sfMaskPane",
        style: () => ({
          fillColor:   PAGE_CREAM,
          fillOpacity: 1,
          fillRule:    "evenodd" as CanvasFillRule,
          color:       "transparent",
          weight:      0,
        }),
      }).addTo(map);
    });

    return () => {
      for (const [, layer] of layersRef.current) map.removeLayer(layer);
      layersRef.current.clear();
      if (maskRef.current) { map.removeLayer(maskRef.current); maskRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-style when selection changes
  useEffect(() => {
    selectedRef.current = selectedDistrict;
    refreshStyles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrict]);

  return null;
}

const SF_BOUNDS = L.latLngBounds(
  [37.705, -122.515],  // SW — excludes most of South Bay
  [37.810, -122.355],  // NE — excludes Treasure Island / East Bay
);

export function SFDistrictMap(props: SFDistrictMapProps) {
  return (
    <MapContainer
      center={[37.758, -122.442]}
      zoom={12}
      minZoom={12}
      maxZoom={12}
      maxBounds={SF_BOUNDS}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
        subdomains="abcd"
        maxZoom={19}
      />
      <DistrictLayer {...props} />
    </MapContainer>
  );
}
