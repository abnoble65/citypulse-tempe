import { useState, lazy, Suspense } from "react";
import { NavBar } from "./components/NavBar";
import { SplashScreen } from "./components/SplashScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { generateBriefing } from "./services/briefing";
import type { DistrictData } from "./services/briefing";
import { DEFAULT_DISTRICT } from "./districts";
import type { DistrictConfig } from "./districts";

// Lazy-load all pages except Home (initial view) — each becomes its own JS chunk
const Briefing   = lazy(() => import("./pages/Briefing").then(m => ({ default: m.Briefing })));
const Charts     = lazy(() => import("./pages/Charts").then(m => ({ default: m.Charts })));
const Signals    = lazy(() => import("./pages/Signals").then(m => ({ default: m.Signals })));
const Outlook    = lazy(() => import("./pages/Outlook").then(m => ({ default: m.Outlook })));
const Commission = lazy(() => import("./pages/Commission").then(m => ({ default: m.Commission })));
const Board      = lazy(() => import("./pages/Board").then(m => ({ default: m.Board })));
const Mayor      = lazy(() => import("./pages/Mayor").then(m => ({ default: m.Mayor })));
const Parks      = lazy(() => import("./pages/Parks").then(m => ({ default: m.Parks })));

const SPLASH_KEY = "citypulse_splash_seen";

export default function App() {
  const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem(SPLASH_KEY) === "1");

  function handleSplashComplete() {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setSplashDone(true);
  }

  const [page, setPage]                       = useState("Home");
  const [briefingText, setBriefingText]       = useState("");
  const [aggregatedData, setAggregatedData]   = useState<DistrictData | null>(null);
  const [districtConfig, setDistrictConfig]   = useState<DistrictConfig>(DEFAULT_DISTRICT);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  async function handleGenerate(district: DistrictConfig) {
    console.time(`[app] generate ${district.label}`);
    setLoading(true);
    setError(null);
    try {
      const { text, data } = await generateBriefing(district);
      setBriefingText(text);
      setAggregatedData(data);
      setDistrictConfig(district);
      setPage("Briefing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
      console.timeEnd(`[app] generate ${district.label}`);
    }
  }

  const renderPage = () => {
    switch (page) {
      case "Home":
        return <Home onNavigate={setPage} onGenerate={handleGenerate} loading={loading} error={error} />;
      case "Briefing":
        return <Briefing briefingText={briefingText} aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={setPage} />;
      case "Charts":
        return <Charts aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={setPage} />;
      case "Signals":
        return <Signals aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={setPage} />;
      case "Outlook":
        return <Outlook aggregatedData={aggregatedData} districtConfig={districtConfig} onNavigate={setPage} />;
      case "Commission":
        return <Commission districtConfig={districtConfig} />;
      case "Board":
        return <Board districtConfig={districtConfig} />;
      case "Mayor":
        return <Mayor districtConfig={districtConfig} />;
      case "Parks":
        return <Parks districtConfig={districtConfig} />;
      default:
        return <Home onNavigate={setPage} onGenerate={handleGenerate} loading={loading} error={error} />;
    }
  };

  return (
    <ErrorBoundary label="App">
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {page !== "Home" && <NavBar activePage={page} onNavigate={setPage} districtConfig={districtConfig} />}
      <ErrorBoundary label={page}>
        <Suspense fallback={<div />}>
          {renderPage()}
        </Suspense>
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
