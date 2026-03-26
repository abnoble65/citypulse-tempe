/**
 * PropertyPage.tsx — Public-facing single-building intelligence profile.
 *
 * Route: /property/:apn
 * No login required. Clean, shareable via direct URL.
 */

import { useEffect, useState, useMemo } from "react";
import { COLORS, FONTS } from "../theme";
import { computeTransitScore, fetchTransitStopsNear, type TransitStop, type TransitScore } from "../services/transitAccess";
import { callAI } from "../services/aiProxy";
import { CityPulseLogo } from "../components/Icons";

// ── Types ────────────────────────────────────────────────────────────────

interface BuildingIdentity {
  apn: string;
  address: string;
  rawAddress: string;
  use: string;
  zoning: string;
  yearBuilt: string;
  stories: string;
  assessedValue: number;
  neighborhood: string;
  lat: number;
  lng: number;
}

interface PermitRow {
  permitNumber: string;
  type: string;
  status: string;
  cost: number;
  filedDate: string;
}

interface ThreeOneOneRow {
  category: string;
  count: number;
}

interface BusinessRow {
  name: string;
  category: string;
  openDate: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DATASF = "https://data.sfgov.org/resource";

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return n > 0 ? `$${n.toLocaleString()}` : "—";
}

function normalizeApn(raw: string): string {
  return raw.replace(/-/g, "").replace(/^0+/, "").padStart(7, "0");
}

function formatApn(clean: string): string {
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

/** Clean assessor addresses like "0000 0001 MARKET ST0000" → "1 Market St" */
function cleanAssessorAddress(raw: string): string {
  // Remove trailing zeros/spaces/junk
  let s = raw.replace(/0{3,}\s*$/g, "").trim();
  // Split into tokens, strip leading zeros from each numeric token
  const tokens = s.split(/\s+/).map(t => /^\d+$/.test(t) ? t.replace(/^0+/, "") || "0" : t);
  // Drop empty leading tokens (e.g. "0000" becomes "")
  while (tokens.length > 0 && tokens[0] === "0") tokens.shift();
  // Title case
  return tokens.join(" ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Map block number (first 4 digits of APN) to downtown neighborhood. */
function blockToNeighborhood(apn: string, fallback: string): string {
  const block = parseInt(normalizeApn(apn).slice(0, 4), 10);
  if (block >= 3715 && block <= 3716) return "Rincon Hill";
  if (block >= 3713 && block <= 3716) return "Embarcadero";
  if (block >= 3708 && block <= 3711) return "SoMa";
  if (block >= 3707 && block <= 3712) return "Financial District";
  return fallback || "";
}

// ── Data fetchers (direct Socrata queries for single property) ───────────

async function fetchAssessor(apn: string, signal?: AbortSignal): Promise<BuildingIdentity | null> {
  const clean = normalizeApn(apn);
  const params = new URLSearchParams({
    $where: `parcel_number='${clean}'`,
    $select: "parcel_number,property_location,use_definition,zoning_code,year_property_built,number_of_stories,assessed_fixtures_value,assessed_improvement_value,assessed_land_value,assessor_neighborhood,the_geom",
    $limit: "1",
  });
  const res = await fetch(`${DATASF}/wv5m-vpq2.json?${params}`, { signal });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  const coords = r.the_geom?.coordinates;
  const land = parseFloat(r.assessed_land_value) || 0;
  const impr = parseFloat(r.assessed_improvement_value) || 0;
  const fix = parseFloat(r.assessed_fixtures_value) || 0;
  const formattedApn = formatApn(clean);
  const rawAddr = (r.property_location ?? "").replace(/0{3,}\s*$/g, "").trim();
  return {
    apn: formattedApn,
    address: cleanAssessorAddress(r.property_location ?? ""),
    rawAddress: rawAddr,
    use: r.use_definition ?? "Unknown",
    zoning: r.zoning_code ?? "",
    yearBuilt: r.year_property_built ?? "",
    stories: r.number_of_stories ?? "",
    assessedValue: land + impr + fix,
    neighborhood: blockToNeighborhood(formattedApn, r.assessor_neighborhood ?? ""),
    lat: coords ? coords[1] : 0,
    lng: coords ? coords[0] : 0,
  };
}

async function fetchPermits(address: string, signal?: AbortSignal): Promise<PermitRow[]> {
  if (!address) return [];
  const parts = address.trim().split(/\s+/);
  const streetNum = parts[0] || "";
  const streetName = parts.slice(1).join(" ");
  if (!streetNum || !streetName) return [];
  const params = new URLSearchParams({
    $where: `street_number='${streetNum}' AND upper(street_name) LIKE '%${streetName.toUpperCase().replace(/'/g, "''")}%'`,
    $select: "permit_number,permit_type_definition,status,estimated_cost,filed_date",
    $order: "filed_date DESC",
    $limit: "20",
  });
  const res = await fetch(`${DATASF}/i98e-djp9.json?${params}`, { signal });
  if (!res.ok) return [];
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    permitNumber: r.permit_number ?? "",
    type: r.permit_type_definition ?? "",
    status: r.status ?? "",
    cost: parseFloat(r.estimated_cost) || 0,
    filedDate: (r.filed_date ?? "").split("T")[0],
  }));
}

