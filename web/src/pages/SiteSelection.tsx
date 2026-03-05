/**
 * SiteSelection.tsx — Site Selection Accelerator demo page.
 *
 * Self-contained demo at /demo/site-selection showcasing industrial/commercial
 * site selection for SF District 3. Fetches parcels, assessments, permits, and
 * hearing data, then ranks the top 10 sites by a readiness score.
 */

import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { generateSitePacketPDF } from "../utils/sitePacketPdf";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Anthropic from "@anthropic-ai/sdk";

import { COLORS, FONTS } from "../theme";
import { ViewIn3DButton } from "../components/ViewIn3D";
import type { CC3DPayload } from "../components/ViewIn3D";
import type { DistrictConfig } from "../districts";
import { supabase } from "../services/supabase";

// ── Constants ────────────────────────────────────────────────────────────────

const DATASF = "https://data.sfgov.org/resource";

const MAPBOX_TILE_URL =
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN ?? ""}`;

const D3_CENTER: [number, number] = [37.797, -122.406];
const D3_ZOOM = 14;

// Key D3 transit stations for distance filtering
const D3_TRANSIT_STATIONS: [number, number][] = [
  [37.7870, -122.4010],  // Embarcadero BART
  [37.7890, -122.4010],  // Montgomery BART
  [37.7876, -122.4076],  // Powell BART
  [37.7940, -122.3940],  // Ferry Building / F-Line
  [37.7952, -122.4000],  // California St Cable Car terminus
];

// Maps form categories → DataSF zoning_district prefixes
const ZONING_CATEGORY_MAP: Record<string, string[]> = {
  "Commercial":  ["C-2", "C-3", "CCB", "CVR", "NCD"],
  "Mixed-Use":   ["MUG", "MUO", "MUR", "UMU", "NCT"],
  "Industrial":  ["M-1", "M-2", "PDR", "SALI"],
  "Residential": ["RH", "RM", "RTO", "RC"],
};

const BUDGET_RANGES: Record<string, [number, number]> = {
  "Under $500K":   [0, 500_000],
  "$500K – $1M":   [500_000, 1_000_000],
  "$1M – $5M":     [1_000_000, 5_000_000],
  "$5M – $20M":    [5_000_000, 20_000_000],
  "$20M+":         [20_000_000, Infinity],
  "Any":           [0, Infinity],
};

const SQFT_OPTIONS = ["Any", "1,000+", "5,000+", "10,000+", "25,000+"];

const TRANSIT_OPTIONS: Record<string, number> = {
  "Any":           Infinity,
  "Within 0.25 mi": 0.25,
  "Within 0.5 mi":  0.5,
  "Within 1 mi":    1.0,
};

// ── Types ────────────────────────────────────────────────────────────────────

interface SiteSelectionProps {
  districtConfig: DistrictConfig;
  onNavigate: (page: string) => void;
}

interface ProjectRow {
  address?: string;
  district?: string;
  lat?: number;
  lng?: number;
  parcel_apn?: string;
  block?: string;
  lot?: string;
  zoning?: string;
  action?: string;
  shadow_flag?: boolean;
}

interface AssessmentRow {
  parcel_number?: string;
  property_location?: string;
  assessed_land_value?: string;
  assessed_improvement_value?: string;
}

interface PermitCountRow {
  block?: string;
  lot?: string;
  count_permit_number?: string;
}

interface SiteResult {
  rank: number;
  blklot: string;
  address: string;
  lat: number;
  lng: number;
  zoning: string;
  assessedValue: number;
  permitCount: number;
  hasDispute: boolean;
  readinessScore: number;
}

interface FormState {
  zoning: string[];
  budget: string;
  sqft: string;
  transit: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestTransitDist(lat: number, lng: number): number {
  let min = Infinity;
  for (const [sLat, sLng] of D3_TRANSIT_STATIONS) {
    const d = haversineDistance(lat, lng, sLat, sLng);
    if (d < min) min = d;
  }
  return min;
}

function computeReadiness(
  zoningMatch: boolean,
  permitCount: number,
  hasDispute: boolean,
  assessedValue: number,
): number {
  let score = 0;
  if (zoningMatch) score += 2;
  if (permitCount > 0) score += 1;
  if (!hasDispute) score += 1;
  if (assessedValue > 500_000) score += 1;
  return Math.min(score, 5);
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

// Numbered marker icon
function numberedIcon(n: number, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${selected ? COLORS.orange : "#3D3832"};
      color:#fff;font-family:${FONTS.body};font-size:12px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div style={{
      background: COLORS.softAmber,
      borderBottom: `1px solid ${COLORS.amber}`,
      padding: "8px 16px",
      textAlign: "center",
      fontFamily: FONTS.body,
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.charcoal,
    }}>
      Demo: Site Selection Accelerator — powered by CityPulse
    </div>
  );
}

function ProspectForm({
  form, setForm, onSearch, searching,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSearch: () => void;
  searching: boolean;
}) {
  const toggleZoning = (cat: string) => {
    setForm(prev => ({
      ...prev,
      zoning: prev.zoning.includes(cat)
        ? prev.zoning.filter(z => z !== cat)
        : [...prev.zoning, cat],
    }));
  };

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${COLORS.lightBorder}`, fontFamily: FONTS.body,
    fontSize: 13, color: COLORS.charcoal, background: COLORS.white,
    cursor: "pointer",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
    color: COLORS.warmGray, textTransform: "uppercase" as const,
    letterSpacing: "0.08em", marginBottom: 6, display: "block",
  };

  return (
    <div style={{
      background: COLORS.white, borderRadius: 12, padding: "20px 24px",
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <h2 style={{
        fontFamily: FONTS.heading, fontSize: 20, fontWeight: 700,
        color: COLORS.charcoal, margin: "0 0 16px",
      }}>
        Find Your Ideal Site
      </h2>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}>
        {/* Zoning */}
        <div>
          <span style={labelStyle}>Zoning Type</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.keys(ZONING_CATEGORY_MAP).map(cat => (
              <label key={cat} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal,
                cursor: "pointer", userSelect: "none",
              }}>
                <input
                  type="checkbox"
                  checked={form.zoning.includes(cat)}
                  onChange={() => toggleZoning(cat)}
                  style={{ accentColor: COLORS.orange, cursor: "pointer" }}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <span style={labelStyle}>Budget Range</span>
          <select
            value={form.budget}
            onChange={e => setForm(prev => ({ ...prev, budget: e.target.value }))}
            style={selectStyle}
          >
            {Object.keys(BUDGET_RANGES).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Min Sq Ft (cosmetic) */}
        <div>
          <span style={labelStyle}>Minimum Sq Ft</span>
          <select
            value={form.sqft}
            onChange={e => setForm(prev => ({ ...prev, sqft: e.target.value }))}
            style={selectStyle}
          >
            {SQFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Transit */}
        <div>
          <span style={labelStyle}>Transit Proximity</span>
          <select
            value={form.transit}
            onChange={e => setForm(prev => ({ ...prev, transit: e.target.value }))}
            style={selectStyle}
          >
            {Object.keys(TRANSIT_OPTIONS).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={onSearch}
        disabled={searching}
        style={{
          marginTop: 18, width: "100%", padding: "12px 24px",
          background: searching ? COLORS.warmGray : COLORS.orange,
          color: COLORS.white, border: "none", borderRadius: 10,
          fontFamily: FONTS.body, fontSize: 14, fontWeight: 700,
          cursor: searching ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {searching ? "Searching…" : "Find Sites"}
      </button>
    </div>
  );
}

function SiteMapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 17, { duration: 0.6 });
  }, [map, target]);
  return null;
}

