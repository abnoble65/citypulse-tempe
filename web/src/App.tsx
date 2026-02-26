import { useState } from "react";
import { NavBar } from "./components/NavBar";
import { SplashScreen } from "./components/SplashScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { Briefing } from "./pages/Briefing";
import { Charts } from "./pages/Charts";
import { Signals } from "./pages/Signals";
import { Outlook } from "./pages/Outlook";
import { Commission } from "./pages/Commission";
import { generateBriefing } from "./services/briefing";
import type { DistrictData } from "./services/briefing";
import { DEFAULT_DISTRICT } from "./districts";
import type { DistrictConfig } from "./districts";

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
      default:
        return <Home onNavigate={setPage} onGenerate={handleGenerate} loading={loading} error={error} />;
    }
  };

  return (
    <ErrorBoundary label="App">
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {page !== "Home" && <NavBar activePage={page} onNavigate={setPage} />}
      <ErrorBoundary label={page}>
        {renderPage()}
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
