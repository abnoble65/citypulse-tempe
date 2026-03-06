/**
 * supervisorProfiles.ts — CityPulse
 *
 * Factual civic-information profiles for SF Board of Supervisors members.
 * All data sourced from official city pages (sfbos.org) and supervisor sites.
 * Neutral tone, no editorializing. Every claim attributed to a source.
 */

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface CommitteeMembership {
  name: string;
  role: "Chair" | "Vice Chair" | "Vice-Chair" | "Member";
}

export interface StatedPriority {
  topic: string;
  position: string;
  source: string;
  sourceUrl: string;
  /** Icon key used by SupervisorProfileCard to pick an inline SVG. */
  icon: "shield" | "home" | "building" | "pill" | "trash" | "storefront";
}

export interface ContactInfo {
  office: string;
  phone: string;
  email: string;
}

export interface SourceLink {
  label: string;
  url: string;
}

export interface SupervisorProfile {
  districtNumber: string;
  name: string;
  /** Optional name in another language (e.g. Chinese characters). */
  altName?: string;
  termStart: string;
  termEnd: string;
  /** Short background paragraph. */
  background: string;
  education: string;
  residency: string;
  priorRole: string;
  committees: CommitteeMembership[];
  statedPriorities: StatedPriority[];
  communityRecord: string[];
  contact: ContactInfo;
  sources: SourceLink[];
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export const SUPERVISOR_PROFILES: Record<string, SupervisorProfile> = {
  "3": {
    districtNumber: "3",
    name: "Danny Sauter",
    altName: "李爾德",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    background:
      "Community organizer in District 3 for over a decade. Former Executive Director of SF Neighborhood Centers Together, supporting youth and seniors at Cameron House in Chinatown and TEL HI Neighborhood Center in North Beach. Co-founded Bamboo, a marketing agency, growing it from 2 to 50 employees.",
    education: "Miami University – Marketing major, dual minors in Entrepreneurship and Chinese. Studied abroad in China, learned Mandarin.",
    residency: "North Beach resident for over a decade. Renter – one of two renters on the Board of Supervisors.",
    priorRole: "Executive Director, SF Neighborhood Centers Together. President, North Beach Neighbors (8+ years). First Housing Chair, SF Sierra Club.",
    committees: [
      { name: "SF Downtown Revitalization & Economic Recovery Financing District", role: "Chair" },
      { name: "Government Audit & Oversight Committee", role: "Vice-Chair" },
      { name: "Budget & Finance Committee", role: "Member" },
      { name: "Budget & Appropriations Committee", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Public Safety",
        position:
          "Supports fully staffing SFPD and expanding community policing in North Beach, Chinatown, and the Financial District.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "shield",
      },
      {
        topic: "Housing",
        position:
          "Advocates for streamlining housing approvals and protecting existing rent-controlled units while encouraging new construction.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "home",
      },
      {
        topic: "Development Oversight",
        position:
          "Calls for transparent review of major developments and community input on projects affecting neighborhood character.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "building",
      },
      {
        topic: "Fentanyl Crisis",
        position:
          "Supports expanding treatment access, safe consumption sites debate, and aggressive enforcement against open-air drug dealing.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "pill",
      },
      {
        topic: "Clean Streets",
        position:
          "Pushes for increased DPW resources for street cleaning and graffiti removal in commercial corridors.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "trash",
      },
      {
        topic: "Small Business",
        position:
          "Champions reducing permitting fees and timelines for small businesses, especially in Chinatown and North Beach.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "storefront",
      },
    ],
    communityRecord: [
      "Executive Director, SF Neighborhood Centers Together – supporting youth and seniors at Cameron House and TEL HI",
      "President, North Beach Neighbors for 8+ years",
      "First Housing Chair, SF Sierra Club",
      "Co-founded Bamboo, a marketing agency (grew from 2 to 50 employees)",
      "North Beach resident and renter for over a decade",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7450",
      email: "Danny.Sauter@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-sauter" },
      { label: "Danny Sauter campaign site", url: "https://www.dannyd3.com" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },
};

// ── Accessor ─────────────────────────────────────────────────────────────────

export function getProfile(districtNumber: string): SupervisorProfile | null {
  return SUPERVISOR_PROFILES[districtNumber] ?? null;
}
