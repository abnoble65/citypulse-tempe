/**
 * ViewIn3D — "View in 3D" button + coming-soon modal.
 *
 * Renders a small CityPulse-orange button with a cube icon.
 * On click, shows a modal with the CC3D payload preview and
 * "Digital Twin view coming soon — powered by Nextspace".
 */

import { useState } from "react";
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
          maxWidth: 420, width: "100%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          position: "relative",
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
            color: COLORS.charcoal, margin: "0 0 6px",
          }}>
            Digital Twin View
          </h3>
          <p style={{
            fontFamily: FONTS.body, fontSize: 14,
            color: COLORS.warmGray, margin: 0,
          }}>
            Coming soon — powered by Nextspace
          </p>
        </div>

        {/* Payload preview */}
        <div style={{
          background: COLORS.cream, borderRadius: 12,
          padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: COLORS.orange,
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 10, fontFamily: FONTS.body,
          }}>CC3D Context</div>
          <table style={{ fontSize: 13, fontFamily: FONTS.body, borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              <PayloadRow label="Address" value={payload.address} />
              <PayloadRow label="District" value={payload.district} />
              <PayloadRow label="Lat / Lng" value={
                payload.lat != null && payload.lng != null
                  ? `${payload.lat.toFixed(5)}, ${payload.lng.toFixed(5)}`
                  : null
              } />
              <PayloadRow label="APN" value={payload.parcel_apn} />
              <PayloadRow label="Layers" value={payload.active_layers.join(", ") || null} />
            </tbody>
          </table>
        </div>

        {/* JSON blob */}
        <details style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.midGray }}>
          <summary style={{ cursor: "pointer", marginBottom: 6, fontWeight: 600 }}>Raw JSON payload</summary>
          <pre style={{
            background: "#1E1E1E", color: "#D4D4D4",
            borderRadius: 8, padding: 12,
            fontSize: 11, lineHeight: 1.5,
            overflow: "auto", maxHeight: 160,
          }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
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
