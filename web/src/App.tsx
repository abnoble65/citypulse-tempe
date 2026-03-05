import { useState, useEffect, lazy, Suspense } from "react";
import { NavBar } from "./components/NavBar";
import { SplashScreen } from "./components/SplashScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { generateBriefing } from "./services/briefing";
import type { DistrictData } from "./services/briefing";
import { aggregateDistrictData, aggregateCitywideData } from "./services/aggregator";
import { DEFAULT_DISTRICT, DISTRICTS, CITYWIDE_DISTRICT } from "./districts";
import type { DistrictConfig } from "./districts";
import { CityPulseLogo } from "./components/Icons";
import { CityPulseChat } from "./components/CityPulseChat";

const LOADING_MESSAGES = [
  "Connecting to DataSF…",
  "Pulling live permit data…",
  "Analyzing development pipeline…",
  "Generating AI briefing…",
  "Compiling charts…",
  "Almost ready…",
];

function LoadingOverlay({ loading }: { loading: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    if (!loading) { setMsgIndex(0); return; }
    const id = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [loading]);
  if (!loading) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(250,248,245,0.92)", backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <style>{`
        @keyframes pulse-glow {
          0%,100%{transform:scale(1);filter:drop-shadow(0 4px 20px rgba(212,100,59,0.15))}
          50%{transform:scale(1.06);filter:drop-shadow(0 6px 28px rgba(212,100,59,0.3))}
        }
        @keyframes dot-bounce {
          0%,80%,100%{opacity:0.3;transform:scale(0.8)}
          40%{opacity:1;transform:scale(1.2)}
        }
        @keyframes progress-sweep {
          0%{width:0%} 20%{width:25%} 50%{width:55%} 80%{width:85%} 100%{width:98%}
        }
      `}</style>
      <div style={{ animation: "pulse-glow 2s ease-in-out infinite", marginBottom: 36 }}>
        <CityPulseLogo size={80} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#D4643B", opacity: 0.3,
            animation: `dot-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </div>
      <p style={{ fontFamily: "'Lexend',sans-serif", fontSize: 16, fontWeight: 600, color: "#3D3832", minHeight: 24 }}>
        {LOADING_MESSAGES[msgIndex]}
      </p>
      <p style={{ fontFamily: "'Lexend',sans-serif", fontSize: 13, color: "#B0A89E", marginTop: 10 }}>
        This may take a few seconds
      </p>
      <div style={{ width: "min(240px,80vw)", height: 4, background: "#EDE8E3", borderRadius: 2, marginTop: 24, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg,#D4643B,#E8845E)",
          borderRadius: 2,
          animation: "progress-sweep 14s ease-in-out forwards",
        }} />
      </div>
    </div>
  );
}

// Lazy-load all pages except Home (initial view) — each becomes its own JS chunk
const MorningGlance = lazy(() => import("./pages/MorningGlance").then(m => ({ default: m.MorningGlance })));
const Briefing   = lazy(() => import("./pages/Briefing").then(m => ({ default: m.Briefing })));
const Charts     = lazy(() => import("./pages/Charts").then(m => ({ default: m.Charts })));
const Signals    = lazy(() => import("./pages/Signals").then(m => ({ default: m.Signals })));
const Outlook    = lazy(() => import("./pages/Outlook").then(m => ({ default: m.Outlook })));
const Commission = lazy(() => import("./pages/Commission").then(m => ({ default: m.Commission })));
const MapPage    = lazy(() => import("./pages/MapPage").then(m => ({ default: m.MapPage })));
const Board      = lazy(() => import("./pages/Board").then(m => ({ default: m.Board })));
const Mayor      = lazy(() => import("./pages/Mayor").then(m => ({ default: m.Mayor })));
const Parks      = lazy(() => import("./pages/Parks").then(m => ({ default: m.Parks })));
const SiteSelection = lazy(() => import("./pages/SiteSelection").then(m => ({ default: m.SiteSelection })));

const SPLASH_KEY = "citypulse_splash_seen";

// ── URL ↔ page name mapping ───────────────────────────────────────────────────
const PATH_TO_PAGE: Record<string, string> = {
  "":             "Home",
  "pulse":        "MorningGlance",
  "briefing":     "Briefing",
  "charts":       "Charts",
  "signals":      "Signals",
  "outlook":      "Outlook",
  "commission":   "Commission",
  "map":          "MapPage",
  "board":        "Board",
  "mayor":        "Mayor",
  "parks":        "Parks",
  "demo/site-selection": "SiteSelection",
};

// Pages whose names don't map cleanly to lowercase paths
const PAGE_TO_PATH: Record<string, string> = {
  MorningGlance:  "/pulse",
  MapPage:        "/map",
  SiteSelection:  "/demo/site-selection",
};

