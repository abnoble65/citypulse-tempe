/**
 * sitePacketPdf.ts — Generates a branded one-page PDF site report.
 *
 * Uses jspdf for client-side PDF generation and Mapbox Static Images API
 * for the map thumbnail.
 */

import { jsPDF } from "jspdf";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SitePacketInput {
  site: {
    rank: number;
    blklot: string;
    address: string;
    lat: number;
    lng: number;
    zoning: string;
    assessedValue: number;
    permitCount: number;
    hasDispute: boolean;
    readinessScore: number;
  };
  notes: string;
}

// ── Local helpers ───────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function dateStamp(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dateFileStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// ── Brand colors ────────────────────────────────────────────────────────────

const ORANGE = "#E8652D";
const NAVY = "#1a1a2e";
const BODY = "#333333";
const LABEL = "#666666";
const MUTED = "#999999";
const STAR_EMPTY = "#CCCCCC";
const RISK_RED = "#991B1B";
const TABLE_BG = "#1a1a2e";

// ── Main export ─────────────────────────────────────────────────────────────

export async function generateSitePacketPDF(input: SitePacketInput): Promise<void> {
  const { site, notes } = input;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = 215.9;
  const margin = 20;
  const contentW = pageW - margin * 2;

  // ── Logo (fetch at runtime from public/) ──────────────────────────────
  try {
    const logoRes = await fetch("/CityPulse_Logo1_Fun.png");
    if (logoRes.ok) {
      const blob = await logoRes.blob();
      const dataUrl = await blobToDataUrl(blob);
      doc.addImage(dataUrl, "PNG", 160, 8, 30, 30);
    }
  } catch {
    // logo is optional — continue without it
  }

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(NAVY);
  doc.text("CityPulse Site Report", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(LABEL);
  doc.text(dateStamp(), margin, 22);

  // Orange accent bar
  doc.setFillColor(ORANGE);
  doc.rect(margin, 26, contentW, 2, "F");

  // ── Map thumbnail ───────────────────────────────────────────────────────
  const mapY = 32;
  const mapH = 80;
  const token = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

  let mapLoaded = false;
  if (token) {
    try {
      const mapUrl =
        `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
        `pin-s+e8652d(${site.lng},${site.lat})/` +
        `${site.lng},${site.lat},15,0/600x300@2x` +
        `?access_token=${token}`;
      const res = await fetch(mapUrl);
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        doc.addImage(dataUrl, "PNG", margin, mapY, contentW, mapH);
        mapLoaded = true;
      }
    } catch {
      // fall through to placeholder
    }
  }

  if (!mapLoaded) {
    doc.setFillColor("#F0EDEA");
    doc.rect(margin, mapY, contentW, mapH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text("Map preview unavailable", pageW / 2, mapY + mapH / 2, { align: "center" });
  }

  // ── Parcel Details ──────────────────────────────────────────────────────
  let y = mapY + mapH + 5;

  // Table header bar
  const headerH = 7;
  doc.setFillColor(TABLE_BG);
  doc.rect(margin, y - 4.5, contentW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#FFFFFF");
  doc.text("Parcel Details", margin + 3, y);
  y += headerH + 2;

  const details: [string, string][] = [
    ["Address", site.address],
    ["APN", site.blklot],
    ["Zoning", site.zoning],
    ["Assessed Value", fmtDollars(site.assessedValue)],
    ["Active Permits", `${site.permitCount} issued`],
    ["Hearing Disputes", site.hasDispute ? "Yes" : "None"],
  ];

  doc.setFontSize(10);
  for (const [label, value] of details) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(LABEL);
    doc.text(label, margin + 3, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(value === "Yes" ? RISK_RED : BODY);
    doc.text(value, margin + 48, y);
    y += 6;
  }

  // ── Readiness Score ─────────────────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.text("Readiness Score", margin, y);
  y += 1;
  doc.setDrawColor(ORANGE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + contentW, y);
  y += 7;

  // Stars — draw filled/empty with brand colors
  const filled = site.readinessScore;
  doc.setFontSize(14);
  let starX = margin;
  for (let i = 0; i < 5; i++) {
    doc.setTextColor(i < filled ? ORANGE : STAR_EMPTY);
    doc.text("\u2605", starX, y);
    starX += 7;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(BODY);
  doc.text(`${filled}/5`, starX + 2, y);
  y += 6;

  // Breakdown line
  const parts: string[] = [];
  if (site.readinessScore >= 2) parts.push("Zoning match +2");
  if (site.permitCount > 0) parts.push("Active permits +1");
  if (!site.hasDispute) parts.push("No disputes +1");
  if (site.assessedValue > 500_000) parts.push("Value >$500K +1");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(LABEL);
  doc.text(parts.join("  |  "), margin, y);

  // ── AI Risk Notes ───────────────────────────────────────────────────────
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.text("AI Risk Notes", margin, y);
  y += 1;
  doc.setDrawColor(ORANGE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(BODY);
  const wrappedNotes = doc.splitTextToSize(notes || "No notes generated.", contentW);
  doc.text(wrappedNotes, margin, y);

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.setDrawColor(ORANGE);
  doc.setLineWidth(0.4);
  doc.line(margin, 268, margin + contentW, 268);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(
    "Generated by CityPulse  |  citypulse-bay.vercel.app",
    pageW / 2,
    273,
    { align: "center" },
  );

  // ── Download ────────────────────────────────────────────────────────────
  doc.save(`CityPulse-SiteReport-${site.blklot}-${dateFileStamp()}.pdf`);
}
