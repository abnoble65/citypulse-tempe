import { FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";
import type { DistrictData } from "../services/aggregator";

interface NeighborhoodHeroProps {
  selected: string;
  aggregatedData?: DistrictData | null;
}

const NEIGHBORHOOD_THEMES: Record<string, { gradient: string; subtitle: string }> = {
  "North Beach": {
    gradient: "linear-gradient(135deg, #2C4A3E 0%, #4A6A58 55%, #8A6A2A 100%)",
    subtitle: "Telegraph Hill · 94133",
  },
  "Financial District": {
    gradient: "linear-gradient(135deg, #141E38 0%, #243860 55%, #8A5E20 100%)",
    subtitle: "Jackson Square · 94111",
  },
  "Chinatown": {
    gradient: "linear-gradient(135deg, #5A1410 0%, #943820 55%, #B87820 100%)",
    subtitle: "Nob Hill · 94108",
  },
  "Russian Hill": {
    gradient: "linear-gradient(135deg, #263848 0%, #4A6A88 55%, #9A7040 100%)",
    subtitle: "Hyde Street · 94109",
  },
};

export function NeighborhoodHero({ selected, aggregatedData }: NeighborhoodHeroProps) {
  const theme = NEIGHBORHOOD_THEMES[selected];
  const isActive = selected !== "All District 3" && !!theme;
  const neighborhood = NEIGHBORHOODS.find(n => n.name === selected);

  let permitTotal = 0;
  let totalCostM = 0;
  if (aggregatedData && neighborhood?.zip) {
    const zipSummary = aggregatedData.permit_summary.by_zip?.[neighborhood.zip];
    if (zipSummary) {
      permitTotal = zipSummary.total;
      totalCostM = zipSummary.total_estimated_cost_usd / 1_000_000;
    }
  }

  return (
    <div style={{
      maxHeight: isActive ? 72 : 0,
      opacity: isActive ? 1 : 0,
      overflow: "hidden",
      transition: "max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
    }}>
      {theme && neighborhood && (
        <div style={{
          height: 72,
          background: theme.gradient,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <neighborhood.Icon size={22} color="rgba(255,255,255,0.9)" />
            <div>
              <div style={{
                fontFamily: "'Urbanist', sans-serif",
                fontSize: 15, fontWeight: 800, color: "#FFFFFF",
                letterSpacing: "-0.01em", lineHeight: 1.2,
              }}>
                {selected}
              </div>
              <div style={{
                fontFamily: FONTS.body, fontSize: 11,
                color: "rgba(255,255,255,0.6)", marginTop: 1,
              }}>
                {theme.subtitle}
              </div>
            </div>
          </div>
          {permitTotal > 0 && (
            <div style={{ display: "flex", gap: 28 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: "'Urbanist', sans-serif",
                  fontSize: 17, fontWeight: 800, color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                }}>
                  {permitTotal.toLocaleString()}
                </div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1,
                }}>
                  Permits
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: "'Urbanist', sans-serif",
                  fontSize: 17, fontWeight: 800, color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                }}>
                  ${totalCostM.toFixed(1)}M
                </div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1,
                }}>
                  Est. Value
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
