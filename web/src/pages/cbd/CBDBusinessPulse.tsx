/**
 * CBDBusinessPulse.tsx — Commercial health tracking within a CBD.
 *
 * Sections:
 *  1. Summary bar (3 metric cards)
 *  2. Recent activity (new + closures side by side)
 *  3. AI commercial analysis
 */

import { useEffect, useState, useMemo } from "react";

import { useCBD } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { fetchBusinessesForCBD, type CBDBusinessRow } from "../../utils/cbdFetch";
import { CBDLoadingExperience } from "../../components/CBDLoadingExperience";
import { renderMarkdownBlock } from "../../components/MarkdownText";
import Anthropic from "@anthropic-ai/sdk";
import { useLanguage, getLanguageInstruction } from "../../contexts/LanguageContext";

// ── Helpers ─────────────────────────────────────────────────────────────

function cleanAddress(raw: string): string {
  return raw
    .replace(/,?\s*(SAN FRANCISCO|SF)\s*,?\s*(CA\s*)?\d{0,5}\s*$/i, "")
    .replace(/,?\s*CA\s*\d{5}\s*$/i, "")
    .trim();
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Main component ──────────────────────────────────────────────────────

export function CBDBusinessPulse() {
  const { config } = useCBD();
  const { language } = useLanguage();
  const accent = config?.accent_color ?? "#E8652D";

  const [businesses, setBusinesses] = useState<CBDBusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.boundary_geojson) return;
    setLoading(true);
    setFetchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetchBusinessesForCBD(config, { limit: 3000, signal: controller.signal })
      .then(rows => {
        clearTimeout(timeout);
        setBusinesses(rows);
        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeout);
        setFetchError(err?.name === "AbortError"
          ? "Unable to load business data \u2014 timed out."
          : "Unable to load business data. Try refreshing.");
        setLoading(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [config]);

  // ── Derived data ──────────────────────────────────────────────────────

  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff90 = ninetyDaysAgo.toISOString().split("T")[0];

  const activeBusinesses = useMemo(
    () => businesses.filter(b => !b.endDate || b.endDate >= now.toISOString().split("T")[0]),
    [businesses],
  );

  const newRegistrations = useMemo(
    () => businesses.filter(b => b.startDate >= cutoff90).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [businesses, cutoff90],
  );

  const closures = useMemo(
    () => businesses
      .filter(b => b.endDate && b.endDate >= cutoff90)
      .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "")),
    [businesses, cutoff90],
  );

  // Regenerate AI on language change
  useEffect(() => { setAiAnalysis(""); }, [language]);

  // ── AI analysis ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !config || businesses.length === 0 || aiAnalysis) return;
    const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setAiAnalysis("*AI analysis unavailable.*"); return; }

    setAiLoading(true);

    // Top streets by registration count
    const streetCounts: Record<string, number> = {};
    for (const b of newRegistrations) {
      const parts = b.address.split(" ");
      const street = parts.slice(1).join(" ") || b.address;
      if (street) streetCounts[street] = (streetCounts[street] ?? 0) + 1;
    }
    const topStreets = Object.entries(streetCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([st, n]) => `${st}: ${n}`).join(", ");

    // Zip distribution
    const zipCounts: Record<string, number> = {};
    for (const b of activeBusinesses) {
      if (b.zip) zipCounts[b.zip] = (zipCounts[b.zip] ?? 0) + 1;
    }
    const topZips = Object.entries(zipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([z, n]) => `${z}: ${n}`).join(", ");

    const prompt = `You are a commercial analyst for the ${config.name} Community Benefit District in San Francisco. Analyze the business registration data. Write 2-3 paragraphs highlighting trends, activity clusters, and areas of concern.

DATA:
- Active businesses: ${activeBusinesses.length}
- New registrations (last 90 days): ${newRegistrations.length}
- Closures (last 90 days): ${closures.length}
- Top streets for new registrations: ${topStreets || "N/A"}
- Zip code distribution: ${topZips || "N/A"}
- Sample new businesses: ${newRegistrations.slice(0, 5).map(b => `${b.dba || b.name} at ${b.address}`).join("; ")}

Focus on what the registration patterns mean for district health. Note any clusters of activity or areas with low registration.${getLanguageInstruction(language)}`;

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }).then(res => {
      setAiAnalysis(res.content[0]?.type === "text" ? res.content[0].text : "");
    }).catch(() => {
      setAiAnalysis("*Unable to generate analysis.*");
    }).finally(() => setAiLoading(false));
  }, [loading, config, businesses, aiAnalysis, activeBusinesses, newRegistrations, closures, language]);

  if (!config) return null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 48px" }}>
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700, color: COLORS.charcoal, margin: 0 }}>
          Business Pulse
        </h1>
        <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6 }}>
          Commercial activity within {config.name}
        </p>
      </div>

      <CBDLoadingExperience config={config} loading={loading} itemCount={businesses.length} variant="dashboard" />

      {fetchError && !loading && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12,
          padding: "20px 24px", marginBottom: 24, fontFamily: FONTS.body,
          fontSize: 14, color: "#991B1B", textAlign: "center",
        }}>
          {fetchError}
        </div>
      )}

      {!loading && !fetchError && (
        <div style={{ animation: "cp-page-in 0.3s ease-out" }}>

          {/* Summary bar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
            {[
              { label: "Active Businesses", value: String(activeBusinesses.length), color: "#8B5CF6" },
              { label: "New (90 days)", value: String(newRegistrations.length), color: "#10B981" },
              { label: "Closures (90 days)", value: String(closures.length), color: "#EF4444" },
            ].map(s => (
              <div key={s.label} style={{
                flex: "1 1 160px", minWidth: 140,
                background: COLORS.white, borderRadius: 12,
                border: "1px solid #e5e7eb", borderLeft: `4px solid ${s.color}`,
                padding: "14px 16px", textAlign: "center",
              }}>
                <div style={{
                  fontFamily: FONTS.display, fontSize: 28, fontWeight: 700,
                  color: s.color, lineHeight: 1.1,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 500,
                  color: COLORS.warmGray, marginTop: 4,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity — two columns */}
          <style>{`
            @media (max-width: 768px) {
              .cbd-biz-cols { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div className="cbd-biz-cols" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 24, marginBottom: 40,
          }}>
            {/* New Businesses */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: "1px solid #e5e7eb", borderLeft: "4px solid #10B981",
              padding: "20px 24px", display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: "#1a1a2e", margin: "0 0 16px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
                New Businesses
              </h2>
              <div style={{ flex: 1, maxHeight: 420, overflowY: "auto" }}>
                {newRegistrations.length > 0 ? newRegistrations.slice(0, 30).map((b, i) => (
                  <div key={i} style={{
                    padding: "10px 0",
                    borderBottom: `1px solid ${COLORS.lightBorder}`,
                  }}>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: "#1a1a2e",
                    }}>
                      {b.dba || toTitleCase(b.name)}
                    </div>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 2,
                    }}>
                      {toTitleCase(cleanAddress(b.address))}
                    </div>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 11, color: COLORS.midGray, marginTop: 2,
                    }}>
                      Started {b.startDate}
                    </div>
                  </div>
                )) : (
                  <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                    No new registrations in the last 90 days.
                  </p>
                )}
              </div>
            </div>

            {/* Closures */}
            <div style={{
              background: COLORS.white, borderRadius: 12,
              border: "1px solid #e5e7eb", borderLeft: "4px solid #EF4444",
              padding: "20px 24px", display: "flex", flexDirection: "column",
            }}>
              <h2 style={{
                fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
                color: "#1a1a2e", margin: "0 0 16px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                Closures
              </h2>
              <div style={{ flex: 1, maxHeight: 420, overflowY: "auto" }}>
                {closures.length > 0 ? closures.slice(0, 30).map((b, i) => (
                  <div key={i} style={{
                    padding: "10px 0",
                    borderBottom: `1px solid ${COLORS.lightBorder}`,
                  }}>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: "#1a1a2e",
                    }}>
                      {b.dba || toTitleCase(b.name)}
                    </div>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: 2,
                    }}>
                      {toTitleCase(cleanAddress(b.address))}
                    </div>
                    <div style={{
                      fontFamily: FONTS.body, fontSize: 11, color: "#EF4444", marginTop: 2,
                    }}>
                      Closed {b.endDate}
                    </div>
                  </div>
                )) : (
                  <div style={{
                    background: COLORS.cream, borderRadius: 10, padding: "24px 18px",
                    textAlign: "center",
                  }}>
                    <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, margin: 0 }}>
                      Closure tracking data is sparse for this area.
                    </p>
                    <p style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, margin: "8px 0 0" }}>
                      End dates may not be reliably reported in the business registry.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Commercial Analysis */}
          <div style={{
            background: COLORS.white, borderRadius: 12,
            border: "1px solid #e5e7eb", borderTop: `3px solid ${accent}`,
            padding: "20px 24px", marginBottom: 40,
          }}>
            <h2 style={{
              fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600,
              color: "#1a1a2e", margin: "0 0 16px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              AI Commercial Analysis
            </h2>
            {aiLoading ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="sk" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  Analyzing business patterns...
                </div>
                <div className="sk" style={{ height: 14, width: "100%", marginTop: 12, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "85%", marginTop: 8, borderRadius: 4 }} />
                <div className="sk" style={{ height: 14, width: "70%", marginTop: 8, borderRadius: 4 }} />
              </div>
            ) : aiAnalysis ? (
              <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 1.7 }}>
                {renderMarkdownBlock(aiAnalysis)}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