async function fetch311Near(lat: number, lng: number, signal?: AbortSignal): Promise<ThreeOneOneRow[]> {
  if (!lat || !lng) return [];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().split("T")[0];
  const params = new URLSearchParams({
    $where: `within_circle(point, ${lat}, ${lng}, 150) AND requested_datetime>'${cutoff}T00:00:00'`,
    $select: "service_name,count(*) as cnt",
    $group: "service_name",
    $order: "cnt DESC",
    $limit: "10",
  });
  const res = await fetch(`${DATASF}/vw6y-z8j6.json?${params}`, { signal });
  if (!res.ok) return [];
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({ category: r.service_name ?? "Other", count: parseInt(r.cnt) || 0 }));
}

async function fetchBusinessesAtAddress(address: string, signal?: AbortSignal): Promise<BusinessRow[]> {
  if (!address) return [];
  const parts = address.trim().split(/\s+/);
  const streetNum = parts[0]?.replace(/^0+/, "") || "";
  const streetName = parts.slice(1).join(" ").toUpperCase().replace(/0+$/, "").trim();
  if (!streetNum || !streetName) return [];
  // Match street number at start + street name substring for precision
  const params = new URLSearchParams({
    $where: `starts_with(full_business_address, '${streetNum} ') AND upper(full_business_address) LIKE '%${streetName.replace(/'/g, "''")}%' AND dba_end_date IS NULL AND city='Tempe'`,
    $select: "dba_name,naic_code_description,dba_start_date,full_business_address",
    $order: "dba_start_date DESC",
    $limit: "30",
  });
  const res = await fetch(`${DATASF}/g8m3-pdis.json?${params}`, { signal });
  if (!res.ok) return [];
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => {
      const name = r.dba_name ?? "";
      // Skip null, empty, or junk names
      if (!name || name.toLowerCase().includes("block")) return false;
      return true;
    })
    .map((r: any) => ({
      name: r.dba_name,
      category: r.naic_code_description || "Uncategorized",
      openDate: (r.dba_start_date ?? "").split("T")[0],
    }));
}

// Transit stops fetched via fetchTransitStopsNear() from transitAccess service.

// ── Component ────────────────────────────────────────────────────────────