function pageFromPath(path: string): string {
  const seg = path.replace(/^\//, "").toLowerCase();
  return PATH_TO_PAGE[seg] ?? "Home";
}

function pathFromPage(pageName: string): string {
  return PAGE_TO_PATH[pageName] ?? (pageName === "Home" ? "/" : `/${pageName.toLowerCase()}`);
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem(SPLASH_KEY) === "1");

  function handleSplashComplete() {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setSplashDone(true);
  }

  // ── DEBUG LOGGING ──────────────────────────────────────────────────────────
  console.log("[CP] RENDER", {
    pathname: window.location.pathname,
    initialPage: pageFromPath(window.location.pathname),
  });

  // Initialise from URL so a refresh lands on the correct page
  const [page, setPage] = useState(() => {
    const initial = pageFromPath(window.location.pathname);
    console.log("[CP] INIT useState page =", initial, "| pathname:", window.location.pathname);
    return initial;
  });
  const [briefingText, setBriefingText]       = useState("");
  const [aggregatedData, setAggregatedData]   = useState<DistrictData | null>(null);
  const [districtConfig, setDistrictConfig]   = useState<DistrictConfig>(() => {
    try {
      const saved = localStorage.getItem("citypulse_district");
      if (saved === "0") return CITYWIDE_DISTRICT;
      if (saved && DISTRICTS[saved]) return DISTRICTS[saved];
    } catch { /* ignore */ }
    return DEFAULT_DISTRICT;
  });
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Persist district selection to localStorage
  useEffect(() => {
    try { localStorage.setItem("citypulse_district", districtConfig.number); } catch { /* ignore */ }
  }, [districtConfig.number]);

  // Keep URL in sync with page state
  function navigate(newPage: string) {
    console.log("[CP] PAGE_CHANGE (navigate)", { from: page, to: newPage });
    history.pushState(null, "", pathFromPage(newPage));
    setPage(newPage);
  }

  // Handle browser back/forward buttons
  useEffect(() => {
    function onPop() {
      const newPage = pageFromPath(window.location.pathname);
      console.log("[CP] PAGE_CHANGE (popstate)", { pathname: window.location.pathname, newPage });
      setPage(newPage);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Auto-load DataSF data when the user lands directly on a data-dependent page
  // (e.g. via bookmark or refresh). aggregatedData is in-memory-only so it's
  // always null on a fresh load — we fetch without triggering a Claude call.
  const DATA_PAGES = new Set(["Briefing", "Charts", "Signals", "Outlook", "MorningGlance"]);
  useEffect(() => {
    console.log("[CP] auto-load effect fired | page:", page, "| hasData:", !!aggregatedData);
    if (!DATA_PAGES.has(page) || aggregatedData) return;
    console.log(`[CP] auto-fetching data for /${page.toLowerCase()}`);
    setLoading(true);
    const load = districtConfig.number === "0"
      ? aggregateCitywideData()
      : aggregateDistrictData(districtConfig);
    load
      .then(data => setAggregatedData(data))
      .catch(err => console.warn("[app] auto-load failed:", err))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  async function handleGenerate(district: DistrictConfig) {
    console.time(`[app] generate ${district.label}`);
    setLoading(true);
    setError(null);
    // Navigate immediately — user sees Briefing with loading overlay rather than waiting on Home
    setDistrictConfig(district);
    navigate("Briefing");
    try {
      const { text, data } = await generateBriefing(district);
      setBriefingText(text);
      setAggregatedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      navigate("Home");
    } finally {
      setLoading(false);
      console.timeEnd(`[app] generate ${district.label}`);
    }
  }

  const renderPage = () => {
    switch (page) {
      case "Home":
        return <Home onNavigate={navigate} onGenerate={handleGenerate} loading={loading} error={error} />;
      case "MorningGlance":
        return <MorningGlance aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={navigate} />;
      case "Briefing":
        return <Briefing briefingText={briefingText} aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={navigate} />;
      case "Charts":
        return <Charts aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={navigate} />;
      case "Signals":
        return <Signals aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={navigate} />;
      case "Outlook":
        return <Outlook aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={navigate} />;
      case "Commission":
        return <Commission districtConfig={districtConfig} />;
      case "MapPage":
        return <MapPage districtConfig={districtConfig} onNavigate={navigate} />;
      case "Board":
        return <Board districtConfig={districtConfig} />;
      case "Mayor":
        return <Mayor districtConfig={districtConfig} />;
      case "Parks":
        return <Parks districtConfig={districtConfig} />;
      case "SiteSelection":
        return <SiteSelection districtConfig={districtConfig} onNavigate={navigate} />;
      default:
        return <Home onNavigate={navigate} onGenerate={handleGenerate} loading={loading} error={error} />;
    }
  };

  return (
    <ErrorBoundary label="App">
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      <LoadingOverlay loading={loading} />
      {page !== "Home" && <NavBar activePage={page} onNavigate={navigate} districtConfig={districtConfig} />}
      <ErrorBoundary label={page}>
        <Suspense fallback={<div />}>
          <div key={page} style={{ animation: "cp-page-in 0.15s ease-out" }}>
            {renderPage()}
          </div>
        </Suspense>
      </ErrorBoundary>
      {/* Floating AI assistant — available on every page */}
      <CityPulseChat currentDistrict={districtConfig.number} currentPage={page} />
    </ErrorBoundary>
  );
}
