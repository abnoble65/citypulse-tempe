import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";
import { NeighborhoodHero } from "../components/NeighborhoodHero";
import { SupervisorAvatar } from "../components/SupervisorAvatar";
import { ResidentQuotes } from "../components/ResidentQuotes";
import { generateSignals, getCachedSignals } from "../services/briefing";
import type { Signal } from "../services/briefing";
import type { DistrictData } from "../services/aggregator";
import type { DistrictConfig } from "../districts";
import { ViewIn3DButton } from "../components/ViewIn3D";
import type { CC3DPayload } from "../components/ViewIn3D";

interface SignalsProps {
  aggregatedData: DistrictData | null;
  districtConfig: DistrictConfig;
  onNavigate: (page: string) => void;
}

/* ─── Signal card ────────────────────────────── */

const SEVERITY_CFG = {
  high:   { label: "HIGH",   bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" },
  medium: { label: "MEDIUM", bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" },
  low:    { label: "LOW",    bg: COLORS.softBlue, text: "#4A6FA5", border: "#C8D8E8" },
} as const;

function SignalCard({ signal, payload }: { signal: Signal; payload: CC3DPayload }) {
  const cfg = SEVERITY_CFG[signal.severity] ?? SEVERITY_CFG.low;

  return (
    <div style={{
      background: COLORS.white, borderRadius: 20,
      padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 36px)", marginBottom: 20,
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

      {!!signal.concern && (
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
      <ViewIn3DButton payload={payload} />
    </div>
  );
}

/* ─── Concern item (Public Concerns section) ─── */

type ConcernLevel = "high" | "medium" | "watch";

function ConcernItem({ level, title, detail, payload }: {
  level: ConcernLevel;
  title: string;
  detail: string;
  payload: CC3DPayload;
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
        <ViewIn3DButton payload={payload} />
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────── */

function formatLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Generated today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Generated ${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

export function Signals({ aggregatedData, districtConfig }: SignalsProps) {
  const [filter, setFilter]             = useState(districtConfig.allLabel);
  const [signals, setSignals]           = useState<Signal[] | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]         = useState<string | null>(null);

  // Reset filter when district changes
  useEffect(() => {
    setFilter(districtConfig.allLabel);
  }, [districtConfig.allLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate when filter changes (also fires on mount).
  useEffect(() => {
    if (!aggregatedData) return;

    const neighborhood = districtConfig.neighborhoods.find(n => n.name === filter);
    const focus = neighborhood ? { zip: neighborhood.zip, name: neighborhood.name } : undefined;

    // Synchronous cache check — instant display, no loading flash
    const cached = getCachedSignals(districtConfig, focus);
    if (cached) {
      setSignals(cached.signals);
      setLastUpdated(cached.generatedAt);
      setIsGenerating(false);
      return;
    }

    // Not cached — debounce 300ms before calling Claude
    setIsGenerating(true);
    setGenError(null);
    const timer = setTimeout(() => {
      generateSignals(aggregatedData, districtConfig, focus)
        .then(({ signals: s, generatedAt }) => {
          setSignals(s);
          setLastUpdated(generatedAt);
        })
        .catch(err => {
          console.error("[Signals] generation failed:", err);
          setGenError(err instanceof Error ? err.message : "Generation failed");
        })
        .finally(() => setIsGenerating(false));
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, aggregatedData]); // re-run when filter changes OR when data first arrives after refresh

  // aggregatedData is null when the user lands directly via URL (refresh/bookmark).
  // App.tsx auto-fetches it behind the LoadingOverlay; show skeletons here as fallback.
  if (!aggregatedData) {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(80px,12vw,120px) 24px" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              background: COLORS.white, borderRadius: 20,
              padding: "clamp(20px,4vw,32px) clamp(16px,4vw,36px)",
              marginBottom: 20, border: `1px solid ${COLORS.lightBorder}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div className="sk" style={{ height: 22, flex: 1, marginRight: 16 }} />
                <div className="sk" style={{ height: 22, width: 70 }} />
              </div>
              <div className="sk" style={{ height: 14, width: "100%", marginBottom: 9 }} />
              <div className="sk" style={{ height: 14, width: "88%", marginBottom: 9 }} />
              <div className="sk" style={{ height: 14, width: "72%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeNeighborhood = districtConfig.neighborhoods.find(n => n.name === filter);
  const locationLabel = activeNeighborhood ? activeNeighborhood.name : districtConfig.label;

  const cc3dPayload: CC3DPayload = {
    address: null,
    lat: null,
    lng: null,
    parcel_apn: null,
    district: districtConfig.label,
    active_layers: ["signals"],
  };

  // Map signals → concern items (severity low → "watch")
  const concerns = signals?.map(s => ({
    level: (s.severity === "low" ? "watch" : s.severity) as ConcernLevel,
    title: s.title,
    detail: s.concern ?? "",
  })).filter(c => c.detail);

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar districtConfig={districtConfig} selected={filter} onSelect={setFilter} />
      <NeighborhoodHero districtConfig={districtConfig} selected={filter} aggregatedData={aggregatedData} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(32px, 6vw, 52px) 24px" }}>
        {districtConfig.number !== "0" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <SupervisorAvatar districtNumber={districtConfig.number} size={60} showName={true} />
          </div>
        )}
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
          marginBottom: lastUpdated ? 8 : 36,
        }}>
          Powered by live DataSF permit activity and development pipeline data.
        </p>
        {lastUpdated && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
            marginBottom: 36, opacity: 0.75,
          }}>
            {formatLastUpdated(lastUpdated)}
          </p>
        )}

        {/* Loading skeletons */}
        {isGenerating && (
          <>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                background: COLORS.white, borderRadius: 20,
                padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 36px)",
                marginBottom: 20,
                border: `1px solid ${COLORS.lightBorder}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div className="sk" style={{ height: 22, flex: 1, marginRight: 16 }} />
                  <div className="sk" style={{ height: 22, width: 70, flexShrink: 0 }} />
                </div>
                <div className="sk" style={{ height: 14, width: "100%", marginBottom: 9 }} />
                <div className="sk" style={{ height: 14, width: "94%", marginBottom: 9 }} />
                <div className="sk" style={{ height: 14, width: "78%", marginBottom: 16 }} />
                <div style={{ background: COLORS.cream, borderRadius: 12, padding: "14px 18px" }}>
                  <div className="sk" style={{ height: 13, width: "86%" }} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Error state */}
        {!isGenerating && genError && (
          <div style={{
            background: COLORS.cream, border: `1px solid ${COLORS.lightBorder}`, borderRadius: 16,
            padding: "36px 32px", textAlign: "center", marginBottom: 24,
          }}>
            <p style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 17, fontWeight: 800,
              color: COLORS.charcoal, marginBottom: 10,
            }}>Signals are being generated</p>
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray, lineHeight: 1.6, margin: 0 }}>
              Check back shortly. If this persists, reload the page.
            </p>
          </div>
        )}

        {/* Signal cards — with resident quotes injected after card index 1 */}
        {!isGenerating && signals && signals.map((signal, i) => (
          <div key={i}>
            <SignalCard signal={signal} payload={cc3dPayload} />
            {/* Inject "What Residents Said" after the 2nd signal (if ≥2 signals exist) */}
            {i === 1 && signals.length >= 2 && (
              <ResidentQuotes
                districtConfig={districtConfig}
                priorityAddresses={(aggregatedData.permit_summary.notable_permits ?? []).slice(0, 5).map(p => p.address)}
                style={{ marginTop: 0 }}
              />
            )}
          </div>
        ))}

        {/* Public Concerns — derived from signal data */}
        {!isGenerating && concerns && concerns.length > 0 && (
          <>
            <SectionLabel text="Public Concerns" />
            <div style={{
              background: COLORS.white, borderRadius: 20, padding: "clamp(20px, 5vw, 40px) clamp(16px, 4vw, 44px)",
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
                <ConcernItem key={i} level={c.level} title={c.title} detail={c.detail} payload={cc3dPayload} />
              ))}
            </div>
          </>
        )}

        {/* Resident quotes fallback — only shown when fewer than 2 signals */}
        {!isGenerating && (!signals || signals.length < 2) && (
          <ResidentQuotes
            districtConfig={districtConfig}
            priorityAddresses={(aggregatedData.permit_summary.notable_permits ?? []).slice(0, 5).map(p => p.address)}
            style={{ marginTop: 0 }}
          />
        )}
      </div>
    </div>
  );
}