export function PropertyPage({ apn }: { apn: string }) {
  const [building, setBuilding] = useState<BuildingIdentity | null>(null);
  const [permits, setPermits] = useState<PermitRow[]>([]);
  const [threeOneOne, setThreeOneOne] = useState<ThreeOneOneRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [transit, setTransit] = useState<TransitScore | null>(null);
  const [aiSignal, setAiSignal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    (async () => {
      const b = await fetchAssessor(apn, signal);
      if (!b) { setError("Property not found. Check the APN and try again."); setLoading(false); return; }
      setBuilding(b);

      const [p, sr, biz, stops] = await Promise.all([
        fetchPermits(b.rawAddress, signal).catch(() => [] as PermitRow[]),
        fetch311Near(b.lat, b.lng, signal).catch(() => [] as ThreeOneOneRow[]),
        fetchBusinessesAtAddress(b.rawAddress, signal).catch(() => [] as BusinessRow[]),
        fetchTransitStopsNear(b.lat, b.lng, { signal }).catch(() => [] as TransitStop[]),
      ]);
      setPermits(p);
      setThreeOneOne(sr);
      setBusinesses(biz);
      setTransit(computeTransitScore(b.lat, b.lng, stops));
      setLoading(false);

      // AI signal — one sentence
      const totalComplaints = sr.reduce((s, r) => s + r.count, 0);
      callAI({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `You are a real estate analyst. In ONE sentence, summarize the redevelopment potential of this Tempe, AZ property:
Address: ${b.address} | Use: ${b.use} | Zoning: ${b.zoning} | Built: ${b.yearBuilt} | Stories: ${b.stories}
Assessed value: ${fmtCurrency(b.assessedValue)} | Active permits: ${p.length} | 311 complaints (90d): ${totalComplaints} | Active businesses: ${biz.length} | Transit score: ${transit ? computeTransitScore(b.lat, b.lng, stops).score : 0}/100
Be specific and factual. No hedge words.`,
        }],
      }).then(res => {
        setAiSignal(res.content[0]?.type === "text" ? res.content[0].text : "");
      }).catch(() => {});
    })().catch(err => {
      if (err?.name !== "AbortError") { setError("Unable to load property data."); setLoading(false); }
    });

    return () => controller.abort();
  }, [apn]);

  const totalComplaints = useMemo(() => threeOneOne.reduce((s, r) => s + r.count, 0), [threeOneOne]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Section component ─────────────────────────────────────────────
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      background: COLORS.white, borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`,
      padding: "20px 24px", marginBottom: 16,
    }}>
      <h2 style={{
        fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700,
        color: COLORS.warmGray, textTransform: "uppercase", letterSpacing: "0.06em",
        margin: "0 0 14px",
      }}>{title}</h2>
      {children}
    </div>
  );

  const Row = ({ label, value }: { label: string; value: string | number | undefined | null }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{
        display: "flex", justifyContent: "space-between", gap: 12,
        padding: "6px 0", borderBottom: `1px solid ${COLORS.lightBorder}`,
        fontFamily: FONTS.body, fontSize: 13,
      }}>
        <span style={{ color: COLORS.warmGray }}>{label}</span>
        <span style={{ color: COLORS.charcoal, fontWeight: 500, textAlign: "right" }}>{value}</span>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.cream }}>
      {/* Header */}
      <header style={{
        background: COLORS.white, borderBottom: `1px solid ${COLORS.lightBorder}`,
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CityPulseLogo size={24} />
          <span style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: COLORS.charcoal }}>
            CityPulse
          </span>
          <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginLeft: 4 }}>
            Property Intelligence
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleShare}
            style={{
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${COLORS.lightBorder}`, background: COLORS.white,
              fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
              color: copied ? "#10B981" : COLORS.charcoal,
            }}
          >
            {copied ? "Copied!" : "Share Property Report"}
          </button>
          <a
            href="/cbd/downtown"
            style={{
              padding: "6px 14px", borderRadius: 8, textDecoration: "none",
              background: "#E8652D", color: "#fff",
              fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
              display: "inline-flex", alignItems: "center",
            }}
          >
            View Full Downtown Intelligence
          </a>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px" }}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, fontFamily: FONTS.body, color: COLORS.warmGray }}>
            <div className="sk" style={{ width: 40, height: 40, borderRadius: "50%", margin: "0 auto 16px" }} />
            Loading property data for APN {apn}...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12,
            padding: "24px", textAlign: "center", fontFamily: FONTS.body, fontSize: 14, color: "#991B1B",
          }}>
            {error}
          </div>
        )}

        {/* Main content */}
        {building && !loading && (
          <>
            {/* Hero */}
            <div style={{ marginBottom: 24 }}>
              <h1 style={{
                fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700,
                color: COLORS.charcoal, margin: "0 0 4px",
              }}>
                {building.address || `APN ${building.apn}`}
              </h1>
              <div style={{
                fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
                display: "flex", gap: 12, flexWrap: "wrap",
              }}>
                <span>APN {building.apn}</span>
                {building.neighborhood && <span>{building.neighborhood}</span>}
                {building.zoning && <span>Zoning: {building.zoning}</span>}
              </div>
            </div>

            {/* AI Signal */}
            {aiSignal && (
              <div style={{
                background: "#FFF7ED", borderRadius: 12, border: "1px solid #FED7AA",
                padding: "14px 20px", marginBottom: 16,
                fontFamily: FONTS.body, fontSize: 14, color: "#92400E", lineHeight: 1.6,
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>&#x26A1;</span>
                {aiSignal}
              </div>
            )}

            {/* Building Identity */}
            <Section title="Building Identity">
              <Row label="Address" value={building.address} />
              <Row label="APN" value={building.apn} />
              <Row label="Building Use" value={building.use} />
              <Row label="Zoning" value={building.zoning} />
              <Row label="Year Built" value={building.yearBuilt} />
              <Row label="Stories" value={building.stories} />
              <Row label="Assessed Value" value={fmtCurrency(building.assessedValue)} />
              <Row label="Neighborhood" value={building.neighborhood} />
            </Section>

            {/* Active Permits */}
            <Section title={`Active Permits (${permits.length})`}>
              {permits.length > 0 ? (
                <div>
                  {permits.slice(0, 5).map((p, i) => (
                    <div key={i} style={{
                      padding: "8px 0",
                      borderBottom: i < Math.min(permits.length, 5) - 1 ? `1px solid ${COLORS.lightBorder}` : "none",
                      fontFamily: FONTS.body, fontSize: 13,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 600, color: COLORS.charcoal }}>{p.type}</span>
                        <span style={{ color: COLORS.warmGray, fontSize: 12 }}>{p.filedDate}</span>
                      </div>
                      <div style={{ color: COLORS.midGray, fontSize: 12, marginTop: 2 }}>
                        #{p.permitNumber} &middot; {p.status} {p.cost > 0 ? ` \u00B7 ${fmtCurrency(p.cost)}` : ""}
                      </div>
                    </div>
                  ))}
                  {permits.length > 5 && (
                    <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 8 }}>
                      +{permits.length - 5} more permits
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray }}>
                  No active permits on file.
                </div>
              )}
            </Section>

            {/* 311 Activity */}
            <Section title={`311 Activity — Last 90 Days (${totalComplaints})`}>
              {threeOneOne.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {threeOneOne.map((r, i) => (
                    <div key={i} style={{
                      padding: "6px 12px", borderRadius: 8,
                      background: COLORS.cream, fontFamily: FONTS.body, fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 600, color: COLORS.charcoal }}>{r.count}</span>
                      <span style={{ color: COLORS.warmGray, marginLeft: 4 }}>{r.category}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray }}>
                  No 311 complaints in the last 90 days within 150m.
                </div>
              )}
            </Section>

            {/* Active Businesses */}
            <Section title={`Active Businesses (${businesses.length})`}>
              {businesses.length > 0 ? (
                <div>
                  {businesses.slice(0, 8).map((b, i) => (
                    <div key={i} style={{
                      padding: "6px 0",
                      borderBottom: i < Math.min(businesses.length, 8) - 1 ? `1px solid ${COLORS.lightBorder}` : "none",
                      fontFamily: FONTS.body, fontSize: 13,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontWeight: 600, color: COLORS.charcoal }}>{b.name}</span>
                      <span style={{ color: COLORS.warmGray, fontSize: 11 }}>{b.category}</span>
                    </div>
                  ))}
                  {businesses.length > 8 && (
                    <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 8 }}>
                      +{businesses.length - 8} more businesses
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray }}>
                    No active business registrations found at this address.
                  </div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>
                    Business registration data reflects SF tax filings at this address. Office tower tenants and large corporations may register at a different address. Commercial tenant data coming in a future update.
                  </div>
                </div>
              )}
            </Section>

            {/* Transit Access */}
            {transit && (
              <Section title="Transit Score">
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: FONTS.display, fontSize: 36, fontWeight: 700, lineHeight: 1,
                    color: transit.score >= 70 ? "#10B981" : transit.score >= 40 ? "#F59E0B" : "#EF4444",
                  }}>
                    {transit.score}
                  </span>
                  <span style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>/ 100</span>
                  {transit.bartAccess && (
                    <span style={{
                      padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: "#009AC720", color: "#009AC7",
                    }}>
                      BART Access
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                  marginBottom: 12, lineHeight: 1.4,
                }}>
                  Transit Score uses a distance-decay accessibility model (800m pedestrian shed, weighted by route type). Standard urban planning methodology.
                </div>
                {transit.nearbyStops.slice(0, 5).map((ns, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 0", borderBottom: `1px solid ${COLORS.lightBorder}`,
                    fontFamily: FONTS.body, fontSize: 12,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: ns.stop.system === "BART" ? "#009AC7" : "#0EA5E9",
                    }} />
                    <span style={{ flex: 1, color: COLORS.charcoal }}>{ns.stop.name}</span>
                    <span style={{ color: COLORS.warmGray, fontSize: 11 }}>{ns.distanceM}m</span>
                  </div>
                ))}
              </Section>
            )}

            {/* Footer CTA */}
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <a
                href="/cbd/downtown"
                style={{
                  display: "inline-block", padding: "12px 28px", borderRadius: 10,
                  background: "#E8652D", color: "#fff", textDecoration: "none",
                  fontFamily: FONTS.body, fontSize: 14, fontWeight: 700,
                }}
              >
                View Full Downtown Intelligence
              </a>
              <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 8 }}>
                Powered by CityPulse &middot; web-five-omega-87.vercel.app
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
