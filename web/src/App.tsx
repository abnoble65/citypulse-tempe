import { useState } from "react";
import { NavBar } from "./components/NavBar";
import { Home } from "./pages/Home";
import { Briefing } from "./pages/Briefing";
import { Charts } from "./pages/Charts";
import { Signals } from "./pages/Signals";
import { Outlook } from "./pages/Outlook";
import { Commission } from "./pages/Commission";

export default function App() {
  const [page, setPage] = useState("Home");

  const renderPage = () => {
    switch (page) {
      case "Home": return <Home onNavigate={setPage} />;
      case "Briefing": return <Briefing />;
      case "Charts": return <Charts />;
      case "Signals": return <Signals />;
      case "Outlook": return <Outlook onNavigate={setPage} />;
      case "Commission": return <Commission />;
      default: return <Home onNavigate={setPage} />;
    }
  };

  return (
    <>
      {page !== "Home" && <NavBar activePage={page} onNavigate={setPage} />}
      {renderPage()}
    </>
  );
}
