import { useState } from "react";
import { NavBar } from "./components/NavBar";
import { Home } from "./pages/Home";
import { Briefing } from "./pages/Briefing";
import { Charts } from "./pages/Charts";
import { Signals } from "./pages/Signals";
import { Outlook } from "./pages/Outlook";
import { Commission } from "./pages/Commission";
import { generateBriefing } from "./services/briefing";
import type { DistrictData } from "./services/briefing";

export default function App() {
  const [page, setPage] = useState("Home");
  const [briefingText, setBriefingText] = useState("");
  const [aggregatedData, setAggregatedData] = useState<DistrictData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const { text, data } = await generateBriefing();
      setBriefingText(text);
      setAggregatedData(data);
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
        return <Briefing briefingText={briefingText} aggregatedData={aggregatedData} onNavigate={setPage} />;
      case "Charts":
        return <Charts aggregatedData={aggregatedData} onNavigate={setPage} />;
      case "Signals":
        return <Signals briefingText={briefingText} onNavigate={setPage} />;
      case "Outlook":
        return <Outlook briefingText={briefingText} onNavigate={setPage} />;
      case "Commission":
        return <Commission />;
      default:
        return <Home onNavigate={setPage} onGenerate={handleGenerate} loading={loading} error={error} />;
    }
  };

  return (
    <>
      {page !== "Home" && <NavBar activePage={page} onNavigate={setPage} />}
      {renderPage()}
    </>
  );
}
