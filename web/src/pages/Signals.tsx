import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { generateSignals } from "../services/briefing";
import type { Signal } from "../services/briefing";
import type { DistrictData } from "../services/aggregator";

interface SignalsProps {
  aggregatedData: DistrictData | null;
  onNavigate: (page: string) => void;
}

/* ─── Signal card ────────────────────────────── */

const SEVERITY_CFG = {
  high:   { label: "HIGH",   bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" },
  medium: { label: "MEDIUM", bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" },
  low:    { label: "LOW",    bg: COLORS.softBlue, text: "#4A6FA5", border: "#C8D8E8" },
} as const;

function SignalCard({ signal }: { signal: Signal }) {
  const cfg = SEVERITY_CFG[signal.severity] ?? SEVERITY_CFG.low;

  return (
    <div style={{
      background: COLORS.white, borderRadius: 20,
      padding: "32px 36px", marginBottom: 20,
      border: `1px solid ${COLORS.lightBorder}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <h3 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(17px, 2.2vw, 21px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.2, letterSpacing: "-0.01em",
          margin: 0, flex: 1, paddingRight: 16,
        }}>{signal.title}</h3>
        <span style={{
          fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
          color: cfg.text, background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 6, padding: "4px 10px",
          whiteSpace: "nowrap", flexShrink: 0, marginTop: 2,
          letterSpacing: "0.04em",
        }}>{cfg.label}</span>
      </div>

      <p style={{
        fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.75,
        color: COLORS.midGray, margin: 0,
      }}>{signal.body}</p>

      {signal.concern && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          background: COLORS.cream, borderRadius: 12,
          padding: "14px 18px", marginTop: 16,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚡</span>
          <p style={{
            fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 1.65,
            color: COLORS.charcoal, fontWeight: 500, margin: 0,
          }}>{signal.concern}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Concern item (Public Concerns section) ─── */

type ConcernLevel = "high" | "medium" | "watch";

function ConcernItem({ level, title, detail }: {
  level: ConcernLevel;
  title: string;
  detail: string;
}) {
  const cfg = {
    high:   { label: "HIGH",   bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" },
    medium: { label: "MEDIUM", bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" },
    watch:  { label: "WATCH",  bg: COLORS.softBlue, text: "#4A6FA5", border: "#C8D8E8" },
  }[level];

  return (
    <div style={{
      display: "flex", gap: 16, alignItems: "flex-start",
      padding: "20px 0",
      borderBottom: `1px solid ${COLORS.lightBorder}`,
    }}>
      <span style={{
        fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
        color: cfg.text, background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 6, padding: "4px 10px",
        whiteSpace: "nowrap", flexShrink: 0, marginTop: 2,
        letterSpacing: "0.04em",
      }}>{cfg.label}</span>
      <div>
        <div style={{
          fontFamily: "'Urbanist', sans-serif", fontSize: 16,
          fontWeight: 700, color: COLORS.charcoal, marginBottom: 6,
        }}>{title}</div>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.7,
          color: COLORS.midGray, margin: 0,
        }}>{detail}</p>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────── */

export function Signals({ aggregatedData, onNavigate }: SignalsProps) {
  const [filter, setFilter]       = useState("All District 3");
  const [signals, setSignals]     = useState<Signal[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]   = useState<string | null>(null);

  // Generate when filter changes (also fires on mount).
  useEffect(() => {
    if (!aggregatedData) return;

    const neighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip !== null);

    setIsGenerating(true);
    setGenError(null);

    generateSignals(
      aggregatedData,
      neighborhood ? { zip: neighborhood.zip!, name: neighborhood.name } : undefined,
    )
      .then(s => setSignals(s))
      .catch(err => {
        console.error("[Signals] generation failed:", err);
        setGenError(err instanceof Error ? err.message : "Generation failed");
      })
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]); // intentionally only re-run when filter changes

  if (!aggregatedData) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "48px 32px", maxWidth: 380 }}>
          <p style={{
            fontFamily: "'Urbanist', sans-serif", fontSize: 18, fontWeight: 800,
            color: COLORS.charcoal, marginBottom: 12,
          }}>
            No data available
          </p>
          <p style={{ color: COLORS.midGray, fontSize: 14, fontFamily: FONTS.body, lineHeight: 1.65, marginBottom: 28 }}>
            Generate a briefing from the home page to view signals.
          </p>
          <button onClick={() => onNavigate("Home")} style={{
            background: COLORS.orange, color: COLORS.white, border: "none",
            borderRadius: 24, padding: "12px 28px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Urbanist', sans-serif",
          }}>← Go to Home</button>
        </div>
      </div>
    );
  }

  const activeNeighborhood = NEIGHBORHOODS.find(n => n.name === filter && n.zip);
  const locationLabel = activeNeighborhood ? activeNeighborhood.name : "District 3";

  // Map signals → concern items (severity low → "watch")
  const concerns = signals?.map(s => ({
    level: (s.severity === "low" ? "watch" : s.severity) as ConcernLevel,
    title: s.title,
    detail: s.concern,
  }));

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <NeighborhoodHero selected={filter} aggregatedData={aggregatedData} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="Signals" />
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.12, letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          What the data is signalling for {locationLabel}.
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
          marginBottom: 36,
        }}>
          Powered by live DataSF permit activity and development pipeline data.
        </p>

        {/* Loading spinner */}
        {isGenerating && (
          <div style={{
            background: COLORS.white, borderRadius: 20, padding: "60px 32px",
            border: `1px solid ${COLORS.orange}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 16, marginBottom: 24,
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none" stroke={COLORS.orange} strokeWidth="3"
                strokeDasharray="66" strokeDashoffset="50" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate"
                  from="0 18 18" to="360 18 18" dur="0.75s" repeatCount="indefinite" />
              </circle>
            </svg>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: COLORS.charcoal }}>
              Analyzing {locationLabel} permit trends…
            </div>
          </div>
        )}

        {/* Error state */}
        {!isGenerating && genError && (
          <div style={{
            background: "#FDEEEE", border: "1px solid #F0C8C8", borderRadius: 16,
            padding: "36px 32px", textAlign: "center", marginBottom: 24,
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: "#B44040", marginBottom: 10,
            }}>Failed to generate signals</p>
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray, lineHeight: 1.6, margin: 0 }}>
              {genError}
            </p>
          </div>
        )}

        {/* Signal cards */}
        {!isGenerating && signals && signals.map((signal, i) => (
          <SignalCard key={i} signal={signal} />
        ))}

        {/* Public Concerns — derived from signal data */}
        {!isGenerating && concerns && concerns.length > 0 && (
          <>
            <SectionLabel text="Public Concerns" />
            <div style={{
              background: COLORS.white, borderRadius: 20, padding: "40px 44px",
              border: `1px solid ${COLORS.lightBorder}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
            }}>
              <h2 style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 800, color: COLORS.charcoal,
                lineHeight: 1.15, letterSpacing: "-0.02em",
                marginBottom: 8,
              }}>
                What the data raises for residents.
              </h2>
              <p style={{
                fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.8,
                color: COLORS.midGray, marginBottom: 8,
              }}>
                Based on current permit activity and development pipeline for {locationLabel}.
              </p>
              {concerns.map((c, i) => (
                <ConcernItem key={i} level={c.level} title={c.title} detail={c.detail} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
