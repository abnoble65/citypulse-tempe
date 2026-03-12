/**
 * ViewIn3D — "View in 3D" button + coming-soon modal.
 *
 * Renders a small CityPulse-orange button with a cube icon.
 * On click, shows a modal with the CC3D payload preview and
 * "Digital Twin view coming soon — powered by Nextspace".
 */

import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";

// ── CC3D shared context payload ──────────────────────────────────────────────

export interface CC3DPayload {
  address:       string | null;
  lat:           number | null;
  lng:           number | null;
  parcel_apn:    string | null;
  district:      string;
  active_layers: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeAPN(apn: string): string {
  return apn.replace(/-/g, "");
}

// ── Intelligence Package types ───────────────────────────────────────────────

interface IntelPackage {
  identity: {
    apn: string;
  };
  building_attributes: {
    primary_land_use: string | null;
    stories: number | null;
    year_built: number | null;
    zoning_code: string | null;
  };
  intelligence: {
    readiness_score: number;
    readiness_label: string;
    permit_activity_signal: string;
    total_permits: number;
    total_hearings: number;
  };
}

// ── Cube icon (inline SVG) ───────────────────────────────────────────────────

function CubeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────

interface ViewIn3DButtonProps {
  payload: CC3DPayload;
  /** Compact mode for popups — smaller text, no label */
  compact?: boolean;
}

export function ViewIn3DButton({ payload, compact }: ViewIn3DButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: compact ? 4 : 6,
          background: COLORS.orangePale,
          color: COLORS.orange,
          border: `1px solid rgba(212,100,59,0.25)`,
          borderRadius: 8,
          padding: compact ? "4px 8px" : "6px 12px",
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          fontFamily: FONTS.body,
          cursor: "pointer",
          letterSpacing: "0.02em",
          marginTop: compact ? 8 : 12,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#F9DFD3")}
        onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.orangePale)}
      >
        <CubeIcon size={compact ? 12 : 14} />
        {!compact && "View in 3D"}
        {compact && "3D"}
      </button>

      {open && <DigitalTwinModal payload={payload} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

function DigitalTwinModal({ payload, onClose }: { payload: CC3DPayload; onClose: () => void }) {
  const [intel, setIntel] = useState<IntelPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextspaceBase = import.meta.env.VITE_NEXTSPACE_BASE_URL as string | undefined;

  useEffect(() => {
    if (!payload.parcel_apn) return;
    const apn = normalizeAPN(payload.parcel_apn);
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const url = `${base}/api/nextspace-package?apn=${encodeURIComponent(apn)}`;

    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load intelligence package (${res.status})`);
        return res.json();
      })
      .then((data: IntelPackage) => {
        setIntel(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }, [payload.parcel_apn]);

  const tileStyle: React.CSSProperties = {
    background: COLORS.cream, borderRadius: 12,
    padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 4,
  };
  const tileLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: COLORS.orange,
    letterSpacing: "0.06em", textTransform: "uppercase",
    fontFamily: FONTS.body,
  };
  const tileValueStyle: React.CSSProperties = {
    fontSize: 20, fontWeight: 800, color: COLORS.charcoal,
    fontFamily: "'Urbanist', sans-serif",
  };
  const tileSubStyle: React.CSSProperties = {
    fontSize: 12, color: COLORS.warmGray, fontFamily: FONTS.body,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white, borderRadius: 20,
          padding: "clamp(24px, 5vw, 36px)",
          maxWidth: 480, width: "100%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          position: "relative",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Close X */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "none", border: "none",
            fontSize: 20, color: COLORS.warmGray, cursor: "pointer",
            lineHeight: 1,
          }}
          aria-label="Close"
        >&times;</button>

        {/* Icon + heading */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16,
            background: COLORS.orangePale,
            marginBottom: 14,
          }}>
            <CubeIcon size={28} />
          </div>
          <h3 style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize: 20, fontWeight: 800,
            color: COLORS.charcoal, margin: "0 0 4px",
          }}>
            {payload.address ?? "Digital Twin View"}
          </h3>
          <p style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.warmGray, margin: 0,
          }}>
            {payload.district}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{
            textAlign: "center", padding: "32px 0",
            fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
          }}>
            Loading intelligence package…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8",
            borderRadius: 12, padding: "16px 20px", marginBottom: 16,
            fontFamily: FONTS.body, fontSize: 13, color: "#B44040",
          }}>
            {error}
          </div>
        )}

        {/* Intelligence data */}
        {intel && !loading && (
          <>
            {/* Score tiles — 2-column grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 10, marginBottom: 16,
            }}>
              {/* Dev Readiness */}
              <div style={tileStyle}>
                <div style={tileLabelStyle}>Dev Readiness</div>
                <div style={tileValueStyle}>
                  {intel.intelligence.readiness_score ?? "—"}
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.warmGray }}> / 100</span>
                </div>
                <div style={tileSubStyle}>{intel.intelligence.readiness_label ?? "—"}</div>
              </div>

              {/* Readiness Label */}
              <div style={tileStyle}>
                <div style={tileLabelStyle}>Readiness</div>
                <div style={{
                  ...tileValueStyle,
                  color: intel.intelligence.readiness_label === "PRIME" ? "#3D7A3F"
                       : intel.intelligence.readiness_label === "HIGH" ? "#B47A2E"
                       : intel.intelligence.readiness_label === "WATCH" ? COLORS.orange
                       : COLORS.warmGray,
                }}>
                  {intel.intelligence.readiness_label ?? "—"}
                </div>
              </div>

              {/* Permit Activity */}
              <div style={tileStyle}>
                <div style={tileLabelStyle}>Permit Activity</div>
                <div style={tileValueStyle}>{intel.intelligence.total_permits ?? "—"}</div>
                <div style={tileSubStyle}>{intel.intelligence.permit_activity_signal ?? "—"}</div>
              </div>

              {/* Hearings */}
              <div style={tileStyle}>
                <div style={tileLabelStyle}>Hearings</div>
                <div style={tileValueStyle}>{intel.intelligence.total_hearings ?? "—"}</div>
                <div style={tileSubStyle}>commission hearings</div>
              </div>
            </div>

            {/* Property details table */}
            <div style={{
              background: COLORS.cream, borderRadius: 12,
              padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.orange,
                letterSpacing: "0.06em", textTransform: "uppercase",
                marginBottom: 10, fontFamily: FONTS.body,
              }}>Property Details</div>
              <table style={{ fontSize: 13, fontFamily: FONTS.body, borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  <PayloadRow label="Primary Use" value={intel.building_attributes.primary_land_use} />
                  <PayloadRow label="Stories" value={intel.building_attributes.stories != null ? String(intel.building_attributes.stories) : null} />
                  <PayloadRow label="Year Built" value={intel.building_attributes.year_built != null ? String(intel.building_attributes.year_built) : null} />
                  <PayloadRow label="Zoning" value={intel.building_attributes.zoning_code} />
                  <PayloadRow label="APN" value={intel.identity.apn} />
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* No APN fallback */}
        {!payload.parcel_apn && !loading && !error && (
          <div style={{
            textAlign: "center", padding: "24px 0",
            fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
          }}>
            No parcel APN available for this location.
          </div>
        )}

        {/* Open in Nextspace */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          {nextspaceBase ? (
            <a
              href={`${nextspaceBase}/scene?apn=${payload.parcel_apn ? normalizeAPN(payload.parcel_apn) : ""}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: COLORS.orange, color: COLORS.white,
                border: "none", borderRadius: 12,
                padding: "12px 24px", fontSize: 14, fontWeight: 700,
                fontFamily: "'Urbanist', sans-serif",
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(212,100,59,0.15)",
                transition: "opacity 0.15s",
              }}
            >
              <CubeIcon size={16} />
              Open in Nextspace
            </a>
          ) : (
            <p style={{
              fontFamily: FONTS.body, fontSize: 12,
              color: COLORS.warmGray, margin: 0,
            }}>
              Nextspace scene not yet configured
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PayloadRow({ label, value }: { label: string; value: string | null }) {
  return (
    <tr>
      <td style={{ color: COLORS.warmGray, paddingRight: 12, paddingBottom: 4, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ color: COLORS.charcoal, paddingBottom: 4 }}>{value ?? "—"}</td>
    </tr>
  );
}
