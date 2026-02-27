import { useState, lazy, Suspense } from "react";
import { COLORS, FONTS } from "../theme";
import { CityPulseLogo } from "../components/Icons";
import { SupervisorAvatar } from "../components/SupervisorAvatar";
import { DISTRICTS, DEFAULT_DISTRICT, CITYWIDE_DISTRICT } from "../districts";
import type { DistrictConfig } from "../districts";

const SFDistrictMapLazy = lazy(() =>
  import("../components/SFDistrictMap").then(m => ({ default: m.SFDistrictMap }))
);

interface HomeProps {
  onNavigate: (page: string) => void;
  onGenerate: (district: DistrictConfig) => void;
  loading:    boolean;
  error:      string | null;
}

/** Current SF Board of Supervisors (2025) */
const SUPERVISORS: Record<string, string> = {
  "1":  "Connie Chan",
  "2":  "Stephen Sherrill",
  "3":  "Danny Sauter",
  "4":  "Alan Wong",
  "5":  "Bilal Mahmood",
  "6":  "Matt Dorsey",
  "7":  "Myrna Melgar",
  "8":  "Rafael Mandelman",
  "9":  "Jackie Fielder",
  "10": "Shamann Walton",
  "11": "Chyanne Chen",
};

const DISTRICT_LIST = Object.values(DISTRICTS);

