/**
 * CBDPortal.tsx — Top-level wrapper for CBD portal at /cbd/{slug}.
 *
 * Fetches the CBD profile from Supabase, shows a branded transition,
 * then renders CBDNavBar + sub-page router + footer.
 */

import { useState, useEffect, useCallback } from "react";
import { CBDProvider, useCBD } from "../contexts/CBDContext";
import { CBDNavBar } from "./CBDNavBar";
import { CBDDashboard } from "../pages/cbd/CBDDashboard";
import { CleanSafeReport } from "../pages/cbd/CleanSafeReport";
import { BoardPacket } from "../pages/cbd/BoardPacket";
import { CBDPermits } from "../pages/cbd/CBDPermits";
import { CBD311Detail } from "../pages/cbd/CBD311Detail";
import { CBDBusinessPulse } from "../pages/cbd/CBDBusinessPulse";
import { CBDMap } from "../pages/cbd/CBDMap";
import { CityPulseLogo } from "./Icons";
import { COLORS, FONTS } from "../theme";

// ── Coming soon placeholder ────────────────────────────────────────────────

function ComingSoonPage({ title }: { title: string }) {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";
  return (
    <div style={{
      maxWidth: 600, margin: "80px auto", padding: "0 16px", textAlign: "center",
    }}>
      <div style={{
        background: COLORS.white, borderRadius: 16,
        border: `1px solid ${COLORS.lightBorder}`,
        padding: "48px 32px",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: accent + "18", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", fontSize: 22,
        }}>
          {"\u{1F6A7}"}
        </div>
        <h2 style={{
          fontFamily: FONTS.heading, fontSize: 22, fontWeight: 700,
          color: COLORS.charcoal, margin: "0 0 8px",
        }}>
          {title}
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
          margin: 0,
        }}>
          Coming Soon
        </p>
      </div>
    </div>
  );
}

// ── Inactive / not-found page ──────────────────────────────────────────────

function CBDNotFound({ slug }: { slug: string }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
      background: COLORS.cream,
    }}>
      <CityPulseLogo size={64} />
      <h1 style={{
        fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700,
        color: COLORS.charcoal, marginTop: 24,
      }}>
        CBD Portal — Coming Soon
      </h1>
      <p style={{
        fontFamily: FONTS.body, fontSize: 15, color: COLORS.warmGray,
        marginTop: 8, maxWidth: 400, textAlign: "center", lineHeight: 1.6,
      }}>
        The portal for <strong>"{slug}"</strong> is not yet active.
        Check back soon or contact us for more information.
      </p>
      <a href="/" style={{
        display: "inline-block", marginTop: 24,
        fontFamily: FONTS.body, fontSize: 14, fontWeight: 600,
        color: COLORS.orange, textDecoration: "none",
        border: `1px solid ${COLORS.orange}`, borderRadius: 20,
        padding: "8px 24px",
      }}>
        Back to CityPulse
      </a>
    </div>
  );
}

// ── Branded transition animation ───────────────────────────────────────────

