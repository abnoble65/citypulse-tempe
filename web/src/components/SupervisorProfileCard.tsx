/**
 * SupervisorProfileCard — collapsible civic profile for SF Supervisors.
 *
 * Shows a collapsed summary (avatar + name + committees) with expand toggle.
 * Expanded view: About, Stated Priorities, Community Record, Contact, and
 * an optional District Data Cross-Reference section when aggregatedData is provided.
 */

import React, { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { SupervisorAvatar, getSupervisorName } from "./SupervisorAvatar";
import type { SupervisorProfile } from "../data/supervisorProfiles";
import type { DistrictConfig } from "../districts";
import type { DistrictData } from "../services/aggregator";

// ── Inline SVG icons for priority topics ─────────────────────────────────────

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 1.5L3 4.5V9.5C3 13.64 6.04 17.47 10 18.5C13.96 17.47 17 13.64 17 9.5V4.5L10 1.5Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 10L10 3L17 10V17H12V13H8V17H3V10Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="3" width="12" height="15" rx="1" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <rect x="7" y="6" width="2" height="2" fill={COLORS.orange} />
      <rect x="11" y="6" width="2" height="2" fill={COLORS.orange} />
      <rect x="7" y="10" width="2" height="2" fill={COLORS.orange} />
      <rect x="11" y="10" width="2" height="2" fill={COLORS.orange} />
      <rect x="8.5" y="14" width="3" height="4" fill={COLORS.orange} />
    </svg>
  );
}
function IconPill() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="5" y="4" width="10" height="12" rx="5" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <line x1="5" y1="10" x2="15" y2="10" stroke={COLORS.orange} strokeWidth="1.5" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M6 7L7 17H13L14 7" stroke={COLORS.orange} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M4 7H16" stroke={COLORS.orange} strokeWidth="1.5" />
      <path d="M8 4H12V7H8V4Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
function IconStorefront() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 9V17H17V9" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <path d="M1 9L3 4H17L19 9" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <path d="M8 13H12V17H8V13Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

const ICON_MAP: Record<string, () => React.ReactElement> = {
  shield: IconShield,
  home: IconHome,
  building: IconBuilding,
  pill: IconPill,
  trash: IconTrash,
  storefront: IconStorefront,
};

// ── Props ────────────────────────────────────────────────────────────────────

