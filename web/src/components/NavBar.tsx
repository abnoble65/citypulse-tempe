import React, { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { CityPulseLogo } from "./Icons";
import { LanguageSelector } from "./LanguageSelector";
import type { DistrictConfig } from "../districts";

interface NavBarProps {
  activePage:     string;
  onNavigate:     (page: string) => void;
  districtConfig: DistrictConfig;
}

const NAV_GROUPS = [
  { id: "intelligence", label: "Intelligence", shortLabel: "INTEL",  pages: ["Briefing", "Signals", "Outlook"] },
  { id: "data",         label: "Data",         shortLabel: "DATA",   pages: ["Charts", "MapPage"] },
];

// Display label overrides for pages whose name differs from their nav label
const PAGE_LABELS: Record<string, string> = { MorningGlance: "Pulse", MapPage: "Map", SiteSelection: "Sites" };
function pageLabel(p: string): string { return PAGE_LABELS[p] ?? p; }

/* ── Inline SVG icons for mobile tab bar ─────────────────────────────────── */

function IntelIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="3" fill="currentColor" />
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DataIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="currentColor">
      <rect x="1"  y="11" width="4" height="6" rx="1" />
      <rect x="7"  y="7"  width="4" height="10" rx="1" />
      <rect x="13" y="3"  width="4" height="14" rx="1" />
    </svg>
  );
}


const GROUP_ICONS: Record<string, (props: { size?: number }) => React.ReactElement> = {
  intelligence: IntelIcon,
  data:         DataIcon,
};

function LiveBadge() {
  return (
    <span
      title="CityPulse pulls live data from Tempe ArcGIS and other city sources"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 700, fontFamily: FONTS.body,
        color: "#5B9A5F", letterSpacing: "0.06em", textTransform: "uppercase",
        userSelect: "none", cursor: "default",
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: "#5B9A5F",
        boxShadow: "0 0 4px rgba(91,154,95,0.5)",
      }} />
      Live
    </span>
  );
}

/* ── NavBar ──────────────────────────────────────────────────────────────── */

export function NavBar({ activePage, onNavigate, districtConfig: _districtConfig }: NavBarProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );

  useEffect(() => {
    const mq      = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const activeGroup = NAV_GROUPS.find(g => g.pages.includes(activePage)) ?? NAV_GROUPS[0];

  /* ── Desktop ─────────────────────────────────────────────────────────── */
  if (!isMobile) {
    return (
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
        height: 60,
        display: "flex", alignItems: "center",
        padding: "0 20px",
      }}>
        {/* Logo */}
        <div
          onClick={() => onNavigate("Home")}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0, marginRight: 16 }}
        >
          <CityPulseLogo size={28} />
          <span style={{
            color: COLORS.charcoal, fontSize: 17, fontWeight: 700,
            letterSpacing: "-0.02em", fontFamily: FONTS.heading,
          }}>CityPulse</span>
        </div>

        {/* Grouped pills */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          overflowX: "auto", scrollbarWidth: "none", minWidth: 0,
        }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Vertical divider between groups */}
              {gi > 0 && (
                <div style={{
                  width: 1, height: 18, background: COLORS.lightBorder,
                  margin: "0 10px", flexShrink: 0,
                }} />
              )}
              {/* Group label */}
              <span style={{
                fontSize: 9, fontWeight: 700, color: COLORS.warmGray,
                letterSpacing: "0.12em", textTransform: "uppercase",
                fontFamily: FONTS.body, marginRight: 2, flexShrink: 0,
                userSelect: "none",
              }}>
                {group.shortLabel}
              </span>
              {/* Page pills */}
              {group.pages.map(p => (
                <button key={p} onClick={() => onNavigate(p)}
                  style={{
                    background: activePage === p ? COLORS.orangePale : "transparent",
                    color:      activePage === p ? COLORS.orange     : COLORS.midGray,
                    border: "none", borderRadius: 20,
                    padding: "6px 13px", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: FONTS.body, whiteSpace: "nowrap",
                  }}>
                  {pageLabel(p)}
                </button>
              ))}
            </div>
          ))}

        </div>

        {/* Live indicator + language */}
        <div style={{ flexShrink: 0, marginLeft: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <LiveBadge />
          <LanguageSelector />
        </div>
      </nav>
    );
  }

  /* ── Mobile ──────────────────────────────────────────────────────────── */
  // Sticky top = 48px (logo row) + 44px (sub-page tabs) = 92px
  // Fixed bottom = 56px (group tabs) + safe-area
  return (
    <>
      {/* Body padding clears the fixed bottom group tab bar */}
      <style>{`body { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }`}</style>

      {/* ── Sticky top nav (92px total) ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
      }}>
        {/* Row 1 — Logo + district badge (48px) */}
        <div style={{
          height: 48, display: "flex", alignItems: "center",
          padding: "0 16px", justifyContent: "space-between",
        }}>
          <div
            onClick={() => onNavigate("Home")}
            style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
          >
            <CityPulseLogo size={24} />
            <span style={{
              color: COLORS.charcoal, fontSize: 16, fontWeight: 700,
              letterSpacing: "-0.02em", fontFamily: FONTS.heading,
            }}>CityPulse</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LiveBadge />
            <LanguageSelector />
          </div>
        </div>

        {/* Row 2 — Sub-page tabs (44px), above the content area */}
        <div style={{
          height: 44, display: "flex", alignItems: "center",
          padding: "0 12px", gap: 6,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none" as const,
          borderTop: `1px solid ${COLORS.lightBorder}`,
          background: COLORS.cream,
        }}>
          {activeGroup.pages.map(p => (
            <button key={p} onClick={() => onNavigate(p)}
              style={{
                background: activePage === p ? COLORS.orange : COLORS.white,
                color:      activePage === p ? COLORS.white  : COLORS.midGray,
                border: `1px solid ${activePage === p ? COLORS.orange : COLORS.lightBorder}`,
                borderRadius: 20,
                padding: "5px 14px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s",
                fontFamily: FONTS.body, whiteSpace: "nowrap", flexShrink: 0,
                minHeight: 32,
              }}>
              {pageLabel(p)}
            </button>
          ))}
          <div style={{ flexShrink: 0, width: 12 }} aria-hidden="true" />
        </div>
      </nav>

      {/* ── Fixed bottom: group tab bar only (56px + safe area) ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: COLORS.white,
        borderTop: `1px solid ${COLORS.lightBorder}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{ height: 56, display: "flex" }}>
          {NAV_GROUPS.map(group => {
            const Icon          = GROUP_ICONS[group.id];
            const isActiveGroup = group.id === activeGroup.id;
            return (
              <button key={group.id}
                onClick={() => {
                  if (!group.pages.includes(activePage)) onNavigate(group.pages[0]);
                }}
                style={{
                  flex: 1, border: "none",
                  background: isActiveGroup ? COLORS.orangePale : "transparent",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 3, cursor: "pointer", transition: "background 0.15s",
                  color: isActiveGroup ? COLORS.orange : COLORS.warmGray,
                  fontFamily: FONTS.body,
                }}>
                <Icon size={18} />
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                }}>
                  {group.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