function CBDTransition({ name, accent, onDone }: {
  name: string; accent: string; onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      <style>{`
        @keyframes cbd-bg-fade {
          0% { background: ${accent}; }
          100% { background: #ffffff; }
        }
        @keyframes cbd-text-in {
          0% { opacity: 0; transform: translateY(12px); }
          40% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        animation: "cbd-bg-fade 1s ease-out forwards",
      }}>
        <div style={{
          fontFamily: FONTS.heading, fontSize: 36, fontWeight: 700,
          color: "#ffffff",
          animation: "cbd-text-in 1s ease-out forwards",
          textShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}>
          {name}
        </div>
        <div style={{
          fontFamily: FONTS.body, fontSize: 13,
          color: "rgba(255,255,255,0.7)",
          animation: "cbd-text-in 1s ease-out 0.1s forwards",
          opacity: 0,
          marginTop: 8,
        }}>
          CityPulse for Business
        </div>
      </div>
    </>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function CBDFooter() {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";
  return (
    <footer style={{
      marginTop: 48, padding: "20px 24px 28px",
      borderTop: `2px solid ${accent}`,
    }}>
      <div style={{
        maxWidth: 960, margin: "0 auto",
        display: "flex", flexWrap: "wrap", gap: 16,
        alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CityPulseLogo size={20} bg={COLORS.warmGray} fg={COLORS.white} />
          <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray }}>
            CityPulse for Business
          </span>
        </div>

        <div style={{
          display: "flex", gap: 16, flexWrap: "wrap",
          fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
        }}>
          {config?.contact_email && (
            <a href={`mailto:${config.contact_email}`} style={{ color: COLORS.midGray, textDecoration: "none" }}>
              {config.contact_email}
            </a>
          )}
          {config?.contact_phone && (
            <a href={`tel:${config.contact_phone}`} style={{ color: COLORS.midGray, textDecoration: "none" }}>
              {config.contact_phone}
            </a>
          )}
          {config?.website_url && (
            <a href={config.website_url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.midGray, textDecoration: "none" }}>
              Website
            </a>
          )}
        </div>

        <a href="/" style={{
          fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
          color: COLORS.orange, textDecoration: "none",
        }}>
          Back to CityPulse
        </a>
      </div>
    </footer>
  );
}

// ── CBD Shell (nav + router + footer) ──────────────────────────────────────

function CBDShell({ slug }: { slug: string }) {
  const { config, loading, error } = useCBD();
  const [transitionDone, setTransitionDone] = useState(false);
  const [subPath, setSubPath] = useState(() => {
    const full = window.location.pathname;
    const match = full.match(/^\/cbd\/[a-z0-9-]+\/?(.*)$/);
    return (match?.[1] ?? "").replace(/\/$/, "");
  });

  const handleTransitionDone = useCallback(() => setTransitionDone(true), []);

  const navigate = useCallback((path: string) => {
    const url = path ? `/cbd/${slug}/${path}` : `/cbd/${slug}`;
    history.pushState(null, "", url);
    setSubPath(path);
  }, [slug]);

  // Handle back/forward
  useEffect(() => {
    function onPop() {
      const full = window.location.pathname;
      const match = full.match(/^\/cbd\/[a-z0-9-]+\/?(.*)$/);
      setSubPath((match?.[1] ?? "").replace(/\/$/, ""));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Loading
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: COLORS.cream,
      }}>
        <div className="sk" style={{ width: 48, height: 48, borderRadius: 12 }} />
      </div>
    );
  }

  // Error / inactive
  if (error || !config) {
    return <CBDNotFound slug={slug} />;
  }

  // Transition
  if (!transitionDone) {
    return (
      <CBDTransition
        name={config.name}
        accent={config.accent_color}
        onDone={handleTransitionDone}
      />
    );
  }

  const PAGE_TITLES: Record<string, string> = {
    "clean-safe":   "Clean & Safe",
    "permits":      "Permits",
    "311":          "311 Requests",
    "business":     "Business",
    "board-packet": "Board Packet",
    "map":          "Map",
  };

  const renderPage = () => {
    if (!subPath || subPath === "") {
      return <CBDDashboard onNavigate={navigate} />;
    }
    if (subPath === "clean-safe") return <CleanSafeReport />;
    if (subPath === "board-packet") return <BoardPacket />;
    if (subPath === "permits") return <CBDPermits />;
    if (subPath === "311") return <CBD311Detail />;
    if (subPath === "business") return <CBDBusinessPulse />;
    if (subPath === "map") return <CBDMap />;
    const title = PAGE_TITLES[subPath];
    if (title) return <ComingSoonPage title={title} />;
    return <ComingSoonPage title="Page Not Found" />;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: COLORS.cream }}>
      <CBDNavBar activePath={subPath} onNavigate={navigate} />
      <div style={{ flex: 1, animation: "cp-page-in 0.15s ease-out" }}>
        {renderPage()}
      </div>
      <CBDFooter />
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────

export function CBDPortal({ slug }: { slug: string }) {
  return (
    <CBDProvider slug={slug}>
      <CBDShell slug={slug} />
    </CBDProvider>
  );
}
