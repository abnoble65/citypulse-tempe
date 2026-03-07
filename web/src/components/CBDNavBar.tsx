/**
 * CBDNavBar.tsx — Branded navigation bar for CBD portal.
 *
 * Uses the CBD's accent_color for active highlights.
 * Responsive: horizontal scroll pills on mobile, full bar on desktop.
 */

import { useState, useEffect } from "react";
import { useCBD } from "../contexts/CBDContext";
import { CityPulseLogo } from "./Icons";
import { LanguageSelector } from "./LanguageSelector";
import { COLORS, FONTS } from "../theme";

const CBD_PAGES = [
  { key: "",             label: "Dashboard" },
  { key: "clean-safe",   label: "Clean & Safe" },
  { key: "permits",      label: "Permits" },
  { key: "311",          label: "311" },
  { key: "business",     label: "Business" },
  { key: "board-packet", label: "Board Packet" },
  { key: "map",          label: "Map" },
];

interface CBDNavBarProps {
  activePath: string;
  onNavigate: (subPath: string) => void;
}

export function CBDNavBar({ activePath, onNavigate }: CBDNavBarProps) {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";
  const accentPale = accent + "18";

  const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(255,255,255,0.97)",
      borderBottom: `1px solid ${COLORS.lightBorder}`,
      backdropFilter: "blur(10px)",
    }}>
      {/* Top row */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: isMobile ? "8px 12px" : "0 24px",
        height: isMobile ? 48 : 56,
        gap: 12,
      }}>
        {/* Back link */}
        <a
          href="/"
          style={{
            fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
            color: COLORS.warmGray, textDecoration: "none",
            flexShrink: 0, transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = COLORS.charcoal)}
          onMouseLeave={e => (e.currentTarget.style.color = COLORS.warmGray)}
        >
          {isMobile ? "←" : "← CityPulse"}
        </a>

        {/* Left: CBD brand */}
        <button
          onClick={() => onNavigate("")}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "none", border: "none", cursor: "pointer",
            padding: 0, flexShrink: 0,
          }}
        >
          {config?.logo_url ? (
            <img src={config.logo_url} alt={config.short_name} style={{ height: 28, borderRadius: 4 }} />
          ) : (
            <span style={{
              fontFamily: FONTS.heading, fontWeight: 700,
              fontSize: isMobile ? 16 : 18,
              color: accent,
            }}>
              {config?.short_name ?? "CBD"}
            </span>
          )}
        </button>
        {/* OPS badge */}
        <span style={{
          background: accent, color: "#fff",
          fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          borderRadius: 6, padding: "2px 7px",
          fontFamily: FONTS.body, letterSpacing: "0.04em",
          flexShrink: 0,
        }}>
          OPS
        </span>

        {/* Center: page links (desktop only) */}
        {!isMobile && (
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            flex: 1, justifyContent: "center",
          }}>
            {CBD_PAGES.map(({ key, label }) => {
              const isActive = activePath === key;
              return (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  style={{
                    background: isActive ? accentPale : "transparent",
                    color: isActive ? accent : COLORS.charcoal,
                    border: "none", cursor: "pointer",
                    borderRadius: 20,
                    padding: "6px 14px",
                    fontFamily: FONTS.body,
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Language + Powered by CityPulse */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginLeft: "auto", flexShrink: 0,
        }}>
          <LanguageSelector />
          <a
            href="/"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              textDecoration: "none", transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <CityPulseLogo size={20} bg={COLORS.warmGray} fg={COLORS.white} />
            {!isMobile && (
              <span style={{
                fontFamily: FONTS.body, fontSize: 11,
                color: COLORS.warmGray, whiteSpace: "nowrap",
              }}>
                Powered by CityPulse
              </span>
            )}
          </a>
        </div>
      </div>

      {/* Mobile sub-nav: horizontal scroll pills */}
      {isMobile && (
        <div style={{
          display: "flex", gap: 6,
          padding: "6px 12px 10px",
          overflowX: "auto",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}>
          {CBD_PAGES.map(({ key, label }) => {
            const isActive = activePath === key;
            return (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                style={{
                  flexShrink: 0,
                  background: isActive ? accentPale : COLORS.cream,
                  color: isActive ? accent : COLORS.midGray,
                  border: isActive ? `1.5px solid ${accent}` : "1.5px solid transparent",
                  borderRadius: 24,
                  padding: "6px 14px",
                  fontFamily: FONTS.body,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
          <div style={{ width: 16, flexShrink: 0 }} />
        </div>
      )}
    </nav>
  );
}
