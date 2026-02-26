import { COLORS, FONTS } from "../theme";
import { CityPulseLogo } from "./Icons";

interface NavBarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const PAGES = ["Briefing", "Charts", "Signals", "Outlook", "Commission", "Mayor"];

export function NavBar({ activePage, onNavigate }: NavBarProps) {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: COLORS.white,
      borderBottom: `1px solid ${COLORS.lightBorder}`,
      padding: "0 28px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 60,
      fontFamily: FONTS.body,
    }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        onClick={() => onNavigate("Home")}
      >
        <CityPulseLogo size={30} />
        <span style={{
          color: COLORS.charcoal, fontSize: 18, fontWeight: 700,
          letterSpacing: "-0.02em",
          fontFamily: FONTS.heading,
        }}>CityPulse</span>
      </div>
      <div className="nav-pills" style={{ display: "flex", gap: 4, overflowX: "auto" }}>
        {PAGES.map(p => (
          <button key={p} onClick={() => onNavigate(p)}
            style={{
              background: activePage === p ? COLORS.orangePale : "transparent",
              color: activePage === p ? COLORS.orange : COLORS.midGray,
              border: "none", borderRadius: 20,
              padding: "7px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              fontFamily: FONTS.body,
              whiteSpace: "nowrap",
            }}
          >{p}</button>
        ))}
      </div>
    </nav>
  );
}