interface SupervisorProfileCardProps {
  profile: SupervisorProfile | null;
  districtConfig: DistrictConfig;
  aggregatedData?: DistrictData | null;
  defaultExpanded?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SupervisorProfileCard({
  profile,
  districtConfig,
  aggregatedData,
  defaultExpanded = false,
}: SupervisorProfileCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // ── Fallback: no full profile yet ──────────────────────────────────────
  if (!profile) {
    const name = getSupervisorName(districtConfig.number);
    if (!name) return null;
    return (
      <div style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.lightBorder}`,
        borderRadius: 16,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}>
        <SupervisorAvatar districtNumber={districtConfig.number} size={52} />
        <div>
          <div style={{
            fontFamily: FONTS.display, fontSize: 16, fontWeight: 700,
            color: COLORS.charcoal,
          }}>
            {name}
          </div>
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.warmGray,
          }}>
            {districtConfig.label}
          </div>
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.warmGray, fontStyle: "italic", marginTop: 4,
          }}>
            Full profile coming soon.
          </div>
        </div>
      </div>
    );
  }

  // ── Shared badge renderer ────────────────────────────────────────────
  const committeeBadges = profile.committees.map(c => (
    <span key={c.name} style={{
      display: "inline-block",
      fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
      background: COLORS.orangePale,
      color: COLORS.charcoal,
      borderRadius: 8,
      padding: "3px 10px",
      marginRight: 6,
      marginBottom: 4,
    }}>
      {c.role !== "Member" ? `${c.role} · ` : ""}{c.name}
    </span>
  ));

  const toggleButton = (
    <button
      onClick={() => setExpanded(!expanded)}
      style={{
        background: expanded ? COLORS.orangePale : COLORS.cream,
        border: `1px solid ${expanded ? COLORS.orange : COLORS.lightBorder}`,
        borderRadius: 10,
        padding: "8px 16px",
        fontFamily: FONTS.body,
        fontSize: 12,
        fontWeight: 700,
        color: COLORS.orange,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "all 0.15s ease",
      }}
    >
      {expanded ? "Collapse" : "View Profile"}
    </button>
  );

  // ── Collapsed view ─────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.lightBorder}`,
        borderRadius: 16,
        padding: "18px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}>
        <SupervisorAvatar districtNumber={districtConfig.number} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 17, fontWeight: 700,
            color: COLORS.charcoal, lineHeight: 1.2,
          }}>
            {profile.name}
          </div>
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.warmGray, marginTop: 2,
          }}>
            {districtConfig.label} · {profile.termStart}–{profile.termEnd}
          </div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" }}>
            {committeeBadges}
          </div>
        </div>
        {toggleButton}
      </div>
    );
  }

  // ── Expanded view ──────────────────────────────────────────────────
  return (
    <div style={{
      background: COLORS.white,
      border: `1px solid ${COLORS.lightBorder}`,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      {/* Header — name + alt name + term + committees + collapse button */}
      <div style={{
        padding: "24px 24px 20px",
        display: "flex", alignItems: "flex-start", gap: 16,
      }}>
        <SupervisorAvatar districtNumber={districtConfig.number} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 22, fontWeight: 800,
            color: COLORS.charcoal, lineHeight: 1.15,
          }}>
            {profile.name}
            {profile.altName && (
              <span style={{
                fontWeight: 400, fontSize: 16, color: COLORS.midGray, marginLeft: 10,
              }}>
                {profile.altName}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginTop: 4,
          }}>
            {districtConfig.label} · {profile.termStart}–{profile.termEnd}
          </div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" }}>
            {committeeBadges}
          </div>
        </div>
        {toggleButton}
      </div>

      {/* Sections */}
      <div style={{
        borderTop: `1px solid ${COLORS.lightBorder}`,
        padding: "24px 24px 28px",
      }}>
        {/* 2. About */}
          <SectionHeading text="About" />
          <div style={{ marginBottom: 24 }}>
            <LabeledRow label="Background" value={profile.background} />
            <LabeledRow label="Education" value={profile.education} />
            <LabeledRow label="Residency" value={profile.residency} />
            <LabeledRow label="Prior Role" value={profile.priorRole} />
          </div>

          {/* 3. Stated Priorities */}
          <SectionHeading text="Stated Priorities" />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}>
            {profile.statedPriorities.map(p => {
              const IconFn = ICON_MAP[p.icon];
              return (
                <div key={p.topic} style={{
                  background: COLORS.white,
                  border: `1px solid ${COLORS.lightBorder}`,
                  borderRadius: 16,
                  padding: "16px 18px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {IconFn && <IconFn />}
                    <span style={{
                      fontFamily: FONTS.display, fontSize: 14, fontWeight: 700,
                      color: COLORS.charcoal,
                    }}>
                      {p.topic}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: FONTS.body, fontSize: 13,
                    color: COLORS.charcoal, lineHeight: 1.55,
                    margin: 0, marginBottom: 8,
                  }}>
                    {p.position}
                  </p>
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: FONTS.body, fontSize: 11,
                      color: COLORS.warmGray, textDecoration: "none",
                    }}
                  >
                    Source: {p.source}
                  </a>
                </div>
              );
            })}
          </div>

          {/* 4. Community Record */}
          <SectionHeading text="Community Record" />
          <ul style={{
            margin: "0 0 24px 0",
            padding: 0,
            listStyle: "none",
          }}>
            {profile.communityRecord.map((item, i) => (
              <li key={i} style={{
                fontFamily: FONTS.body, fontSize: 14,
                color: COLORS.charcoal, lineHeight: 1.6,
                paddingLeft: 18,
                position: "relative",
                marginBottom: 4,
              }}>
                <span style={{
                  position: "absolute", left: 0, top: 10,
                  width: 6, height: 6, borderRadius: "50%",
                  background: COLORS.orange, display: "inline-block",
                }} />
                {item}
              </li>
            ))}
          </ul>

          {/* 5. Contact & Links */}
          <SectionHeading text="Contact & Links" />
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: COLORS.charcoal, lineHeight: 1.7,
            marginBottom: 8,
          }}>
            <div><strong>Office:</strong> {profile.contact.office}</div>
            <div><strong>Phone:</strong> {profile.contact.phone}</div>
            <div>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${profile.contact.email}`} style={{ color: COLORS.orange, textDecoration: "none" }}>
                {profile.contact.email}
              </a>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {profile.sources.map(s => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
                  color: COLORS.orange, textDecoration: "none",
                  background: COLORS.orangePale,
                  borderRadius: 8, padding: "4px 12px",
                }}
              >
                {s.label} \u2197
              </a>
            ))}
          </div>

          {/* 6. District Data Cross-Reference */}
          {aggregatedData && <CrossReference profile={profile} aggregatedData={aggregatedData} districtConfig={districtConfig} />}
        </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function SectionHeading({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: FONTS.display, fontSize: 12, fontWeight: 800,
      color: COLORS.warmGray, textTransform: "uppercase",
      letterSpacing: "0.08em", marginBottom: 12,
    }}>
      {text}
    </div>
  );
}

function LabeledRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: FONTS.display, fontSize: 12, fontWeight: 700,
        color: COLORS.warmGray, textTransform: "uppercase",
        letterSpacing: "0.04em", marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONTS.body, fontSize: 14,
        color: COLORS.charcoal, lineHeight: 1.6,
      }}>
        {value}
      </div>
    </div>
  );
}

function CrossReference({
  profile,
  aggregatedData,
  districtConfig,
}: {
  profile: SupervisorProfile;
  aggregatedData: DistrictData;
  districtConfig: DistrictConfig;
}) {
  const permits = aggregatedData.permit_summary.total;
  const affordableProjects = aggregatedData.affordable_housing_summary.total_projects;
  const evictions = aggregatedData.eviction_summary.total;

  const hasHousing = profile.statedPriorities.some(p => p.topic === "Housing");
  const hasSafety = profile.statedPriorities.some(p => p.topic === "Public Safety");

  return (
    <div style={{
      background: COLORS.orangePale,
      borderRadius: 16,
      padding: "20px 22px",
    }}>
      <div style={{
        fontFamily: FONTS.display, fontSize: 12, fontWeight: 800,
        color: COLORS.warmGray, textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: 12,
      }}>
        District Data Cross-Reference
      </div>
      <div style={{
        fontFamily: FONTS.body, fontSize: 14,
        color: COLORS.charcoal, lineHeight: 1.7,
      }}>
        <p style={{ margin: "0 0 8px" }}>
          {districtConfig.label} currently has <strong>{permits.toLocaleString()}</strong> active building permits,{" "}
          <strong>{affordableProjects.toLocaleString()}</strong> affordable housing pipeline projects, and{" "}
          <strong>{evictions.toLocaleString()}</strong> eviction notices filed in the past 12 months.
        </p>
        {hasHousing && affordableProjects > 0 && (
          <p style={{ margin: "0 0 8px" }}>
            Sup. {profile.name} lists Housing as a stated priority. There are currently{" "}
            {affordableProjects} affordable housing projects tracked in the district pipeline.
          </p>
        )}
        {hasSafety && evictions > 0 && (
          <p style={{ margin: 0 }}>
            Sup. {profile.name} lists Public Safety as a stated priority. The district recorded{" "}
            {evictions.toLocaleString()} eviction filings over the past year.
          </p>
        )}
      </div>
    </div>
  );
}
