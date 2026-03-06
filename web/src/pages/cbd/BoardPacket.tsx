/**
 * BoardPacket.tsx — One-click PDF board report for CBD meetings.
 *
 * Preview cards show what the packet contains, then "Generate Board Packet"
 * fetches live data, generates an AI executive summary, builds a 5-page
 * PDF with jsPDF, and auto-downloads it.
 */

import { useState, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useCBD, type CBDConfig } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { isPointInCBD, type CBDBoundaryEntry } from "../../utils/geoFilter";
import Anthropic from "@anthropic-ai/sdk";

const DATASF = "https://data.sfgov.org/resource";

// ── Helpers ────────────────────────────────────────────────────────────────

function hexToRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function buildBoundaryEntry(config: CBDConfig): CBDBoundaryEntry | null {
  if (!config.boundary_geojson) return null;
  return { name: config.name, geometry: config.boundary_geojson };
}

function normalize311Cat(serviceName: string): string {
  const s = (serviceName ?? "").toLowerCase();
  if (s.includes("graffiti")) return "Graffiti";
  if ((s.includes("street") || s.includes("sidewalk")) && s.includes("clean")) return "Street Cleaning";
  if (s.includes("encampment")) return "Encampments";
  if (s.includes("sidewalk") || s.includes("block")) return "Blocked Sidewalk";
  return "Other";
}

// ── Preview card ───────────────────────────────────────────────────────────

function PreviewCard({ icon, title, description, accent }: {
  icon: string; title: string; description: string; accent: string;
}) {
  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "flex-start",
      background: COLORS.white, borderRadius: 12,
      border: `1px solid ${COLORS.lightBorder}`, padding: "16px 18px",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: accent + "15", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: FONTS.body, fontSize: 14, fontWeight: 700, color: COLORS.charcoal,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
          marginTop: 2, lineHeight: 1.5,
        }}>
          {description}
        </div>
      </div>
    </div>
  );
}

// ── PDF builder ────────────────────────────────────────────────────────────

interface PacketData {
  config: CBDConfig;
  permits: { type: string; cost: number; address: string; status: string }[];
  rows311: { category: string; address: string; date: string }[];
  evictions: { address: string; date: string }[];
  aiSummary: string;
}

