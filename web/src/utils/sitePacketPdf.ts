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

// ── Colors ──────────────────────────────────────────────────────────────────

const ORANGE = "#D4643B";
const CHARCOAL = "#3D3832";
const WARM_GRAY = "#B0A89E";

// ── Main export ─────────────────────────────────────────────────────────────

export async function generateSitePacketPDF(input: SitePacketInput): Promise<void> {
  const { site, notes } = input;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = 215.9;
  const margin = 20;
  const contentW = pageW - margin * 2;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(CHARCOAL);
  doc.text("CityPulse Site Report", margin, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(WARM_GRAY);
  doc.text(dateStamp(), margin, 22);

  // Orange accent bar
  doc.setFillColor(ORANGE);
  doc.rect(margin, 25, contentW, 2, "F");

  // ── Map thumbnail ───────────────────────────────────────────────────────
  const mapY = 31;
  const mapH = 80;
  const token = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

  let mapLoaded = false;
  if (token) {
    try {
      const mapUrl =
        `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
        `pin-s+d4643b(${site.lng},${site.lat})/` +
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
    doc.setTextColor(WARM_GRAY);
    doc.text("Map preview unavailable", pageW / 2, mapY + mapH / 2, { align: "center" });
  }

  // ── Parcel Details ──────────────────────────────────────────────────────
  let y = mapY + mapH + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(ORANGE);
  doc.text("Parcel Details", margin, y);
  y += 1;
  doc.setDrawColor(ORANGE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

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
    doc.setTextColor(WARM_GRAY);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(CHARCOAL);
    doc.text(value, margin + 45, y);
    y += 6;
  }

  // ── Readiness Score ─────────────────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(ORANGE);
  doc.text("Readiness Score", margin, y);
  y += 1;
  doc.setDrawColor(ORANGE);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  const filled = site.readinessScore;
  const stars = Array.from({ length: 5 }, (_, i) => (i < filled ? "\u2605" : "\u2606")).join(" ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(CHARCOAL);
  doc.text(`${stars}  ${filled}/5`, margin, y);
  y += 5;

  // Breakdown line
  const parts: string[] = [];
  // The scoring logic mirrors computeReadiness in SiteSelection.tsx
  if (site.readinessScore >= 2) parts.push("Zoning match +2");
  if (site.permitCount > 0) parts.push("Active permits +1");
  if (!site.hasDispute) parts.push("No disputes +1");
  if (site.assessedValue > 500_000) parts.push("Value >$500K +1");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(WARM_GRAY);
  doc.text(parts.join("  |  "), margin, y);

  // ── AI Risk Notes ───────────────────────────────────────────────────────
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(ORANGE);
  doc.text("AI Risk Notes", margin, y);
  y += 1;
  doc.setDrawColor(ORANGE);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(CHARCOAL);
  const wrappedNotes = doc.splitTextToSize(notes || "No notes generated.", contentW);
  doc.text(wrappedNotes, margin, y);

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(WARM_GRAY);
  doc.text(
    "Generated by CityPulse  |  citypulse-bay.vercel.app",
    pageW / 2,
    272,
    { align: "center" },
  );

  // ── Download ────────────────────────────────────────────────────────────
  doc.save(`CityPulse-SiteReport-${site.blklot}-${dateFileStamp()}.pdf`);
}
