/**
 * BoardPacket.tsx — One-click PDF board report for CBD meetings.
 *
 * 6-page PDF: Cover, Key Metrics, 311 Clean & Safe, Permit Activity,
 * Business Pulse, Executive Summary. Professional branding with accent
 * color headers, page numbers, and structured AI analysis.
 */

import { useState, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useCBD, type CBDConfig } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { isPointInCBD, type CBDBoundaryEntry } from "../../utils/geoFilter";
import { fetchBusinessesForCBD, type CBDBusinessRow } from "../../utils/cbdFetch";
import Anthropic from "@anthropic-ai/sdk";
import { useLanguage, getLanguageInstruction } from "../../contexts/LanguageContext";

const DATASF = "https://data.sfgov.org/resource";

// ── Helpers ────────────────────────────────────────────────────────────

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

// ── PDF builder ────────────────────────────────────────────────────────

interface PacketData {
  config: CBDConfig;
  permits: { type: string; cost: number; address: string; status: string }[];
  rows311: { category: string; address: string; date: string; closedDate: string | null }[];
  evictions: { address: string; date: string }[];
  businesses: CBDBusinessRow[];
  aiSummary: string;
}

function buildPDF(d: PacketData) {
  const { config, permits, rows311, evictions, businesses, aiSummary } = d;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 20;
  const accent = hexToRGB(config.accent_color);
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const TOTAL_PAGES = 6;

  // Reporting period
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const periodStart = cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // — Reusable elements ——————————————————————————————————————

  function footer(pageNum: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    const y = H - 12;
    doc.text(`Powered by CityPulse \u00B7 Generated ${dateStr}`, M, y);
    doc.text(`Page ${pageNum} of ${TOTAL_PAGES}`, W / 2, y, { align: "center" });
    if (config.website_url) {
      doc.text(config.website_url, W - M, y, { align: "right" });
    }
  }

  function pageHeader(title: string) {
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.8);
    doc.line(M, 14, W - M, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...accent);
    doc.text(config.name, M, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(title, W - M, 12, { align: "right" });
  }

  function sectionTitle(title: string, y: number): number {
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(50, 50, 50);
    doc.text(title, M, y);
    return y + 8;
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

  // Resolution metrics
  const closedRows = rows311.filter(r => r.closedDate);
  const resRate = rows311.length > 0 ? ((closedRows.length / rows311.length) * 100).toFixed(1) : "0";
  const resDaysList: number[] = [];
  for (const r of closedRows) {
    const dd = (new Date(r.closedDate!).getTime() - new Date(r.date).getTime()) / 86_400_000;
    if (dd > 0) resDaysList.push(dd);
  }
  const avgResDays = resDaysList.length > 0
    ? (resDaysList.reduce((s, dd) => s + dd, 0) / resDaysList.length).toFixed(1)
    : "N/A";
  const catResDays: Record<string, number[]> = {};
  for (const r of closedRows) {
    const cat = normalize311Cat(r.category);
    const dd = (new Date(r.closedDate!).getTime() - new Date(r.date).getTime()) / 86_400_000;
    if (dd > 0) {
      if (!catResDays[cat]) catResDays[cat] = [];
      catResDays[cat].push(dd);
    }
  }

  // Business metrics
  const cutoff90Str = cutoff.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];
  const activeBiz = businesses.filter(b => !b.endDate || b.endDate >= nowStr);
  const newBiz = businesses.filter(b => b.startDate >= cutoff90Str);
  const closedBiz = businesses.filter(b => b.endDate && b.endDate >= cutoff90Str);

  // ─── PAGE 1: COVER ───────────────────────────────────────────────────

  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 6, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(36);
  doc.setTextColor(...accent);
  doc.text(config.name, W / 2, 80, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  doc.setTextColor(80, 80, 80);
  doc.text(`Board Report \u2014 ${monthYear}`, W / 2, 95, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(120, 120, 120);
  doc.text(`Reporting Period: ${periodStart} \u2013 ${dateStr}`, W / 2, 108, { align: "center" });

  if (config.description) {
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(config.description, W - M * 2 - 20);
    doc.text(lines, W / 2, 125, { align: "center" });
  }

  if (config.executive_director) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text(`Executive Director: ${config.executive_director}`, W / 2, 150, { align: "center" });
  }

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
    { label: "Active Businesses", value: String(activeBiz.length), color: [16, 185, 129] as [number, number, number] },
    { label: "Resolution Rate", value: `${resRate}%`, color: [59, 130, 246] as [number, number, number] },
    { label: "Avg Resolution", value: `${avgResDays}d`, color: [245, 158, 11] as [number, number, number] },
  ];

  const boxW = (W - M * 2 - 10) / 2;
  const boxH = 36;
  metrics.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (boxW + 10);
    const y = 28 + row * (boxH + 8);

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(x, y, boxW, boxH, "S");

    doc.setFillColor(...m.color);
    doc.rect(x, y + 4, 1.5, boxH - 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...m.color);
    doc.text(m.value, x + boxW / 2, y + 18, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(m.label, x + boxW / 2, y + 28, { align: "center" });
  });

  let yPos = 28 + 3 * (boxH + 8) + 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Data period: ${periodStart} \u2013 ${dateStr}`, M, yPos);
  footer(2);

  // ─── PAGE 3: 311 CLEAN & SAFE SUMMARY ────────────────────────────────

  doc.addPage();
  pageHeader("311 Clean & Safe Summary");

  yPos = sectionTitle("Category Breakdown", 26);

  // Resolution rate highlight
  doc.setFillColor(240, 253, 244);
  doc.rect(M, yPos, W - M * 2, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74);
  doc.text(`Resolution Rate: ${resRate}%`, M + 6, yPos + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`${closedRows.length} of ${rows311.length} requests resolved  |  Avg ${avgResDays} days`, M + 6, yPos + 12);
  yPos += 18;

  doc.setFillColor(245, 245, 245);
  doc.rect(M, yPos, W - M * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("CATEGORY", M + 4, yPos + 5);
  doc.text("COUNT", M + 90, yPos + 5);
  doc.text("% TOTAL", M + 115, yPos + 5);
  doc.text("AVG DAYS", M + 140, yPos + 5);
  yPos += 9;

  for (const [cat, count] of catEntries) {
    const pct = rows311.length > 0 ? ((count / rows311.length) * 100).toFixed(1) : "0";
    const days = catResDays[cat];
    const avgD = days ? (days.reduce((s, d) => s + d, 0) / days.length).toFixed(1) : "\u2014";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(cat, M + 4, yPos + 4);
    doc.text(String(count), M + 90, yPos + 4);
    doc.text(`${pct}%`, M + 115, yPos + 4);
    if (days) {
      const avg = days.reduce((s, d) => s + d, 0) / days.length;
      if (avg < 3) doc.setTextColor(16, 185, 129);
      else if (avg <= 7) doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);
    }
    doc.text(String(avgD), M + 140, yPos + 4);
    doc.setDrawColor(230, 230, 230);
    doc.line(M, yPos + 6, W - M, yPos + 6);
    yPos += 8;
  }

  yPos = sectionTitle("Top 5 Hotspot Addresses", yPos + 10);
  for (let i = 0; i < topAddresses.length; i++) {
    const [addr, count] = topAddresses[i];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`${i + 1}. ${addr} \u2014 ${count} requests`, M + 4, yPos + 4);
    yPos += 7;
  }

  footer(3);

  // ─── PAGE 4: PERMIT ACTIVITY ─────────────────────────────────────────

  doc.addPage();
  pageHeader("Permit Activity");

  yPos = sectionTitle("Permits by Type", 26);

  for (const [type, count] of Object.entries(permitTypes).sort(([, a], [, b]) => b - a)) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`\u2022  ${type}: ${count}`, M + 4, yPos + 4);
    yPos += 7;
  }

  if (topByValue.length > 0) {
    yPos = sectionTitle("Notable Projects (by estimated cost)", yPos + 10);
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
    yPos += 8;
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

  // ─── PAGE 5: BUSINESS PULSE ──────────────────────────────────────────

  doc.addPage();
  pageHeader("Business Pulse");

  yPos = 26;

  // Business metrics boxes
  const bizMetrics = [
    { label: "Active Businesses", value: String(activeBiz.length), color: [139, 92, 246] as [number, number, number] },
    { label: "New (90 days)", value: String(newBiz.length), color: [16, 185, 129] as [number, number, number] },
    { label: "Closures (90 days)", value: String(closedBiz.length), color: [239, 68, 68] as [number, number, number] },
  ];

  const bBoxW = (W - M * 2 - 16) / 3;
  bizMetrics.forEach((m, i) => {
    const x = M + i * (bBoxW + 8);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(x, yPos, bBoxW, 28, "S");
    doc.setFillColor(...m.color);
    doc.rect(x, yPos + 4, 1.5, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...m.color);
    doc.text(m.value, x + bBoxW / 2, yPos + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(m.label, x + bBoxW / 2, yPos + 22, { align: "center" });
  });

  yPos += 38;

  if (newBiz.length > 0) {
    yPos = sectionTitle("Recent Registrations", yPos);
    const showBiz = newBiz.slice(0, 10);
    for (const b of showBiz) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(b.dba || b.name, M + 4, yPos + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`${b.address} \u2022 Started ${b.startDate}`, M + 4, yPos + 10);
      yPos += 13;
    }
  }

  if (closedBiz.length > 0) {
    yPos = sectionTitle("Recent Closures", yPos + 6);
    const showClosed = closedBiz.slice(0, 5);
    for (const b of showClosed) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`${b.dba || b.name} \u2014 ${b.address} (closed ${b.endDate})`, M + 4, yPos + 4);
      yPos += 7;
    }
  }

  footer(5);

  // ─── PAGE 6: EXECUTIVE SUMMARY ────────────────────────────────────────

  doc.addPage();
  pageHeader("Executive Summary");

  yPos = 26;
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...accent);
  doc.text("Executive Summary", M, yPos);
  yPos += 10;

  if (aiSummary) {
    // Split AI summary into sections if it has headers
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const paragraphs = aiSummary.split("\n\n");
    for (const para of paragraphs) {
      if (para.startsWith("**") || para.startsWith("###") || para.startsWith("##")) {
        // Header line
        const cleaned = para.replace(/^[#*]+\s*/, "").replace(/\*+$/, "");
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...accent);
        doc.text(cleaned, M, yPos);
        yPos += 7;
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
      } else {
        const lines = doc.splitTextToSize(para.replace(/\*\*/g, ""), W - M * 2);
        if (yPos + lines.length * 4.5 > H - 20) {
          // Would overflow — truncate
          break;
        }
        doc.text(lines, M, yPos);
        yPos += lines.length * 4.5 + 4;
      }
    }
  }

  footer(6);

  // — Save ————————————————————————————————————————————————

  const filename = `${config.short_name.replace(/\s+/g, "-")}_Board-Packet_${monthYear.replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}

