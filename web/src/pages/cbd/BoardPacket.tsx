/**
 * BoardPacket.tsx — One-page landscape PDF board report for CBD meetings.
 *
 * Landscape letter (11"x8.5") with grid layout:
 *   Top bar → Key metrics row → 50/50 detail columns → AI brief → Footer
 * Translates labels and AI content to zh/es via LanguageContext.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useCBD, type CBDConfig } from "../../contexts/CBDContext";
import { COLORS, FONTS } from "../../theme";
import { isPointInCBD, type CBDBoundaryEntry } from "../../utils/geoFilter";
import { fetchBusinessesForCBD, type CBDBusinessRow } from "../../utils/cbdFetch";
import Anthropic from "@anthropic-ai/sdk";
import { useLanguage, getLanguageInstruction, type AppLanguage } from "../../contexts/LanguageContext";
import { cleanPermitLabel } from "../../services/aggregator";

const DATASF = "https://data.sfgov.org/resource";

// ── Label translations ────────────────────────────────────────────────

const LABELS: Record<string, Record<AppLanguage, string>> = {
  boardReport:     { en: "Board Report",       zh: "董事會報告",      es: "Informe de la Junta" },
  permits:         { en: "Permits",            zh: "許可證",         es: "Permisos" },
  requests311:     { en: "311 Requests",        zh: "311 請求",       es: "Solicitudes 311" },
  resolutionRate:  { en: "Resolution Rate",     zh: "解決率",         es: "Tasa de Resolución" },
  evictions:       { en: "Evictions",           zh: "驅逐",          es: "Desalojos" },
  newBusiness:     { en: "New Businesses",      zh: "新企業",         es: "Nuevos Negocios" },
  avgResponse:     { en: "Avg Response",        zh: "平均回應",       es: "Resp. Promedio" },
  activity311:     { en: "311 Activity Summary", zh: "311 活動摘要",   es: "Resumen de Actividad 311" },
  permitActivity:  { en: "Permit Activity",     zh: "許可證活動",      es: "Actividad de Permisos" },
  categoryBreak:   { en: "Category Breakdown",  zh: "類別細分",       es: "Desglose por Categoría" },
  topHotspots:     { en: "Top Hotspots",        zh: "主要熱點",       es: "Puntos Críticos" },
  resByCategory:   { en: "Resolution by Cat.",  zh: "按類別解決",      es: "Resolución por Cat." },
  byType:          { en: "By Type",            zh: "按類型",         es: "Por Tipo" },
  topProjects:     { en: "Top Projects",        zh: "主要項目",       es: "Proyectos Principales" },
  executiveBrief:  { en: "Executive Brief",     zh: "執行摘要",       es: "Resumen Ejecutivo" },
  poweredBy:       { en: "Powered by CityPulse", zh: "由 CityPulse 提供", es: "Desarrollado por CityPulse" },
  generated:       { en: "Generated",           zh: "生成日期",       es: "Generado" },
  requests:        { en: "requests",            zh: "個請求",         es: "solicitudes" },
  days:            { en: "days",               zh: "天",            es: "días" },
  generateBtn:     { en: "Generate Board Packet", zh: "生成董事會報告", es: "Generar Informe" },
  regenerateBtn:   { en: "Regenerate Packet",   zh: "重新生成報告",    es: "Regenerar Informe" },
  generating:      { en: "Generating...",       zh: "生成中...",      es: "Generando..." },
  fetchingData:    { en: "Fetching data...",    zh: "正在獲取數據...", es: "Obteniendo datos..." },
  genBrief:        { en: "Generating brief...", zh: "生成摘要中...",   es: "Generando resumen..." },
  buildingPDF:     { en: "Building PDF...",     zh: "構建 PDF 中...", es: "Construyendo PDF..." },
  downloadDone:    { en: "Download complete!",  zh: "下載完成！",      es: "¡Descarga completa!" },
};

function t(key: string, lang: AppLanguage): string {
  return LABELS[key]?.[lang] ?? LABELS[key]?.en ?? key;
}

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function cleanAddress(raw: string): string {
  return raw
    .replace(/,?\s*(SAN FRANCISCO|SF)\s*,?\s*(CA\s*)?\d{0,5}\s*$/i, "")
    .replace(/,?\s*CA\s*\d{5}\s*$/i, "")
    .trim();
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── PDF data shape ────────────────────────────────────────────────────

interface PacketData {
  config: CBDConfig;
  permits: { type: string; cost: number; address: string; status: string }[];
  rows311: { category: string; address: string; date: string; closedDate: string | null }[];
  evictions: { address: string; date: string }[];
  businesses: CBDBusinessRow[];
  aiSummary: string;
  lang: AppLanguage;
}

// ── One-page landscape PDF builder ─────────────────────────────────────

function buildPDF(d: PacketData) {
  const { config, permits, rows311, evictions, businesses, aiSummary, lang } = d;
  const doc = new jsPDF("l", "mm", "letter"); // landscape 279.4 x 215.9mm
  const W = 279.4, H = 215.9, M = 12;
  const accent = hexToRGB(config.accent_color);
  const now = new Date();
  const monthYear = now.toLocaleDateString(lang === "zh" ? "zh-TW" : lang === "es" ? "es" : "en-US", { month: "long", year: "numeric" });
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const nowStr = now.toISOString().split("T")[0];

  // ── Data aggregation ────────────────────────────────

  const catCounts: Record<string, number> = {};
  for (const r of rows311) {
    const c = normalize311Cat(r.category);
    catCounts[c] = (catCounts[c] ?? 0) + 1;
  }
  const catEntries = Object.entries(catCounts)
    .filter(([cat]) => cat !== "Other")
    .sort(([, a], [, b]) => b - a);

  const addrCounts: Record<string, number> = {};
  for (const r of rows311) {
    const a = toTitleCase(cleanAddress(r.address.trim()));
    if (a) addrCounts[a] = (addrCounts[a] ?? 0) + 1;
  }
  const topAddresses = Object.entries(addrCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  const permitTypes: Record<string, number> = {};
  for (const p of permits) {
    const label = cleanPermitLabel(p.type || "Other");
    permitTypes[label] = (permitTypes[label] ?? 0) + 1;
  }
  const topByValue = [...permits].sort((a, b) => b.cost - a.cost).slice(0, 3);

  const closedRows = rows311.filter(r => r.closedDate);
  const resRate = rows311.length > 0 ? ((closedRows.length / rows311.length) * 100).toFixed(0) : "0";
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
    if (dd > 0) { if (!catResDays[cat]) catResDays[cat] = []; catResDays[cat].push(dd); }
  }

  const cutoff90Str = cutoff.toISOString().split("T")[0];
  const activeBiz = businesses.filter(b => !b.endDate || b.endDate >= nowStr);
  const newBiz = businesses.filter(b => b.startDate >= cutoff90Str);

  // ─── TOP BAR (y: 0–15) ────────────────────────────────────────────

  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...accent);
  doc.text(config.name, M, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`${t("boardReport", lang)} · ${monthYear}`, W / 2, 10, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(`${t("poweredBy", lang)}  ·  ${t("generated", lang)} ${dateStr}`, W - M, 10, { align: "right" });

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(M, 14, W - M, 14);

  // ─── ROW 1: KEY METRICS (y: 16–40) ─────────────────────────────────

  const metricsY = 18;
  const metrics = [
    { label: t("permits", lang),        value: String(permits.length),   color: [59, 130, 246] as [number, number, number] },
    { label: t("requests311", lang),     value: String(rows311.length),   color: [139, 92, 246] as [number, number, number] },
    { label: t("resolutionRate", lang),  value: `${resRate}%`,           color: [16, 185, 129] as [number, number, number] },
    { label: t("evictions", lang),       value: String(evictions.length), color: [239, 68, 68] as [number, number, number] },
    { label: t("newBusiness", lang),     value: String(newBiz.length),    color: [245, 158, 11] as [number, number, number] },
    { label: t("avgResponse", lang),     value: avgResDays === "N/A" ? "—" : `${avgResDays}d`, color: [100, 116, 139] as [number, number, number] },
  ];

  const mBoxW = (W - M * 2 - 5 * 5) / 6;
  const mBoxH = 20;
  metrics.forEach((m, i) => {
    const x = M + i * (mBoxW + 5);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, metricsY, mBoxW, mBoxH, 2, 2, "S");
    doc.setFillColor(...m.color);
    doc.rect(x, metricsY + 3, 1.2, mBoxH - 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...m.color);
    doc.text(m.value, x + mBoxW / 2, metricsY + 10, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    const labelLines = doc.splitTextToSize(m.label, mBoxW - 6);
    doc.text(labelLines[0], x + mBoxW / 2, metricsY + 16, { align: "center" });
  });

  // ─── ROW 2: TWO-COLUMN DETAIL (y: 42–115) ──────────────────────────

  const row2Y = 42;
  const colW = (W - M * 2 - 8) / 2;
  const leftX = M;
  const rightX = M + colW + 8;
  // — LEFT COLUMN: 311 Activity Summary ——————————————

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...accent);
  doc.text(t("activity311", lang), leftX, row2Y);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(leftX, row2Y + 1.5, leftX + colW, row2Y + 1.5);

  // Category breakdown bars
  let ly = row2Y + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(t("categoryBreak", lang), leftX + 2, ly);
  ly += 4;

  const maxCatCount = catEntries.length > 0 ? catEntries[0][1] : 1;
  const barMaxW = colW * 0.45;
  const catColors: Record<string, [number, number, number]> = {
    Graffiti: [124, 58, 237], "Street Cleaning": [146, 64, 14],
    Encampments: [220, 38, 38], "Blocked Sidewalk": [37, 99, 235], Other: [140, 140, 140],
  };

  for (const [cat, count] of catEntries.slice(0, 5)) {
    const barW = Math.max(2, (count / maxCatCount) * barMaxW);
    const clr = catColors[cat] ?? [140, 140, 140];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text(truncate(cat, 18), leftX + 2, ly + 3);
    doc.setFillColor(...clr);
    doc.roundedRect(leftX + 42, ly, barW, 3.5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...clr);
    doc.text(String(count), leftX + 44 + barW, ly + 3);
    ly += 6;
  }

  // Top hotspots
  ly += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(t("topHotspots", lang), leftX + 2, ly);
  ly += 4;

  for (const [addr, count] of topAddresses.slice(0, 5)) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    const line = truncate(`${addr}  —  ${count} ${t("requests", lang)}`, 55);
    doc.text(line, leftX + 2, ly + 3);
    ly += 5;
  }

  // Resolution by category
  ly += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(t("resByCategory", lang), leftX + 2, ly);
  ly += 4;

  for (const [cat] of catEntries.slice(0, 4)) {
    const days = catResDays[cat];
    const avg = days ? (days.reduce((s, d) => s + d, 0) / days.length).toFixed(1) : "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text(truncate(cat, 18), leftX + 2, ly + 3);
    if (days) {
      const avgN = parseFloat(avg);
      if (avgN < 3) doc.setTextColor(16, 185, 129);
      else if (avgN <= 7) doc.setTextColor(180, 130, 10);
      else doc.setTextColor(220, 50, 50);
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${avg} ${t("days", lang)}`, leftX + 44, ly + 3);
    ly += 5;
  }

  // — RIGHT COLUMN: Permit Activity ——————————————

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...accent);
  doc.text(t("permitActivity", lang), rightX, row2Y);
  doc.setDrawColor(...accent);
  doc.line(rightX, row2Y + 1.5, rightX + colW, row2Y + 1.5);

  let ry = row2Y + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(t("byType", lang), rightX + 2, ry);
  ry += 4;

  const permitEntries = Object.entries(permitTypes).sort(([, a], [, b]) => b - a);
  const maxPermitCount = permitEntries.length > 0 ? permitEntries[0][1] : 1;

  for (const [type, count] of permitEntries.slice(0, 5)) {
    const barW = Math.max(2, (count / maxPermitCount) * barMaxW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text(truncate(type, 22), rightX + 2, ry + 3);
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(rightX + 50, ry, barW, 3.5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(59, 130, 246);
    doc.text(String(count), rightX + 52 + barW, ry + 3);
    ry += 6;
  }

  // Top projects
  ry += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(t("topProjects", lang), rightX + 2, ry);
  ry += 4;

  for (const p of topByValue.slice(0, 3)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(50, 50, 50);
    const projLine = truncate(`${toTitleCase(cleanAddress(p.address))}  —  $${(p.cost / 1000).toFixed(0)}K  (${cleanPermitLabel(p.type)})`, 60);
    doc.text(projLine, rightX + 2, ry + 3);
    ry += 5.5;
  }
  if (topByValue.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text("No high-value permits in period", rightX + 2, ry + 3);
    ry += 5.5;
  }

  // Business summary
  ry += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(t("newBusiness", lang), rightX + 2, ry);
  ry += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`${activeBiz.length} active  ·  ${newBiz.length} new (90d)  ·  ${businesses.filter(b => b.endDate && b.endDate >= cutoff90Str).length} closures`, rightX + 2, ry + 3);

  // ─── ROW 3: AI EXECUTIVE BRIEF ─────────────────────────────────────

  const briefY = Math.max(ly, ry) + 6;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(M, briefY - 2, W - M, briefY - 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...accent);
  doc.text(t("executiveBrief", lang), M, briefY + 3);

  const briefMaxW = W - M * 2 - 4;
  const briefMaxH = 75; // mm available for AI text

  if (aiSummary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);

    // Clean markdown formatting
    const cleaned = aiSummary
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .trim();

    const lines = doc.splitTextToSize(cleaned, briefMaxW);
    const lineH = 3.4;
    const maxLines = Math.floor(briefMaxH / lineH);
    const showLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      showLines[maxLines - 1] = showLines[maxLines - 1].replace(/\s+\S*$/, "...");
    }
    doc.text(showLines, M + 2, briefY + 8);
  }

  // ─── BOTTOM BAR (y: H-8 to H) ──────────────────────────────────────

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(M, H - 10, W - M, H - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  const contactParts = [config.contact_email, config.contact_phone].filter(Boolean);
  if (contactParts.length) doc.text(contactParts.join("  ·  "), M, H - 5);
  doc.text("Page 1 of 1", W / 2, H - 5, { align: "center" });
  if (config.website_url) doc.text(config.website_url, W - M, H - 5, { align: "right" });

  // — Save ————————————————————————————————————————————

  const filename = `${config.short_name.replace(/\s+/g, "-")}_Board-Report_${monthYear.replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}

// ── Generation stages ────────────────────────────────────────────────────

type Stage = "idle" | "fetching" | "ai" | "building" | "done" | "error";

// ── Live preview data ────────────────────────────────────────────────────

interface PreviewData {
  permits: { type: string; cost: number; address: string; status: string }[];
  rows311: { category: string; address: string; date: string; closedDate: string | null }[];
  evictions: { address: string; date: string }[];
  businesses: CBDBusinessRow[];
}

// ── Main component ─────────────────────────────────────────────────────────

export function BoardPacket() {
  const { config } = useCBD();
  const { language } = useLanguage();
  const accent = config?.accent_color ?? "#E8652D";
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const boundaryEntry = useMemo(() => config ? buildBoundaryEntry(config) : null, [config]);
  const cbdBoundaries = useMemo(() => boundaryEntry ? [boundaryEntry] : [], [boundaryEntry]);

  // ── Fetch preview data on mount ─────────────────────────────────────

  useEffect(() => {
    if (!config || !cbdBoundaries.length) return;
    let cancelled = false;
    setPreviewLoading(true);

    (async () => {
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
          fetch(`${DATASF}/vw6y-z8j6.json?${new URLSearchParams({ $where: w311, $select: "lat,long,service_name,address,requested_datetime,closed_date,status_description", $limit: "5000" })}`).then(r => r.json()).catch(() => []),
          fetch(`${DATASF}/i98e-djp9.json?${new URLSearchParams({ $where: wPermit, $select: "location,permit_type_definition,estimated_cost,street_number,street_name,street_suffix,status", $limit: "2000" })}`).then(r => r.json()).catch(() => []),
          fetch(`${DATASF}/5cei-gny5.json?${new URLSearchParams({ $where: wEvict, $select: "shape,address,file_date", $limit: "500" })}`).then(r => r.json()).catch(() => []),
          fetchBusinessesForCBD(config, { limit: 3000 }).catch(() => [] as CBDBusinessRow[]),
        ]);

        const rows311 = (raw311 as any[]).filter((r: any) => r.lat && r.long)
          .map((r: any) => ({ category: r.service_name ?? "", address: r.address ?? "", date: (r.requested_datetime ?? "").split("T")[0], closedDate: r.closed_date ? (r.closed_date as string).split("T")[0] : null as string | null, lat: parseFloat(r.lat), lng: parseFloat(r.long) }))
          .filter(p => !isNaN(p.lat) && isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

        const permits = (rawPermit as any[]).filter((r: any) => r.location?.coordinates)
          .map((r: any) => ({ type: r.permit_type_definition ?? "", cost: parseFloat(r.estimated_cost) || 0, address: [r.street_number, r.street_name, r.street_suffix].filter(Boolean).join(" "), status: r.status ?? "", lat: r.location.coordinates[1], lng: r.location.coordinates[0] }))
          .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

        const evictions = (rawEvict as any[]).filter((r: any) => r.shape?.coordinates)
          .map((r: any) => ({ address: r.address ?? "", date: (r.file_date ?? "").split("T")[0], lat: r.shape.coordinates[1], lng: r.shape.coordinates[0] }))
          .filter(p => isPointInCBD(p.lat, p.lng, cbdBoundaries) !== null);

        if (!cancelled) setPreview({ permits, rows311, evictions, businesses });
      } catch (e) {
        console.warn("[BoardPacket] preview fetch failed:", e);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [config, cbdBoundaries]);

  // ── Generate PDF ────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!config || !preview) return;
    setStage("fetching");
    setError("");

    try {
      const { permits, rows311, evictions, businesses } = preview;

      // ── AI executive brief ─────────────────────────────────
      setStage("ai");
      let aiSummary = "";
      const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;

      if (apiKey) {
        const catCounts: Record<string, number> = {};
        for (const r of rows311) catCounts[normalize311Cat(r.category)] = (catCounts[normalize311Cat(r.category)] ?? 0) + 1;
        const catList = Object.entries(catCounts).sort(([, a], [, b]) => b - a).map(([c, n]) => `${c}: ${n}`).join(", ");
        const addrCounts: Record<string, number> = {};
        for (const r of rows311) { const a = r.address.toUpperCase().trim(); if (a) addrCounts[a] = (addrCounts[a] ?? 0) + 1; }
        const topAddrs = Object.entries(addrCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([a, n]) => `${a}: ${n}`).join("; ");
        const closedCount = rows311.filter(r => r.closedDate).length;
        const resRate = rows311.length > 0 ? ((closedCount / rows311.length) * 100).toFixed(0) : "0";
        const nowStr = new Date().toISOString().split("T")[0];
        const cutoff90 = new Date(); cutoff90.setDate(cutoff90.getDate() - 90);
        const activeBiz = businesses.filter(b => !b.endDate || b.endDate >= nowStr);
        const newBiz = businesses.filter(b => b.startDate >= cutoff90.toISOString().split("T")[0]);
        const topByVal = [...permits].sort((a, b) => b.cost - a.cost).slice(0, 2);

        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        const res = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{ role: "user", content: `Write a 150-word executive brief for the ${config.name} CBD board. Two sections: Key Findings (2-3 sentences on data highlights) and Recommended Actions (2-3 bullet points).

DATA (90 days): ${permits.length} permits, ${rows311.length} 311 requests (${catList}), ${resRate}% resolved, ${evictions.length} evictions, ${activeBiz.length} active businesses (${newBiz.length} new). Top hotspots: ${topAddrs}. ${topByVal.length > 0 ? `Highest permits: ${topByVal.map(p => `${p.address} $${(p.cost/1000).toFixed(0)}K`).join(", ")}` : ""}

Be concise and data-driven. 150 words maximum.${getLanguageInstruction(language)}` }],
        });
        aiSummary = res.content[0]?.type === "text" ? res.content[0].text : "";
      } else {
        aiSummary = "AI summary unavailable — API key not configured.";
      }

      // ── Build PDF ────────────────────────────────────────────
      setStage("building");
      buildPDF({ config, permits, rows311, evictions, businesses, aiSummary, lang: language });
      setStage("done");
    } catch (err) {
      console.error("[BoardPacket] Error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStage("error");
    }
  }, [config, preview, language]);

  if (!config) return null;

  const isGenerating = stage === "fetching" || stage === "ai" || stage === "building";
  const now = new Date();
  const monthYear = now.toLocaleDateString(language === "zh" ? "zh-TW" : language === "es" ? "es" : "en-US", { month: "long", year: "numeric" });

  // ── Preview metrics ─────────────────────────────────────────────────

  const pm = useMemo(() => {
    if (!preview) return null;
    const { permits, rows311, evictions, businesses } = preview;
    const closedRows = rows311.filter(r => r.closedDate);
    const resRate = rows311.length > 0 ? ((closedRows.length / rows311.length) * 100).toFixed(0) : "0";
    const resDays: number[] = [];
    for (const r of closedRows) {
      const dd = (new Date(r.closedDate!).getTime() - new Date(r.date).getTime()) / 86_400_000;
      if (dd > 0) resDays.push(dd);
    }
    const avgDays = resDays.length > 0 ? (resDays.reduce((s, d) => s + d, 0) / resDays.length).toFixed(1) : "—";
    const cutoff90 = new Date(); cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffStr = cutoff90.toISOString().split("T")[0];
    const newBiz = businesses.filter(b => b.startDate >= cutoffStr);
    const catCounts: Record<string, number> = {};
    for (const r of rows311) catCounts[normalize311Cat(r.category)] = (catCounts[normalize311Cat(r.category)] ?? 0) + 1;
    const cats = Object.entries(catCounts).filter(([cat]) => cat !== "Other").sort(([, a], [, b]) => b - a);
    const addrCounts: Record<string, number> = {};
    for (const r of rows311) { const a = toTitleCase(cleanAddress(r.address.trim())); if (a) addrCounts[a] = (addrCounts[a] ?? 0) + 1; }
    const topAddr = Object.entries(addrCounts).sort(([, a], [, b]) => b - a).slice(0, 4);
    const permitTypes: Record<string, number> = {};
    for (const p of permits) { const label = cleanPermitLabel(p.type || "Other"); permitTypes[label] = (permitTypes[label] ?? 0) + 1; }
    const pTypes = Object.entries(permitTypes).sort(([, a], [, b]) => b - a);
    const topProjects = [...permits].sort((a, b) => b.cost - a.cost).slice(0, 3);

    return { permits: permits.length, requests: rows311.length, resRate, evictions: evictions.length, newBiz: newBiz.length, avgDays, cats, topAddr, pTypes, topProjects };
  }, [preview]);

  const stageSteps = [
    { key: "fetching" as Stage, label: t("fetchingData", language) },
    { key: "ai" as Stage,       label: t("genBrief", language) },
    { key: "building" as Stage, label: t("buildingPDF", language) },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 16px 48px" }}>
      {/* Header */}
      <div style={{ padding: "24px 0 16px" }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700, color: COLORS.charcoal, margin: 0 }}>
          {t("boardReport", language)}
        </h1>
        <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, marginTop: 6 }}>
          {config.name} · {monthYear}
        </p>
      </div>

      {/* ── Live Preview ─────────────────────────────────────────── */}

      <div style={{
        background: COLORS.white, borderRadius: 12,
        border: "1px solid #e5e7eb", overflow: "hidden",
        marginBottom: 24,
      }}>
        {/* Preview top bar */}
        <div style={{
          borderTop: `3px solid ${accent}`,
          padding: "10px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
        }}>
          <span style={{ fontFamily: FONTS.heading, fontSize: 15, fontWeight: 700, color: accent }}>{config.name}</span>
          <span style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray }}>{t("boardReport", language)} · {monthYear}</span>
        </div>

        {previewLoading || !pm ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div className="sk" style={{ width: 32, height: 32, borderRadius: 8, margin: "0 auto 12px" }} />
            <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray }}>{t("fetchingData", language)}</span>
          </div>
        ) : (
          <div style={{ padding: "16px 20px" }}>
            {/* Metric boxes row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: t("permits", language), value: String(pm.permits), color: "#3B82F6" },
                { label: t("requests311", language), value: String(pm.requests), color: "#8B5CF6" },
                { label: t("resolutionRate", language), value: `${pm.resRate}%`, color: "#10B981" },
                { label: t("evictions", language), value: String(pm.evictions), color: "#EF4444" },
                { label: t("newBusiness", language), value: String(pm.newBiz), color: "#F59E0B" },
                { label: t("avgResponse", language), value: pm.avgDays === "—" ? "—" : `${pm.avgDays}d`, color: "#64748B" },
              ].map(m => (
                <div key={m.label} style={{
                  flex: "1 1 100px", minWidth: 90, background: "#f9fafb",
                  borderRadius: 8, padding: "10px 12px", textAlign: "center",
                  borderLeft: `3px solid ${m.color}`,
                }}>
                  <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray, marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Two-column detail */}
            <style>{`
              @media (max-width: 640px) { .bp-cols { flex-direction: column !important; } }
            `}</style>
            <div className="bp-cols" style={{ display: "flex", gap: 20, marginBottom: 16 }}>
              {/* Left: 311 */}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 700, color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 10 }}>
                  {t("activity311", language)}
                </div>
                {pm.cats.slice(0, 4).map(([cat, count]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, color: "#333", width: 110, flexShrink: 0 }}>{cat}</span>
                    <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pm.cats[0] ? (count / pm.cats[0][1]) * 100 : 0}%`, background: accent, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 600, color: "#333", width: 30, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
                <div style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 600, color: COLORS.warmGray, marginTop: 8, marginBottom: 4 }}>{t("topHotspots", language)}</div>
                {pm.topAddr.slice(0, 3).map(([addr, count]) => (
                  <div key={addr} style={{ fontFamily: FONTS.body, fontSize: 10, color: "#555", marginBottom: 2 }}>
                    {addr} — {count}
                  </div>
                ))}
              </div>

              {/* Right: Permits */}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 700, color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 10 }}>
                  {t("permitActivity", language)}
                </div>
                {pm.pTypes.slice(0, 4).map(([type, count]) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, color: "#333", width: 120, flexShrink: 0 }}>{truncate(type, 22)}</span>
                    <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pm.pTypes[0] ? (count / pm.pTypes[0][1]) * 100 : 0}%`, background: "#3B82F6", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 600, color: "#333", width: 30, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
                <div style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 600, color: COLORS.warmGray, marginTop: 8, marginBottom: 4 }}>{t("topProjects", language)}</div>
                {pm.topProjects.slice(0, 2).map((p, i) => (
                  <div key={i} style={{ fontFamily: FONTS.body, fontSize: 10, color: "#555", marginBottom: 2 }}>
                    {toTitleCase(cleanAddress(p.address))} — ${(p.cost / 1000).toFixed(0)}K ({cleanPermitLabel(p.type)})
                  </div>
                ))}
                {pm.topProjects.length === 0 && (
                  <div style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray, fontStyle: "italic" }}>No high-value permits</div>
                )}
              </div>
            </div>

            {/* AI brief placeholder */}
            <div style={{
              borderTop: `2px solid ${accent}`,
              paddingTop: 10,
            }}>
              <div style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 700, color: accent, marginBottom: 6 }}>
                {t("executiveBrief", language)}
              </div>
              <div style={{
                fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                fontStyle: "italic", lineHeight: 1.5,
              }}>
                AI executive brief will be generated when you click the button below.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress steps */}
      {isGenerating && (
        <div style={{
          background: COLORS.white, borderRadius: 12,
          border: "1px solid #e5e7eb", padding: "16px 20px",
          marginBottom: 20,
        }}>
          {stageSteps.map(step => {
            const order = ["fetching", "ai", "building"];
            const currentIdx = order.indexOf(stage);
            const stepIdx = order.indexOf(step.key);
            const isDone = stepIdx < currentIdx;
            const isActive = stepIdx === currentIdx;
            return (
              <div key={step.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "5px 0", fontFamily: FONTS.body, fontSize: 13,
                color: isDone ? "#10B981" : isActive ? "#1a1a2e" : COLORS.warmGray,
              }}>
                {isDone ? (
                  <span style={{ color: "#10B981", fontWeight: 700 }}>&#10003;</span>
                ) : isActive ? (
                  <>
                    <style>{`@keyframes bp-spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${COLORS.lightBorder}`, borderTopColor: accent, animation: "bp-spin 0.8s linear infinite" }} />
                  </>
                ) : (
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${COLORS.lightBorder}`, display: "inline-block" }} />
                )}
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate button */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={generate}
          disabled={isGenerating || !preview}
          style={{
            background: isGenerating || !preview ? COLORS.warmGray : accent,
            color: "#fff", border: "none", borderRadius: 28,
            padding: "14px 40px", cursor: isGenerating || !preview ? "default" : "pointer",
            fontFamily: FONTS.body, fontSize: 16, fontWeight: 700,
            boxShadow: isGenerating || !preview ? "none" : `0 4px 16px ${accent}44`,
            transition: "all 0.2s",
          }}
        >
          {isGenerating ? t("generating", language) : stage === "done" ? t("regenerateBtn", language) : t("generateBtn", language)}
        </button>

        {stage === "done" && (
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.green, marginTop: 12 }}>
            {t("downloadDone", language)}
          </p>
        )}
        {stage === "error" && (
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: "#DC2626", marginTop: 12 }}>
            {error || "An error occurred. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}