export function Home({ onGenerate, loading, error }: HomeProps) {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictConfig>(DEFAULT_DISTRICT);
  const [hoveredDistrict,  setHoveredDistrict]  = useState<string | null>(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.cream,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
    }}>
      <div style={{ marginBottom: 40, filter: "drop-shadow(0 6px 24px rgba(212,100,59,0.2))" }}>
        <CityPulseLogo size={72} />
      </div>

      <h1 style={{
        fontFamily: FONTS.heading,
        fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 800,
        color: COLORS.charcoal, textAlign: "center",
        lineHeight: 1.05, letterSpacing: "-0.02em",
        marginBottom: 16, maxWidth: 600,
      }}>
        CityPulse
        <br />
        <span style={{ color: COLORS.orange }}>San Francisco</span>
      </h1>

      <p style={{
        color: COLORS.midGray, fontSize: 17,
        textAlign: "center", maxWidth: 440,
        lineHeight: 1.6, marginBottom: 44, fontFamily: FONTS.body,
      }}>
        Live permit, planning, and development intelligence across all 11 SF Supervisor Districts.
      </p>

      {/* SF District reference map */}
      <div style={{
        width: "100%", maxWidth: 860, marginBottom: 28,
        borderRadius: 16, overflow: "hidden",
        border: `1px solid ${COLORS.lightBorder}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}>
        <Suspense fallback={<div style={{ height: 220, background: COLORS.cream }} />}>
          <SFDistrictMapLazy
            selectedDistrict={selectedDistrict.number}
            onSelectDistrict={num => {
              if (num === "0") {
                setSelectedDistrict(CITYWIDE_DISTRICT);
              } else {
                setSelectedDistrict(DISTRICTS[num] ?? DEFAULT_DISTRICT);
              }
            }}
            disabled={loading}
          />
        </Suspense>
      </div>

      {/* District selector */}
      <div style={{ width: "100%", maxWidth: 860, marginBottom: 36 }}>
        <p style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 700,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 14, textAlign: "center",
        }}>
          Select a Supervisor District
        </p>

        {/* District grid — Citywide first (spans 2 cols), then D1–D11 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))",
          gap: 8,
        }}>
          {/* Citywide — spans 2 columns, 2× height, primary option */}
          {(() => {
            const isSelected = selectedDistrict.number === "0";
            const isHovered  = hoveredDistrict === "0";
            return (
              <button
                onClick={() => setSelectedDistrict(CITYWIDE_DISTRICT)}
                onMouseEnter={() => setHoveredDistrict("0")}
                onMouseLeave={() => setHoveredDistrict(null)}
                disabled={loading}
                style={{
                  gridColumn: "span 2",
                  minHeight: 148,
                  position: "relative",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(212,100,59,0.13) 0%, rgba(232,132,75,0.07) 100%)"
                    : isHovered
                    ? "linear-gradient(135deg, #FAF2ED 0%, #F7EDE7 100%)"
                    : "linear-gradient(135deg, #FAF6F2 0%, #F5EFE9 100%)",
                  border: `2px solid ${isSelected ? COLORS.orange : isHovered ? "rgba(212,100,59,0.35)" : "rgba(212,100,59,0.20)"}`,
                  borderRadius: 18,
                  padding: "26px 28px",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                  display: "flex", alignItems: "center", gap: 22,
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 6px 24px rgba(212,100,59,0.16)"
                    : isHovered
                    ? "0 6px 20px rgba(212,100,59,0.10)"
                    : "0 2px 10px rgba(212,100,59,0.07)",
                  transform: isHovered && !isSelected ? "translateY(-2px)" : "none",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {/* Badge — top right */}
                <div style={{
                  position: "absolute", top: 13, right: 15,
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  borderRadius: 10, padding: "3px 10px",
                  ...(isSelected
                    ? { background: COLORS.orange, color: COLORS.white }
                    : { background: COLORS.orangePale, color: COLORS.orange,
                        border: "1px solid rgba(212,100,59,0.22)" }),
                }}>
                  {isSelected ? "✓ Selected" : "Start here"}
                </div>

                <span style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>🌁</span>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'Urbanist', sans-serif",
                    fontSize: 30, fontWeight: 800,
                    color: isSelected ? COLORS.orange : COLORS.charcoal,
                    letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 7,
                  }}>
                    SF Citywide
                  </div>
                  <div style={{
                    fontFamily: FONTS.body, fontSize: 13,
                    color: isSelected ? COLORS.orange : COLORS.warmGray,
                    lineHeight: 1.5, marginBottom: 12,
                  }}>
                    All 11 Supervisor Districts · Full city urban intelligence
                  </div>
                  {/* Data type tags */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Permits", "Pipeline", "Planning", "Evictions", "Assessments"].map(tag => (
                      <span key={tag} style={{
                        fontFamily: FONTS.body, fontSize: 10, fontWeight: 600,
                        color: isSelected ? COLORS.orange : COLORS.warmGray,
                        background: isSelected ? "rgba(212,100,59,0.09)" : "rgba(0,0,0,0.045)",
                        borderRadius: 6, padding: "3px 9px",
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })()}

          {DISTRICT_LIST.map(d => {
            const isSelected = selectedDistrict.number === d.number;
            const isHovered  = hoveredDistrict === d.number;
            const supervisor = SUPERVISORS[d.number] ?? "";
            return (
              <button
                key={d.number}
                onClick={() => setSelectedDistrict(d)}
                onMouseEnter={() => setHoveredDistrict(d.number)}
                onMouseLeave={() => setHoveredDistrict(null)}
                disabled={loading}
                style={{
                  background: isSelected ? COLORS.orangePale : COLORS.white,
                  border: `1.5px solid ${isSelected ? COLORS.orange : COLORS.lightBorder}`,
                  borderRadius: 14,
                  padding: "12px 16px",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 4px 16px rgba(212,100,59,0.12)"
                    : isHovered
                    ? "0 4px 14px rgba(0,0,0,0.08)"
                    : "0 1px 4px rgba(0,0,0,0.04)",
                  transform: isHovered && !isSelected ? "translateY(-2px)" : "none",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{
                      fontFamily: "'Urbanist',sans-serif",
                      fontSize: 24, fontWeight: 800,
                      color: isSelected ? COLORS.orange : COLORS.charcoal,
                      lineHeight: 1, marginBottom: 4,
                      letterSpacing: "-0.02em",
                    }}>{d.number}</div>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 11,
                      color: isSelected ? COLORS.charcoal : COLORS.warmGray,
                      fontWeight: 500, lineHeight: 1.3,
                    }}>
                      {d.label}
                      {supervisor && (
                        <span style={{ color: isSelected ? COLORS.orange : COLORS.warmGray }}>
                          {" · "}Sup. {supervisor}
                        </span>
                      )}
                    </div>
                  </div>
                  <SupervisorAvatar districtNumber={d.number} size={38} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onGenerate(selectedDistrict)}
        disabled={loading}
        style={{
          background: loading ? COLORS.warmGray : COLORS.orange,
          color: COLORS.white, border: "none", borderRadius: 32,
          padding: "16px 40px", fontSize: 16, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: FONTS.heading,
          boxShadow: loading ? "none" : "0 4px 20px rgba(212,100,59,0.25)",
          transition: "transform 0.2s, box-shadow 0.2s, background 0.3s",
          letterSpacing: "0.01em", opacity: loading ? 0.6 : 1,
        }}>
        {loading ? "Generating…" : `Generate ${selectedDistrict.label} Briefing →`}
      </button>

      {error && (
        <div style={{
          marginTop: 20, background: "#FDEEEE", border: "1px solid #F0C8C8",
          borderRadius: 12, padding: "12px 20px", color: "#B44040",
          fontSize: 13, fontFamily: FONTS.body, maxWidth: 440, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
