/**
 * CBDLoadingExperience.tsx — Engaging loading state for CBD portal pages.
 *
 * Replaces plain spinners with cycling headlines, progress bar,
 * live counter, district context card, and skeleton preview.
 */

import { useState, useEffect, useRef } from "react";
import type { CBDConfig } from "../contexts/CBDContext";
import { COLORS, FONTS } from "../theme";

// ── Messages ────────────────────────────────────────────────────────────────

const MESSAGES = [
  "Scanning 311 service requests\u2026",
  "Mapping graffiti and cleaning reports\u2026",
  "Analyzing response times across the district\u2026",
  "Identifying hotspot addresses\u2026",
  "Generating operational recommendations\u2026",
];

// ── Props ───────────────────────────────────────────────────────────────────

interface CBDLoadingProps {
  config: CBDConfig;
  loading: boolean;
  itemCount?: number;
  variant?: "clean-safe" | "dashboard";
}

// ── Component ───────────────────────────────────────────────────────────────

export function CBDLoadingExperience({
  config,
  loading,
  itemCount = 0,
  variant = "clean-safe",
}: CBDLoadingProps) {
  const accent = config.accent_color ?? "#E8652D";

  // ── Headline cycle ──────────────────────────────────────────────────────
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 3000);
    return () => clearInterval(id);
  }, [loading]);

  // ── Simulated counter (smooth ramp toward ~2000 over 12s) ─────────────
  const [simCount, setSimCount] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    if (!loading) return;
    startRef.current = Date.now();
    setSimCount(0);
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      // Ease-out curve: fast start, slows toward 2000
      const target = 2000;
      const progress = 1 - Math.pow(1 - Math.min(elapsed / 12, 1), 3);
      setSimCount(Math.round(target * progress));
    }, 60);
    return () => clearInterval(id);
  }, [loading]);

  // Use real count when available, otherwise simulated
  const displayCount = itemCount > 0 ? itemCount : simCount;

  // ── Fade-out on load complete ─────────────────────────────────────────
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  useEffect(() => {
    if (!loading) {
      setOpacity(0);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
    setVisible(true);
    setOpacity(1);
  }, [loading]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes cbd-msg-fade {
          0%   { opacity: 0; transform: translateY(6px); }
          12%  { opacity: 1; transform: translateY(0); }
          88%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes cbd-progress-sweep {
          0%   { width: 0%; }
          15%  { width: 20%; }
          40%  { width: 50%; }
          70%  { width: 78%; }
          100% { width: 96%; }
        }
        @keyframes cbd-counter-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }
      `}</style>

      <div style={{
        opacity,
        transition: "opacity 0.3s ease",
        padding: "8px 0 24px",
      }}>
        {/* ── Headline + progress area ────────────────────────────── */}
        <div style={{
          background: COLORS.white, borderRadius: 14,
          border: `1px solid ${COLORS.lightBorder}`,
          padding: "32px 28px 28px",
          marginBottom: 20,
          textAlign: "center",
        }}>
          {/* Cycling headline */}
          <div style={{
            minHeight: 28, display: "flex",
            alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}>
            <div
              key={msgIdx}
              style={{
                fontFamily: FONTS.heading, fontSize: 18, fontWeight: 700,
                color: accent,
                animation: "cbd-msg-fade 3s ease-in-out forwards",
              }}
            >
              {MESSAGES[msgIdx]}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            width: "100%", maxWidth: 320, height: 4,
            background: COLORS.lightBorder, borderRadius: 2,
            margin: "0 auto 16px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
              animation: "cbd-progress-sweep 15s ease-in-out forwards",
            }} />
          </div>

          {/* Live counter */}
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.warmGray,
            animation: "cbd-counter-pulse 2s ease-in-out infinite",
          }}>
            {displayCount > 0
              ? `${displayCount.toLocaleString()} requests analyzed`
              : "Connecting to Tempe ArcGIS\u2026"}
          </div>
        </div>

        {/* ── District context card ───────────────────────────────── */}
        <div style={{
          background: COLORS.white, borderRadius: 12,
          border: `1px solid ${COLORS.lightBorder}`,
          borderLeft: `4px solid ${accent}`,
          padding: "18px 20px",
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700,
            color: COLORS.charcoal, marginBottom: 8,
          }}>
            {config.name}
          </div>
          <p style={{
            fontFamily: FONTS.body, fontSize: 13, color: COLORS.midGray,
            margin: 0, lineHeight: 1.6,
          }}>
            {config.description ?? `Analyzing service data for ${config.name}\u2026`}
          </p>
          {config.executive_director && (
            <p style={{
              fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
              margin: "8px 0 0",
            }}>
              Executive Director: <strong style={{ color: COLORS.charcoal }}>{config.executive_director}</strong>
            </p>
          )}
        </div>

        {/* ── Skeleton preview ────────────────────────────────────── */}
        {variant === "clean-safe" ? (
          <CleanSafeSkeleton />
        ) : (
          <DashboardSkeleton />
        )}
      </div>
    </>
  );
}

// ── Clean & Safe skeleton ─────────────────────────────────────────────────

function CleanSafeSkeleton() {
  return (
    <div style={{ opacity: 0.6 }}>
      {/* Summary bar: 6 boxes */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            flex: "1 1 120px", minWidth: 100, height: 72,
            borderRadius: 12,
          }} className="sk" />
        ))}
      </div>

      {/* Map area */}
      <div className="sk" style={{
        height: 200, borderRadius: 12, marginBottom: 20,
      }} />

      {/* Two-column grid: hotspots + trends */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="sk" style={{ height: 220, borderRadius: 12 }} />
        <div className="sk" style={{ height: 220, borderRadius: 12 }} />
      </div>
    </div>
  );
}

// ── Dashboard skeleton ────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div style={{ opacity: 0.6 }}>
      {/* 4 stat boxes */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            flex: "1 1 140px", minWidth: 120, height: 76,
            borderRadius: 12,
          }} className="sk" />
        ))}
      </div>

      {/* 2 section cards */}
      <div className="sk" style={{ height: 160, borderRadius: 12, marginBottom: 16 }} />
      <div className="sk" style={{ height: 160, borderRadius: 12 }} />
    </div>
  );
}
