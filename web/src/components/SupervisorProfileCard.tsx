/**
 * SupervisorProfileCard — polished collapsible civic profile for SF Supervisors.
 *
 * Collapsed: compact header with avatar, name, district, term, top committee.
 * Expanded: About, Stated Priorities, Community Record, Contact, Cross-Reference.
 * Animated expand/collapse with chevron rotation.
 */

import React, { useState, useRef, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { SupervisorAvatar, getSupervisorName } from "./SupervisorAvatar";
import type { SupervisorProfile } from "../data/supervisorProfiles";
import type { DistrictConfig } from "../districts";
import type { DistrictData } from "../services/aggregator";

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M10 1.5L3 4.5V9.5C3 13.64 6.04 17.47 10 18.5C13.96 17.47 17 13.64 17 9.5V4.5L10 1.5Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 10L10 3L17 10V17H12V13H8V17H3V10Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
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
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="5" y="4" width="10" height="12" rx="5" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <line x1="5" y1="10" x2="15" y2="10" stroke={COLORS.orange} strokeWidth="1.5" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M6 7L7 17H13L14 7" stroke={COLORS.orange} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M4 7H16" stroke={COLORS.orange} strokeWidth="1.5" />
      <path d="M8 4H12V7H8V4Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
function IconStorefront() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 9V17H17V9" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <path d="M1 9L3 4H17L19 9" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
      <path d="M8 13H12V17H8V13Z" stroke={COLORS.orange} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

const ICON_MAP: Record<string, () => React.ReactElement> = {
  shield: IconShield, home: IconHome, building: IconBuilding,
  pill: IconPill, trash: IconTrash, storefront: IconStorefront,
};

// Small contact icons
function IconMapPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C5.24 1 3 3.24 3 6C3 9.75 8 15 8 15S13 9.75 13 6C13 3.24 10.76 1 8 1ZM8 7.5C7.17 7.5 6.5 6.83 6.5 6S7.17 4.5 8 4.5S9.5 5.17 9.5 6S8.83 7.5 8 7.5Z" fill="#999" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3.6 1.4L5.8 1C6.1 1 6.4 1.1 6.5 1.4L7.7 4C7.8 4.3 7.7 4.6 7.5 4.8L6.3 6C7.1 7.6 8.4 8.9 10 9.7L11.2 8.5C11.4 8.3 11.7 8.2 12 8.3L14.6 9.5C14.9 9.6 15 9.9 15 10.2L14.6 12.4C14.6 12.7 14.3 13 14 13C7.4 13 2 7.6 3 1.6C3 1.3 3.3 1.1 3.6 1.4Z" fill="#999" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="#999" strokeWidth="1.2" fill="none" />
      <path d="M1 4L8 9L15 4" stroke="#999" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

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
  const [hovered, setHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Measure expanded content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, profile, aggregatedData]);

  // ── Fallback: no full profile yet ──────────────────────────────────────
  if (!profile) {
    const name = getSupervisorName(districtConfig.number);
    if (!name) return null;
    return (
      <div style={{
        background: COLORS.white,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <SupervisorAvatar districtNumber={districtConfig.number} size={48} />
        <div>
          <div style={{
            fontFamily: FONTS.display, fontSize: 16, fontWeight: 700,
            color: "#1a1a2e",
          }}>
            {name}
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: "#999", marginTop: 2 }}>
            {districtConfig.label} Supervisor
          </div>
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: "#999", fontStyle: "italic", marginTop: 4,
          }}>
            Full profile coming soon.
          </div>
        </div>
      </div>
    );
  }

  // Top committee (with role) for collapsed view
  const topCommittee = profile.committees[0];
  const remainingCount = profile.committees.length - 1;

  return (
    <div
      style={{
        background: hovered && !expanded ? "#FAFAFA" : COLORS.white,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "background 0.15s ease, box-shadow 0.15s ease",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Clickable header ──────────────────────────────────────────── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <SupervisorAvatar districtNumber={districtConfig.number} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + Chinese name */}
          <div style={{
            fontFamily: FONTS.display, fontSize: 20, fontWeight: 700,
            color: "#1a1a2e", lineHeight: 1.2,
          }}>
            {profile.name}
            {profile.altName && (
              <span style={{ fontSize: 16, color: "#666", marginLeft: 8, fontWeight: 400 }}>
                {profile.altName}
              </span>
            )}
          </div>
          {/* District + Supervisor */}
          <div style={{
            fontFamily: FONTS.body, fontSize: 14,
            color: "#999", marginTop: 3,
          }}>
            {districtConfig.label} Supervisor
          </div>
          {/* Term dates */}
          <div style={{
            fontFamily: FONTS.body, fontSize: 13,
            color: "#999", marginTop: 1,
          }}>
            {profile.termStart} – {profile.termEnd}
          </div>
          {/* Divider + top committee */}
          <div style={{
            borderTop: "1px solid #e5e5e5",
            marginTop: 10, paddingTop: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {topCommittee.role !== "Member" && (
                <span style={{
                  fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
                  color: COLORS.orange,
                  background: COLORS.orangePale,
                  borderRadius: 4, padding: "2px 6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}>
                  {topCommittee.role}
                </span>
              )}
              <span style={{
                fontFamily: FONTS.body, fontSize: 13,
                color: "#555",
              }}>
                {topCommittee.name}
              </span>
            </div>
            {remainingCount > 0 && (
              <div style={{
                fontFamily: FONTS.body, fontSize: 12,
                color: "#999", marginTop: 3,
              }}>
                + {remainingCount} more committee assignment{remainingCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
        {/* Chevron */}
        <svg
          width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        >
          <path d="M5 8L10 13L15 8" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Expandable content ────────────────────────────────────────── */}
      <div style={{
        maxHeight: expanded ? contentHeight || 2000 : 0,
        opacity: expanded ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 300ms ease, opacity 150ms ease",
      }}>
        <div ref={contentRef} style={{
          borderTop: "1px solid #e5e7eb",
          padding: "24px 20px 28px",
        }}>
          {/* All committees (expanded only) */}
          <SectionHeading text="Committee Assignments" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
            {profile.committees.map(c => (
              <span key={c.name} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontFamily: FONTS.body, fontSize: 12,
                color: "#333",
                background: "#f5f5f5",
                borderRadius: 6, padding: "4px 10px",
              }}>
                {c.role !== "Member" && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: COLORS.orange,
                    textTransform: "uppercase",
                  }}>
                    {c.role}
                  </span>
                )}
                {c.name}
              </span>
            ))}
          </div>

          {/* About */}
          <SectionHeading text="About" />
          <div style={{ marginBottom: 24 }}>
            {profile.background && <LabeledRow label="Background" value={profile.background} />}
            {profile.education && <LabeledRow label="Education" value={profile.education} />}
            {profile.residency && <LabeledRow label="Residency" value={profile.residency} />}
            {profile.priorRole && <LabeledRow label="Prior Role" value={profile.priorRole} />}
          </div>

          {/* Stated Priorities */}
          <SectionHeading text="Stated Priorities" />
          {profile.statedPriorities.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 10,
              marginBottom: 24,
            }}>
              {profile.statedPriorities.map(p => {
                const IconFn = ICON_MAP[p.icon];
                return (
                  <div key={p.topic} style={{
                    background: COLORS.white,
                    border: "1px solid #eee",
                    borderLeft: `3px solid ${COLORS.orange}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      {IconFn && <IconFn />}
                      <span style={{
                        fontFamily: FONTS.display, fontSize: 14, fontWeight: 700,
                        color: "#333",
                      }}>
                        {p.topic}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: FONTS.body, fontSize: 13.5,
                      color: "#333", lineHeight: 1.6,
                      margin: "0 0 6px",
                    }}>
                      {p.position}
                    </p>
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: FONTS.body, fontSize: 12,
                        color: "#999", textDecoration: "none",
                        fontStyle: "italic",
                      }}
                    >
                      Source: {p.source}
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              fontFamily: FONTS.body, fontSize: 14,
              color: "#999", fontStyle: "italic",
              marginBottom: 24,
            }}>
              Policy priorities coming soon.
            </div>
          )}

          {/* Community Record */}
          {profile.communityRecord.length > 0 && (
            <>
              <SectionHeading text="Community Record" />
              <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none" }}>
                {profile.communityRecord.map((item, i) => (
                  <li key={i} style={{
                    fontFamily: FONTS.body, fontSize: 15,
                    color: "#333", lineHeight: 1.6,
                    paddingLeft: 18, position: "relative",
                    marginBottom: 5,
                  }}>
                    <span style={{
                      position: "absolute", left: 0, top: 10,
                      width: 6, height: 6, borderRadius: "50%",
                      background: COLORS.orange,
                    }} />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Contact */}
          <SectionHeading text="Contact" />
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 16,
            fontFamily: FONTS.body, fontSize: 13,
            color: "#333", marginBottom: 12,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <IconMapPin /> {profile.contact.office}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <IconPhone /> {profile.contact.phone}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <IconMail />
              <a href={`mailto:${profile.contact.email}`} style={{ color: COLORS.orange, textDecoration: "none" }}>
                {profile.contact.email}
              </a>
            </span>
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
                  borderRadius: 6, padding: "4px 10px",
                }}
              >
                {s.label} ↗
              </a>
            ))}
          </div>

          {/* District Data Cross-Reference */}
          {aggregatedData && (
            <CrossReference
              profile={profile}
              aggregatedData={aggregatedData}
              districtConfig={districtConfig}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function SectionHeading({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: FONTS.display, fontSize: 13, fontWeight: 700,
      color: "#E8652D", textTransform: "uppercase",
      letterSpacing: "1px", marginBottom: 12,
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
        color: "#999", textTransform: "uppercase",
        letterSpacing: "0.04em", marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONTS.body, fontSize: 15,
        color: "#333", lineHeight: 1.6,
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
    <>
      <SectionHeading text="District Data Cross-Reference" />
      <div style={{
        background: COLORS.orangePale,
        borderRadius: 10,
        padding: "16px 18px",
      }}>
        <div style={{
          fontFamily: FONTS.body, fontSize: 15,
          color: "#333", lineHeight: 1.6,
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
    </>
  );
}