function StarRating({ score }: { score: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{
          color: i <= score ? COLORS.orange : COLORS.lightBorder,
          fontSize: 14,
        }}>
          ★
        </span>
      ))}
    </span>
  );
}

function ResultCard({
  site, selected, onClick,
}: {
  site: SiteResult;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px", borderRadius: 10, cursor: "pointer",
        background: selected ? COLORS.orangePale : COLORS.white,
        border: `1px solid ${selected ? COLORS.orange : COLORS.lightBorder}`,
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 24, height: 24, borderRadius: "50%",
          background: selected ? COLORS.orange : COLORS.charcoal,
          color: COLORS.white, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONTS.body, fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {site.rank}
        </span>
        <span style={{
          fontFamily: FONTS.body, fontSize: 13, fontWeight: 700,
          color: COLORS.charcoal, flex: 1, lineHeight: 1.3,
        }}>
          {site.address}
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "4px 12px", fontFamily: FONTS.body, fontSize: 11,
      }}>
        <span style={{ color: COLORS.warmGray }}>APN</span>
        <span style={{ color: COLORS.charcoal }}>{site.blklot}</span>
        <span style={{ color: COLORS.warmGray }}>Zoning</span>
        <span style={{ color: COLORS.charcoal }}>{site.zoning}</span>
        <span style={{ color: COLORS.warmGray }}>Assessed</span>
        <span style={{ color: COLORS.charcoal }}>{fmtDollars(site.assessedValue)}</span>
        <span style={{ color: COLORS.warmGray }}>Permits</span>
        <span style={{ color: COLORS.charcoal }}>{site.permitCount} issued</span>
        <span style={{ color: COLORS.warmGray }}>Readiness</span>
        <StarRating score={site.readinessScore} />
      </div>
    </div>
  );
}

