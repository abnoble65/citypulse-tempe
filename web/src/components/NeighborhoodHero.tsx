import { FONTS } from "../theme";
import type { DistrictConfig } from "../districts";
import type { DistrictData } from "../services/aggregator";

interface NeighborhoodHeroProps {
  districtConfig: DistrictConfig;
  selected: string;
  aggregatedData?: DistrictData | null;
}

export function NeighborhoodHero({ districtConfig, selected, aggregatedData }: NeighborhoodHeroProps) {
  const neighborhood = districtConfig.neighborhoods.find(n => n.name === selected);
  const isActive = !!neighborhood;

  let permitTotal = 0;
  let totalCostM = 0;
  if (aggregatedData && neighborhood) {
    const zipSummary = aggregatedData.permit_summary.by_zip?.[neighborhood.zip];
    if (zipSummary) {
      permitTotal = zipSummary.total;
      totalCostM = zipSummary.total_estimated_cost_usd / 1_000_000;
    }
  }

  return (
    <div style={{
      maxHeight: isActive ? 200 : 0,
      opacity: isActive ? 1 : 0,
      overflow: "hidden",
      transition: "max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
    }}>
      {neighborhood && (
        <div className="cp-hero-content" style={{
          minHeight: 60,
          background: neighborhood.gradient,
          display: "flex",
          alignItems: "center",
          padding: "12px clamp(16px, 3vw, 32px)",
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
                {neighborhood.subtitle}
              </div>
            </div>
          </div>
          {permitTotal > 0 && (
            <div style={{ display: "flex", gap: "clamp(12px, 3vw, 28px)", flexShrink: 0 }}>
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