// ── Generation stages ────────────────────────────────────────────────────

type Stage = "idle" | "fetching" | "ai" | "building" | "done" | "error";

const STAGE_STEPS = [
  { key: "fetching" as Stage, label: "Fetching DataSF data" },
  { key: "ai" as Stage,       label: "Generating AI analysis" },
  { key: "building" as Stage, label: "Building PDF" },
];

// ── Main component ─────────────────────────────────────────────────────────

export function BoardPacket() {
  const { config } = useCBD();
  const { language } = useLanguage();
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

      const [raw311, rawPermit, rawEvict, businesses] = await Promise.all([
        fetch(`${DATASF}/vw6y-z8j6.json?${new URLSearchParams({
          $where: w311,
          $select: "lat,long,service_name,address,requested_datetime,closed_date,status_description",
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

        fetchBusinessesForCBD(config, { limit: 3000 }).catch(() => [] as CBDBusinessRow[]),
      ]);

      const rows311 = (raw311 as any[])
        .filter((r: any) => r.lat && r.long)
        .map((r: any) => ({
          category: r.service_name ?? "",
          address: r.address ?? "",
          date: (r.requested_datetime ?? "").split("T")[0],
          closedDate: r.closed_date ? (r.closed_date as string).split("T")[0] : null as string | null,
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

      console.log(`[BoardPacket] ${config.name}: ${permits.length} permits, ${rows311.length} 311, ${evictions.length} evictions, ${businesses.length} biz`);

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

        const permitTypesList: Record<string, number> = {};
        for (const p of permits) permitTypesList[p.type || "Other"] = (permitTypesList[p.type || "Other"] ?? 0) + 1;
        const topByVal = [...permits].sort((a, b) => b.cost - a.cost).slice(0, 3);

        const nowStr = new Date().toISOString().split("T")[0];
        const activeBiz = businesses.filter(b => !b.endDate || b.endDate >= nowStr);
        const cutoff90Str = cutoff90.toISOString().split("T")[0];
        const newBiz = businesses.filter(b => b.startDate >= cutoff90Str);
        const closedBiz = businesses.filter(b => b.endDate && b.endDate >= cutoff90Str);

        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        const res = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: `You are writing an executive summary for the ${config.name} Community Benefit District board packet. Write exactly 3 sections with headers:

## Permit Activity
Overview of permit activity — count, notable projects, construction impact.

## Clean & Safe
311 request patterns, resolution performance, hotspot areas.

## Business Climate
Business registration trends, new openings, closures.

DATA (last 90 days within ${config.name} boundary):
- ${permits.length} active building permits (${Object.entries(permitTypesList).slice(0, 3).map(([t, n]) => `${t}: ${n}`).join(", ")})
- ${rows311.length} 311 service requests (${catList})
- Top hotspots: ${topAddrs}
- ${evictions.length} eviction notices
- Active businesses: ${activeBiz.length}, New: ${newBiz.length}, Closures: ${closedBiz.length}
${topByVal.length > 0 ? `- Highest-value permits: ${topByVal.map(p => `${p.address} ($${(p.cost / 1000).toFixed(0)}K)`).join(", ")}` : ""}

Be concise, data-driven, professional. Include specific numbers and addresses. Each section should be 2-3 sentences.${getLanguageInstruction(language)}`,
          }],
        });
        aiSummary = res.content[0]?.type === "text" ? res.content[0].text : "";
      } else {
        aiSummary = "AI summary unavailable \u2014 API key not configured.";
      }

      // ── Build PDF ────────────────────────────────────────────

      setStage("building");
      buildPDF({ config, permits, rows311, evictions, businesses, aiSummary });
      setStage("done");
    } catch (err) {
      console.error("[BoardPacket] Error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStage("error");
    }
  }, [config, cbdBoundaries]);

  if (!config) return null;

  const isGenerating = stage === "fetching" || stage === "ai" || stage === "building";
  const now = new Date();
  const previewMonthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const previews = [
    {
      page: 1, title: "Cover Page",
      preview: config.name,
      sub: `${previewMonthYear} Board Report`,
      color: config.accent_color,
    },
    {
      page: 2, title: "Key Metrics",
      preview: "6 metrics",
      sub: "Permits, 311, Evictions, Businesses, Resolution",
      color: "#3B82F6",
    },
    {
      page: 3, title: "311 Clean & Safe",
      preview: "Resolution",
      sub: "Category breakdown, hotspots, resolution",
      color: "#8B5CF6",
    },
    {
      page: 4, title: "Permit Activity",
      preview: "By type",
      sub: "Type breakdown, notable projects, flags",
      color: "#10B981",
    },
    {
      page: 5, title: "Business Pulse",
      preview: "New",
      sub: "Registrations, closures, trends",
      color: "#F59E0B",
    },
    {
      page: 6, title: "Executive Summary",
      preview: "AI",
      sub: "Permit Activity, Clean & Safe, Business Climate",
      color: config.accent_color,
    },
  ];

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* Header */}
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
          Generate a 6-page PDF report for {config.name} board meetings.
        </p>
      </div>

      {/* Preview cards — 3-column grid */}
      <style>{`
        @media (max-width: 640px) {
          .bp-preview-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      <div className="bp-preview-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12, marginBottom: 32,
      }}>
        {previews.map(p => (
          <div key={p.page} style={{
            background: COLORS.white, borderRadius: 12,
            border: "1px solid #e5e7eb", padding: 16,
            display: "flex", flexDirection: "column",
            position: "relative", overflow: "hidden",
          }}>
            {/* Accent top line */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: 3, background: p.color,
            }} />
            <div style={{
              fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
              color: COLORS.warmGray, textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: 8,
            }}>
              Page {p.page}
            </div>
            <div style={{
              fontFamily: FONTS.display, fontSize: 20, fontWeight: 700,
              color: p.color, lineHeight: 1.1, marginBottom: 4,
            }}>
              {p.preview}
            </div>
            <div style={{
              fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
              color: "#1a1a2e", marginBottom: 4,
            }}>
              {p.title}
            </div>
            <div style={{
              fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
              lineHeight: 1.4,
            }}>
              {p.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Progress steps (visible during generation) */}
      {isGenerating && (
        <div style={{
          background: COLORS.white, borderRadius: 12,
          border: "1px solid #e5e7eb", padding: "20px 24px",
          marginBottom: 24,
        }}>
          <div style={{
            fontFamily: FONTS.body, fontSize: 12, fontWeight: 600,
            color: "#1a1a2e", marginBottom: 12,
          }}>
            Generating Board Packet...
          </div>
          {STAGE_STEPS.map(step => {
            const stageOrder = ["fetching", "ai", "building"];
            const currentIdx = stageOrder.indexOf(stage);
            const stepIdx = stageOrder.indexOf(step.key);
            const isDone = stepIdx < currentIdx;
            const isActive = stepIdx === currentIdx;

            return (
              <div key={step.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 0",
                fontFamily: FONTS.body, fontSize: 13,
                color: isDone ? "#10B981" : isActive ? "#1a1a2e" : COLORS.warmGray,
              }}>
                {isDone ? (
                  <span style={{ color: "#10B981", fontWeight: 700 }}>&#10003;</span>
                ) : isActive ? (
                  <>
                    <style>{`@keyframes bp-spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      border: `2px solid ${COLORS.lightBorder}`,
                      borderTopColor: accent,
                      animation: "bp-spin 0.8s linear infinite",
                    }} />
                  </>
                ) : (
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${COLORS.lightBorder}`, display: "inline-block" }} />
                )}
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{step.label}</span>
              </div>
            );
          })}
          <div style={{
            fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
            marginTop: 8,
          }}>
            Estimated time: ~15 seconds
          </div>
        </div>
      )}

      {/* Generate button */}
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
          }}
        >
          {isGenerating
            ? "Generating..."
            : stage === "done" ? "Regenerate Packet" : "Generate Board Packet"}
        </button>

        {stage === "done" && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.green, marginTop: 12,
          }}>
            Download complete!
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
