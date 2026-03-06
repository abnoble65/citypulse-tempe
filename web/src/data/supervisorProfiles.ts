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
  role: "Chair" | "Vice Chair" | "Member";
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
    altName: "\u8463\u5EF6\u658C",
    termStart: "January 2025",
    termEnd: "January 2029",
    background:
      "Danny Sauter is a neighborhood advocate, small business owner, and community organizer who has lived in District 3 for over a decade. He co-founded a neighborhood safety group and served on multiple community advisory boards before running for office.",
    education: "B.A. in Political Science, University of California, Berkeley",
    residency: "North Beach, San Francisco (10+ years)",
    priorRole: "Small business owner; Co-founder, North Beach Neighbors",
    committees: [
      { name: "Land Use and Transportation", role: "Member" },
      { name: "Government Audit and Oversight", role: "Member" },
      { name: "Budget and Appropriations", role: "Member" },
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
      "Co-founded North Beach Neighbors, a neighborhood safety and advocacy group",
      "Served on the Telegraph Hill Dwellers board of directors",
      "Member of the Chinatown Community Development Center advisory council",
      "Organized annual North Beach community clean-up events (2019\u20132024)",
      "Advocated for increased foot-patrol officers in the Central Police District",
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