function buildPDF(d: PacketData) {
  const { config, permits, rows311, evictions, aiSummary } = d;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 20;
  const accent = hexToRGB(config.accent_color);
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const TOTAL_PAGES = 5;

  // — Reusable elements ——————————————————————————————————————

  function footer(pageNum: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    const y = H - 12;
    doc.text(`Powered by CityPulse${config.website_url ? ` | ${config.website_url}` : ""}`, M, y);
    doc.text(`Page ${pageNum} of ${TOTAL_PAGES}`, W - M, y, { align: "right" });
    doc.text(`Generated ${dateStr}`, W / 2, y, { align: "center" });
  }

  function pageHeader(title: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text(config.name, M, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(title, W - M, 16, { align: "right" });
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.5);
    doc.line(M, 20, W - M, 20);
  }

  // — Category / permit summaries ————————————————————————————

  const catCounts: Record<string, number> = {};
  for (const r of rows311) {
    const c = normalize311Cat(r.category);
    catCounts[c] = (catCounts[c] ?? 0) + 1;
  }
  const catEntries = Object.entries(catCounts).sort(([, a], [, b]) => b - a);

  const addrCounts: Record<string, number> = {};
  for (const r of rows311) {
    const a = r.address.toUpperCase().trim();
    if (a) addrCounts[a] = (addrCounts[a] ?? 0) + 1;
  }
  const topAddresses = Object.entries(addrCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  const permitTypes: Record<string, number> = {};
  for (const p of permits) permitTypes[p.type || "Other"] = (permitTypes[p.type || "Other"] ?? 0) + 1;
  const topByValue = [...permits].sort((a, b) => b.cost - a.cost).slice(0, 3);

  // ─── PAGE 1: COVER ───────────────────────────────────────────────────

  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(...accent);
  doc.text(config.name, W / 2, 80, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  doc.setTextColor(80, 80, 80);
  doc.text(`Board Report \u2014 ${monthYear}`, W / 2, 95, { align: "center" });

  if (config.description) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(config.description, W - M * 2 - 20);
    doc.text(lines, W / 2, 115, { align: "center" });
  }

  if (config.executive_director) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text(`Executive Director: ${config.executive_director}`, W / 2, 145, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Data period: last 90 days | Generated ${dateStr}`, W / 2, 160, { align: "center" });

  doc.setFillColor(...accent);
  doc.rect(0, H - 18, W, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Powered by CityPulse", W / 2, H - 8, { align: "center" });

  // ─── PAGE 2: KEY METRICS ─────────────────────────────────────────────

  doc.addPage();
  pageHeader("Key Metrics");

  const metrics = [
    { label: "Active Permits", value: String(permits.length), color: [59, 130, 246] as [number, number, number] },
    { label: "311 Requests (90d)", value: String(rows311.length), color: [139, 92, 246] as [number, number, number] },
    { label: "Eviction Notices", value: String(evictions.length), color: [239, 68, 68] as [number, number, number] },
    { label: "Businesses", value: "\u2014", color: [16, 185, 129] as [number, number, number] },
  ];

  const boxW = (W - M * 2 - 10) / 2;
  const boxH = 38;
  metrics.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (boxW + 10);
    const y = 32 + row * (boxH + 10);

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(x, y, boxW, boxH, "S");

    doc.setFillColor(...m.color);
    doc.rect(x, y + 4, 1.5, boxH - 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...m.color);
    doc.text(m.value, x + boxW / 2, y + 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(m.label, x + boxW / 2, y + 30, { align: "center" });
  });

  let yPos = 32 + 2 * (boxH + 10) + 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Data period: last 90 days ending ${dateStr}`, M, yPos);
  footer(2);

  // ─── PAGE 3: 311 CLEAN & SAFE SUMMARY ────────────────────────────────

  doc.addPage();
  pageHeader("311 Clean & Safe Summary");

  yPos = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text("Category Breakdown", M, yPos);
  yPos += 8;

  doc.setFillColor(245, 245, 245);
  doc.rect(M, yPos, W - M * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("CATEGORY", M + 4, yPos + 5.5);
  doc.text("COUNT", M + 100, yPos + 5.5);
  doc.text("% OF TOTAL", M + 130, yPos + 5.5);
  yPos += 10;

  for (const [cat, count] of catEntries) {
    const pct = rows311.length > 0 ? ((count / rows311.length) * 100).toFixed(1) : "0";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(cat, M + 4, yPos + 4);
    doc.text(String(count), M + 100, yPos + 4);
    doc.text(`${pct}%`, M + 130, yPos + 4);
    doc.setDrawColor(230, 230, 230);
    doc.line(M, yPos + 6, W - M, yPos + 6);
    yPos += 8;
  }

  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text("Top 5 Hotspot Addresses", M, yPos);
  yPos += 8;

  for (let i = 0; i < topAddresses.length; i++) {
    const [addr, count] = topAddresses[i];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`${i + 1}. ${addr} \u2014 ${count} requests`, M + 4, yPos + 4);
    yPos += 7;
  }

  if (aiSummary) {
    yPos += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text("AI Analysis", M, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const firstPara = aiSummary.split("\n\n")[0] ?? aiSummary;
    const paraLines = doc.splitTextToSize(firstPara, W - M * 2);
    doc.text(paraLines, M, yPos);
  }

  footer(3);

  // ─── PAGE 4: PERMIT ACTIVITY ─────────────────────────────────────────

  doc.addPage();
  pageHeader("Permit Activity");

  yPos = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text("Permits by Type", M, yPos);
  yPos += 8;

  for (const [type, count] of Object.entries(permitTypes).sort(([, a], [, b]) => b - a)) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`\u2022  ${type}: ${count}`, M + 4, yPos + 4);
    yPos += 7;
  }

  if (topByValue.length > 0) {
    yPos += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text("Notable Projects (by estimated cost)", M, yPos);
    yPos += 8;

    for (const p of topByValue) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const line = `${p.address}  \u2014  ${p.type}, $${(p.cost / 1000).toFixed(0)}K est., ${p.status ?? "Unknown"}`;
      doc.text(line, M + 4, yPos + 4);
      yPos += 7;
    }
  }

  const newConst = permits.filter(p => (p.type ?? "").toLowerCase().includes("new construction"));
  if (newConst.length > 0) {
    yPos += 10;
    doc.setFillColor(254, 243, 205);
    doc.rect(M, yPos, W - M * 2, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(133, 100, 4);
    doc.text(
      `${newConst.length} new construction permit(s) may impact district cleaning and safety operations.`,
      M + 4, yPos + 9,
    );
  }

  footer(4);

  // ─── PAGE 5: AI EXECUTIVE SUMMARY ────────────────────────────────────

  doc.addPage();
  pageHeader("Executive Summary");

  yPos = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...accent);
  doc.text("Executive Summary", M, yPos);
  yPos += 10;

  if (aiSummary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(aiSummary, W - M * 2);
    doc.text(lines, M, yPos);
  }

  footer(5);

  // — Save ————————————————————————————————————————————————

  const filename = `${config.short_name.replace(/\s+/g, "-")}_Board-Packet_${monthYear.replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}

// ── Main component ─────────────────────────────────────────────────────────

type Stage = "idle" | "fetching" | "ai" | "building" | "done" | "error";

const STAGE_LABELS: Record<Stage, string> = {
  idle:     "",
  fetching: "Fetching DataSF data...",
  ai:       "Generating AI executive summary...",
  building: "Building PDF...",
  done:     "Download complete!",
  error:    "Generation failed",
};

export function BoardPacket() {
  const { config } = useCBD();
  const accent = config?.accent_color ?? "#E8652D";
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");

  const boundaryEntry = useMemo(() => config ? buildBoundaryEntry(config) : null, [config]);
  const cbdBoundaries = useMemo(() => boundaryEntry ? [boundaryEntry] : [], [boundaryEntry]);

  const generate = useCallback(async () => {
    if (!config || !cbdBoundaries.length) return;
    setStage("fetching");
    setError("");

    try {
      const district = config.supervisor_district ? String(config.supervisor_district) : null;
      const cutoff90 = new Date();
      cutoff90.setDate(cutoff90.getDate() - 90);
      const cutoffStr = cutoff90.toISOString().split("T")[0];

      const w311 = district
        ? `supervisor_district='${district}' AND requested_datetime>='${cutoffStr}T00:00:00.000' AND lat IS NOT NULL`
        : `requested_datetime>='${cutoffStr}T00:00:00.000' AND lat IS NOT NULL`;
      const wPermit = district
        ? `supervisor_district='${district}' AND location IS NOT NULL`
        : `location IS NOT NULL`;
      const wEvict = district
        ? `supervisor_district='${district}' AND file_date>'2023-01-01'`
        : `file_date>'2023-01-01'`;

      const [raw311, rawPermit, rawEvict] = await Promise.all([
        fetch(`${DATASF}/vw6y-z8j6.json?${new URLSearchParams({
          $where: w311,
          $select: "lat,long,service_name,address,requested_datetime,status_description",
          $limit: "5000",
        })}`).then(r => r.json()).catch(() => []),

        fetch(`${DATASF}/i98e-djp9.json?${new URLSearchParams({
          $where: wPermit,
          $select: "location,permit_type_definition,estimated_cost,street_number,street_name,street_suffix,status",
          $limit: "2000",
        })}`).then(r => r.json()).catch(() => []),

        fetch(`${DATASF}/5cei-gny5.json?${new URLSearchParams({
          $where: wEvict,
          $select: "shape,address,file_date",
          $limit: "500",
        })}`).then(r => r.json()).catch(() => []),
      ]);

      const rows311 = (raw311 as any[])
        .filter((r: any) => r.lat && r.long)
        .map((r: any) => ({
          category: r.service_name ?? "",
          address: r.address ?? "",
          date: (r.requested_datetime ?? "").split("T")[0],
          lat: parseFloat(r.lat),
          lng: parseFloat(r.long),
        }))
        .filter(p => !isNaN(p.lat) && isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

      const permits = (rawPermit as any[])
        .filter((r: any) => r.location?.coordinates)
        .map((r: any) => ({
          type: r.permit_type_definition ?? "",
          cost: parseFloat(r.estimated_cost) || 0,
          address: [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" "),
          status: r.status ?? "",
          lat: r.location.coordinates[1],
          lng: r.location.coordinates[0],
        }))
        .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

      const evictions = (rawEvict as any[])
        .filter((r: any) => r.shape?.coordinates)
        .map((r: any) => ({
          address: r.address ?? "",
          date: (r.file_date ?? "").split("T")[0],
          lat: r.shape.coordinates[1],
          lng: r.shape.coordinates[0],
        }))
        .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

      console.log(`[BoardPacket] ${config.name}: ${permits.length} permits, ${rows311.length} 311, ${evictions.length} evictions`);

      // ── AI executive summary ─────────────────────────────────

      setStage("ai");
      let aiSummary = "";
      const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;

      if (apiKey) {
        const catCounts: Record<string, number> = {};
        for (const r of rows311) {
          const c = normalize311Cat(r.category);
          catCounts[c] = (catCounts[c] ?? 0) + 1;
        }
        const catList = Object.entries(catCounts).sort(([, a], [, b]) => b - a)
          .map(([c, n]) => `${c}: ${n}`).join(", ");

        const addrCounts: Record<string, number> = {};
        for (const r of rows311) {
          const a = r.address.toUpperCase().trim();
          if (a) addrCounts[a] = (addrCounts[a] ?? 0) + 1;
        }
        const topAddrs = Object.entries(addrCounts).sort(([, a], [, b]) => b - a)
          .slice(0, 5).map(([a, n]) => `${a}: ${n} requests`).join(", ");

        const permitTypes: Record<string, number> = {};
        for (const p of permits) permitTypes[p.type || "Other"] = (permitTypes[p.type || "Other"] ?? 0) + 1;
        const topByVal = [...permits].sort((a, b) => b.cost - a.cost).slice(0, 3);

        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        const res = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are writing an executive summary for the ${config.name} Community Benefit District board packet. Write exactly 3 paragraphs:

Paragraph 1: Overview of district activity covering permits, 311 requests, and evictions.
Paragraph 2: Key trends and areas of concern.
Paragraph 3: Recommended actions for the board.

DATA (last 90 days within ${config.name} boundary):
- ${permits.length} active building permits (${Object.entries(permitTypes).slice(0, 3).map(([t, n]) => `${t}: ${n}`).join(", ")})
- ${rows311.length} 311 service requests (${catList})
- Top hotspots: ${topAddrs}
- ${evictions.length} eviction notices
${topByVal.length > 0 ? `- Highest-value permits: ${topByVal.map(p => `${p.address} ($${(p.cost / 1000).toFixed(0)}K)`).join(", ")}` : ""}

Be concise, data-driven, and professional. Include specific numbers and addresses.`,
          }],
        });
        aiSummary = res.content[0]?.type === "text" ? res.content[0].text : "";
      } else {
        aiSummary = "AI summary unavailable \u2014 API key not configured.";
      }

      // ── Build PDF ────────────────────────────────────────────

      setStage("building");
      buildPDF({ config, permits, rows311, evictions, aiSummary });
      setStage("done");
    } catch (err) {
      console.error("[BoardPacket] Error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStage("error");
    }
  }, [config, cbdBoundaries]);

  if (!config) return null;

  const isGenerating = stage === "fetching" || stage === "ai" || stage === "building";

  const previews = [
    { icon: "\uD83D\uDCCB", title: "Page 1: Cover", description: "CBD name, report date, executive director, description" },
    { icon: "\uD83D\uDCCA", title: "Page 2: Key Metrics", description: "Permits, 311 requests, evictions, businesses at a glance" },
    { icon: "\uD83E\uDDF9", title: "Page 3: Clean & Safe Summary", description: "311 category breakdown, top 5 hotspots, AI analysis" },
    { icon: "\uD83C\uDFD7\uFE0F", title: "Page 4: Permit Activity", description: "Permit types, notable projects, construction impact flags" },
    { icon: "\uD83E\uDD16", title: "Page 5: Executive Summary", description: "AI-generated briefing with data-driven recommendations" },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{
          fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700,
          color: COLORS.charcoal, margin: 0,
        }}>
          Board Packet
        </h1>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6,
        }}>
          Generate a professional PDF report for {config.name} board meetings.
        </p>
      </div>

      {/* ── Preview cards ───────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {previews.map(p => (
          <PreviewCard key={p.title} {...p} accent={accent} />
        ))}
      </div>

      {/* ── Generate button ─────────────────────────────────────── */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={generate}
          disabled={isGenerating}
          style={{
            background: isGenerating ? COLORS.warmGray : accent,
            color: "#fff",
            border: "none", borderRadius: 28,
            padding: "14px 40px",
            cursor: isGenerating ? "default" : "pointer",
            fontFamily: FONTS.body, fontSize: 16, fontWeight: 700,
            boxShadow: isGenerating ? "none" : `0 4px 16px ${accent}44`,
            transition: "all 0.2s",
            display: "inline-flex", alignItems: "center", gap: 10,
          }}
        >
          {isGenerating && (
            <>
              <style>{`@keyframes bp-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                animation: "bp-spin 0.8s linear infinite",
              }} />
            </>
          )}
          {isGenerating
            ? "Generating..."
            : stage === "done" ? "Regenerate Packet" : "Generate Board Packet"}
        </button>

        {(isGenerating || stage === "done") && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: stage === "done" ? COLORS.green : COLORS.warmGray,
            marginTop: 12,
          }}>
            {STAGE_LABELS[stage]}
          </p>
        )}

        {stage === "error" && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: "#DC2626", marginTop: 12,
          }}>
            {error || "An error occurred. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}
