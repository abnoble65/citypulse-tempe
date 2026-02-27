/**
 * SupervisorAvatar — circular avatar for SF Board of Supervisors members.
 *
 * Shows a photo if one exists at /images/supervisors/{slug}.png,
 * otherwise renders an initials placeholder circle.
 *
 * To add a new supervisor photo: drop the image at
 *   public/images/supervisors/d{N}-{lastname}.png
 * and add a `slug` entry to SUPERVISOR_INFO below.
 */

import { COLORS, FONTS } from "../theme";

// ── Data ──────────────────────────────────────────────────────────────────────

const SUPERVISOR_INFO: Record<string, { name: string; slug?: string }> = {
  "1":  { name: "Connie Chan" },
  "2":  { name: "Stephen Sherrill" },
  "3":  { name: "Danny Sauter",     slug: "d3-sauter" },
  "4":  { name: "Alan Wong" },
  "5":  { name: "Bilal Mahmood" },
  "6":  { name: "Matt Dorsey" },
  "7":  { name: "Myrna Melgar" },
  "8":  { name: "Rafael Mandelman" },
  "9":  { name: "Jackie Fielder" },
  "10": { name: "Shamann Walton" },
  "11": { name: "Chyanne Chen" },
};

/** Return the supervisor's full name for a given district number, or null. */
export function getSupervisorName(districtNumber: string): string | null {
  return SUPERVISOR_INFO[districtNumber]?.name ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SupervisorAvatarProps {
  /** District number string: "1"–"11". Pass "0" or omit for no render. */
  districtNumber: string;
  /** Diameter in px. Default 40. */
  size?: number;
  /** Show "Sup. Name" label beside the avatar. Default false. */
  showName?: boolean;
  /** Override label color. Default COLORS.midGray. */
  nameColor?: string;
}

export function SupervisorAvatar({
  districtNumber,
  size = 40,
  showName = false,
  nameColor,
}: SupervisorAvatarProps) {
  const info = SUPERVISOR_INFO[districtNumber];
  if (!info) return null;

  const imgPath  = info.slug ? `/images/supervisors/${info.slug}.png` : null;
  const abbrev   = initials(info.name);
  const fontSize = Math.max(10, Math.round(size * 0.32));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {/* Circle */}
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: imgPath ? COLORS.cream : COLORS.orangePale,
        border: `1.5px solid ${COLORS.lightBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {imgPath ? (
          <img
            src={imgPath}
            alt={info.name}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />
        ) : (
          <span style={{
            fontFamily: FONTS.heading,
            fontSize, fontWeight: 800,
            color: COLORS.orange,
            lineHeight: 1, userSelect: "none",
          }}>
            {abbrev}
          </span>
        )}
      </div>

      {/* Optional name label */}
      {showName && (
        <span style={{
          fontFamily: FONTS.body,
          fontSize: Math.max(11, Math.round(size * 0.3)),
          fontWeight: 600,
          color: nameColor ?? COLORS.midGray,
          whiteSpace: "nowrap",
        }}>
          Sup. {info.name}
        </span>
      )}
    </div>
  );
}