function SiteNotesPanel({
  site, notes, loading,
}: {
  site: SiteResult | null;
  notes: string;
  loading: boolean;
}) {
  const [exporting, setExporting] = useState(false);

  if (!site) return null;

  const payload: CC3DPayload = {
    address: site.address,
    lat: site.lat,
    lng: site.lng,
    parcel_apn: site.blklot,
    district: "District 3",
    active_layers: ["parcels", "permits"],
  };

  const handleExportPdf = async (e: FormEvent) => {
    e.preventDefault();
    setExporting(true);
    try {
      await generateSitePacketPDF({ site, notes });
    } catch (err) {
      console.error("[SiteSelection] PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const exportDisabled = exporting || loading || !notes;

  return (
    <div style={{
      background: COLORS.white, borderRadius: 12, padding: "20px 24px",
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      marginTop: 20,
    }}>
      <h3 style={{
        fontFamily: FONTS.heading, fontSize: 17, fontWeight: 700,
        color: COLORS.charcoal, margin: "0 0 12px",
      }}>
        AI Site Notes — {site.address}
      </h3>

      {loading ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div className="sk" style={{ width: 18, height: 18, borderRadius: "50%" }} />
            <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray }}>
              Generating site analysis…
            </span>
          </div>
          <div className="sk" style={{ height: 14, width: "90%", borderRadius: 6, marginBottom: 8 }} />
          <div className="sk" style={{ height: 14, width: "75%", borderRadius: 6, marginBottom: 8 }} />
          <div className="sk" style={{ height: 14, width: "60%", borderRadius: 6 }} />
        </div>
      ) : (
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal,
          lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap",
        }}>
          {notes}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <ViewIn3DButton compact payload={payload} />
        <button
          onClick={handleExportPdf}
          disabled={exportDisabled}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: `1px solid ${COLORS.lightBorder}`,
            background: exportDisabled ? COLORS.lightBorder : COLORS.cream,
            fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
            color: exportDisabled ? COLORS.warmGray : COLORS.charcoal,
            cursor: exportDisabled ? "not-allowed" : "pointer",
          }}
        >
          {exporting ? "Exporting\u2026" : "Export PDF"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function SiteSelection(_props: SiteSelectionProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [form, setForm] = useState<FormState>({
    zoning: ["Commercial"],
    budget: "Any",
    sqft: "Any",
    transit: "Any",
  });
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SiteResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Get the selected zoning prefixes from form state
  const activeZoningPrefixes = useMemo(() => {
    return form.zoning.flatMap(cat => ZONING_CATEGORY_MAP[cat] ?? []);
  }, [form.zoning]);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setResults([]);
    setSelectedIdx(null);
    setAiNotes("");

    try {
      // 1. Primary source — Supabase projects table (reliable, pre-ingested)
      const projectsFetch = supabase
        .from("projects")
        .select("address,district,lat,lng,parcel_apn,block,lot,zoning,action,shadow_flag")
        .ilike("district", "%District 3%")
        .not("lat", "is", null)
        .not("lng", "is", null);

      // 2. Enrichment — DataSF assessments for assessed values
      const assessParams = new URLSearchParams({
        $where: "supervisor_district='3'",
        $select: "parcel_number,property_location,assessed_land_value,assessed_improvement_value",
        $limit: "2000",
      });
      const assessFetch = fetch(`${DATASF}/wv5m-vpq2.json?${assessParams}`).then(r => r.json());

      // 3. Enrichment — DataSF permit counts
      const permitParams = new URLSearchParams({
        $where: "supervisor_district='3' AND status='issued'",
        $select: "block,lot,count(permit_number)",
        $group: "block,lot",
        $limit: "2000",
      });
      const permitFetch = fetch(`${DATASF}/i98e-djp9.json?${permitParams}`).then(r => r.json());

      const [projectsRes, assessRaw, permitsRaw] = await Promise.all([
        projectsFetch,
        assessFetch,
        permitFetch,
      ]);

      const projects: ProjectRow[] = projectsRes.data ?? [];
      const assessments: AssessmentRow[] = Array.isArray(assessRaw) ? assessRaw : [];
      const permits: PermitCountRow[] = Array.isArray(permitsRaw) ? permitsRaw : [];

      if (!Array.isArray(assessRaw)) {
        console.error("[SiteSelection] Unexpected assessments response:", assessRaw);
      }
      if (!Array.isArray(permitsRaw)) {
        console.error("[SiteSelection] Unexpected permits response:", permitsRaw);
      }

      // Build enrichment lookup maps
      const assessMap = new Map<string, { value: number; address: string }>();
      for (const a of assessments) {
        if (!a.parcel_number) continue;
        const key = a.parcel_number.replace(/\s/g, "");
        const val =
          parseFloat(a.assessed_land_value ?? "0") +
          parseFloat(a.assessed_improvement_value ?? "0");
        assessMap.set(key, { value: val, address: a.property_location ?? "" });
      }

      const permitMap = new Map<string, number>();
      for (const p of permits) {
        if (!p.block || !p.lot) continue;
        const key = `${p.block}${p.lot}`;
        permitMap.set(key, parseInt(p.count_permit_number ?? "0", 10));
      }

      // Budget range
      const [budgetMin, budgetMax] = BUDGET_RANGES[form.budget] ?? [0, Infinity];
      const transitMax = TRANSIT_OPTIONS[form.transit] ?? Infinity;

      // Deduplicate projects by parcel_apn (same parcel may have multiple hearings)
      const seen = new Set<string>();

      // Join and filter
      const candidates: SiteResult[] = [];
      for (const proj of projects) {
        const lat = proj.lat;
        const lng = proj.lng;
        if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) continue;

        const blklot = (proj.parcel_apn ?? "").replace(/\s/g, "");
        if (!blklot || seen.has(blklot)) continue;
        seen.add(blklot);

        const zoning = proj.zoning ?? "";

        // Zoning filter
        if (activeZoningPrefixes.length > 0) {
          const match = activeZoningPrefixes.some(prefix => zoning.toUpperCase().startsWith(prefix.toUpperCase()));
          if (!match) continue;
        }

        // Transit filter
        if (transitMax < Infinity) {
          const dist = nearestTransitDist(lat, lng);
          if (dist > transitMax) continue;
        }

        // Assessment enrichment
        const assess = assessMap.get(blklot);
        const assessedValue = assess?.value ?? 0;
        const address = proj.address || assess?.address || blklot;

        // Budget filter
        if (assessedValue < budgetMin || assessedValue > budgetMax) continue;

        const permitCount = permitMap.get(blklot) ?? 0;
        const hasDispute = proj.action !== "Approved" || proj.shadow_flag === true;

        const zoningMatch = activeZoningPrefixes.some(prefix =>
          zoning.toUpperCase().startsWith(prefix.toUpperCase()),
        );
        const readinessScore = computeReadiness(zoningMatch, permitCount, hasDispute, assessedValue);

        candidates.push({
          rank: 0,
          blklot,
          address,
          lat,
          lng,
          zoning,
          assessedValue,
          permitCount,
          hasDispute,
          readinessScore,
        });
      }

      // Sort by readiness desc, then assessed value desc
      candidates.sort((a, b) => b.readinessScore - a.readinessScore || b.assessedValue - a.assessedValue);

      // Top 10 with rank
      const top = candidates.slice(0, 10).map((s, i) => ({ ...s, rank: i + 1 }));
      setResults(top);

    } catch (err) {
      console.error("[SiteSelection] search failed:", err);
    } finally {
      setSearching(false);
    }
  }, [form, activeZoningPrefixes]);

  // AI notes generation on parcel click
  const generateNotes = useCallback(async (site: SiteResult) => {
    setAiLoading(true);
    setAiNotes("");
    try {
      const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are a commercial real estate analyst for San Francisco District 3. Provide a brief site assessment (3-4 sentences) for this parcel:

Address: ${site.address}
APN: ${site.blklot}
Zoning: ${site.zoning}
Assessed Value: ${fmtDollars(site.assessedValue)}
Active Permits: ${site.permitCount}
Readiness Score: ${site.readinessScore}/5
Hearing Disputes: ${site.hasDispute ? "Yes" : "None"}

Focus on development potential, zoning implications, and any risks. Be concise and factual.`,
        }],
      });
      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      setAiNotes(text);
    } catch (err) {
      console.error("[SiteSelection] AI notes failed:", err);
      setAiNotes("Unable to generate site notes. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleSelectSite = useCallback((idx: number) => {
    setSelectedIdx(idx);
    const site = results[idx];
    if (site) {
      setFlyTarget([site.lat, site.lng]);
      generateNotes(site);
    }
  }, [results, generateNotes]);

  const selectedSite = selectedIdx !== null ? results[selectedIdx] : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <DemoBanner />

      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "20px 16px 40px",
      }}>
        {/* Section 1: Form */}
        <ProspectForm form={form} setForm={setForm} onSearch={handleSearch} searching={searching} />

        {/* Section 2: Map + Results */}
        {results.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 380px",
            gap: 16,
            marginTop: 20,
          }}>
            {/* Map */}
            <div style={{
              borderRadius: 12, overflow: "hidden",
              border: `1px solid ${COLORS.lightBorder}`,
              height: isMobile ? 350 : 500,
            }}>
              <MapContainer
                center={D3_CENTER}
                zoom={D3_ZOOM}
                style={{ width: "100%", height: "100%" }}
                zoomControl={true}
              >
                <TileLayer
                  url={MAPBOX_TILE_URL}
                  attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                  maxZoom={19}
                  tileSize={512}
                  zoomOffset={-1}
                />
                <SiteMapController target={flyTarget} />
                {results.map((site, i) => (
                  <Marker
                    key={site.blklot}
                    position={[site.lat, site.lng]}
                    icon={numberedIcon(site.rank, selectedIdx === i)}
                    eventHandlers={{ click: () => handleSelectSite(i) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: FONTS.body, fontSize: 13 }}>
                        <strong>{site.address}</strong>
                        <div style={{ fontSize: 11, color: COLORS.warmGray, marginTop: 4 }}>
                          {site.zoning} · {fmtDollars(site.assessedValue)} · {site.permitCount} permits
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <StarRating score={site.readinessScore} />
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Results List */}
            <div style={{
              maxHeight: isMobile ? "auto" : 500,
              overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <h3 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700,
                color: COLORS.charcoal, margin: "0 0 4px",
              }}>
                Top Sites ({results.length})
              </h3>
              {results.map((site, i) => (
                <ResultCard
                  key={site.blklot}
                  site={site}
                  selected={selectedIdx === i}
                  onClick={() => handleSelectSite(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state after search with no results */}
        {!searching && results.length === 0 && form.zoning.length > 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            fontFamily: FONTS.body, color: COLORS.warmGray,
          }}>
            Click "Find Sites" to search District 3 for matching parcels.
          </div>
        )}

        {/* Section 3: AI Notes */}
        <SiteNotesPanel
          site={selectedSite}
          notes={aiNotes}
          loading={aiLoading}
        />
      </div>
    </div>
  );
}
