/**
 * districts.ts — CityPulse
 *
 * Single source of truth for SF supervisor district configuration.
 * District 3 keeps the hand-crafted icons and NeighborhoodHero gradients.
 * All other districts use the generic DistrictIcon and a default gradient
 * until custom artwork is added.
 */

import type { FC } from "react";
import {
  CoitTowerIcon,
  TransamericaIcon,
  ChinatownGateIcon,
  CableCarIcon,
  DistrictIcon,
} from "./components/Icons";

interface IconProps { size?: number; color?: string; }

export interface DistrictNeighborhood {
  name: string;
  zip: string;
  Icon: FC<IconProps>;
  /** Gradient used in NeighborhoodHero when this neighborhood is selected. */
  gradient: string;
  /** Short subtitle shown below neighborhood name in NeighborhoodHero. */
  subtitle: string;
  /**
   * Exact neighborhood name in the DataSF boundary GeoJSON (jwn9-ihcz).
   * Used for polygon-based project filtering. null = no polygon match available
   * (fall back to zip/text matching).
   */
  geoName: string | null;
}

export interface DistrictConfig {
  number: string;
  label: string;       // "District 3"
  fullName: string;    // "District 3 — North Beach, Chinatown, Financial"
  allLabel: string;    // "All District 3"
  neighborhoods: DistrictNeighborhood[];
  /** Lowercase substrings matched against DevelopmentProject.nhood41. */
  pipelineNeighborhoods: string[];
}

// ── Shared fallback gradient for districts without custom theming ─────────────
const DEFAULT_GRADIENT = "linear-gradient(135deg, #2A3A4A 0%, #3A5A7A 55%, #7A6A5A 100%)";

export const DISTRICTS: Record<string, DistrictConfig> = {
  "1": {
    number: "1",
    label: "District 1",
    fullName: "District 1 — Richmond",
    allLabel: "All District 1",
    neighborhoods: [
      { name: "Inner Richmond", zip: "94118", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Clement Street · 94118",      geoName: "Inner Richmond" },
      { name: "Outer Richmond", zip: "94121", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Balboa Street · 94121",        geoName: "Outer Richmond" },
      { name: "Seacliff",       zip: "94121", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "El Camino del Mar · 94121",    geoName: "Seacliff" },
    ],
    pipelineNeighborhoods: [
      "inner richmond", "outer richmond", "richmond district", "seacliff",
      "lone mountain", "anza vista",
    ],
  },

  "2": {
    number: "2",
    label: "District 2",
    fullName: "District 2 — Marina, Pacific Heights",
    allLabel: "All District 2",
    neighborhoods: [
      { name: "Marina",           zip: "94123", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Chestnut Street · 94123",       geoName: "Marina" },
      { name: "Cow Hollow",       zip: "94123", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Union Street · 94123",           geoName: "Cow Hollow" },
      { name: "Pacific Heights",  zip: "94115", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Fillmore Street · 94115",        geoName: "Pacific Heights" },
      { name: "Presidio Heights", zip: "94115", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Sacramento Street · 94115",      geoName: "Presidio Heights" },
    ],
    pipelineNeighborhoods: [
      "marina", "pacific heights", "cow hollow", "presidio heights", "laurel heights",
    ],
  },

  "3": {
    number: "3",
    label: "District 3",
    fullName: "District 3 — North Beach, Chinatown, Financial",
    allLabel: "All District 3",
    neighborhoods: [
      {
        name: "North Beach", zip: "94133", Icon: CoitTowerIcon,
        gradient: "linear-gradient(135deg, #2C4A3E 0%, #4A6A58 55%, #8A6A2A 100%)",
        subtitle: "Telegraph Hill · 94133",
        geoName: "North Beach",
      },
      {
        name: "Financial District", zip: "94111", Icon: TransamericaIcon,
        gradient: "linear-gradient(135deg, #141E38 0%, #243860 55%, #8A5E20 100%)",
        subtitle: "Jackson Square · 94111",
        geoName: "Financial District",
      },
      {
        name: "Chinatown", zip: "94108", Icon: ChinatownGateIcon,
        gradient: "linear-gradient(135deg, #5A1410 0%, #943820 55%, #B87820 100%)",
        subtitle: "Nob Hill · 94108",
        geoName: "Chinatown",
      },
      {
        name: "Russian Hill", zip: "94109", Icon: CableCarIcon,
        gradient: "linear-gradient(135deg, #263848 0%, #4A6A88 55%, #9A7040 100%)",
        subtitle: "Hyde Street · 94109",
        geoName: "Russian Hill",
      },
    ],
    pipelineNeighborhoods: [
      "north beach", "chinatown", "financial district",
      "nob hill", "telegraph hill", "russian hill",
    ],
  },

  "4": {
    number: "4",
    label: "District 4",
    fullName: "District 4 — Sunset, Parkside",
    allLabel: "All District 4",
    neighborhoods: [
      { name: "Inner Sunset",   zip: "94122", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Irving Street · 94122",          geoName: "Inner Sunset" },
      { name: "Central Sunset", zip: "94122", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Noriega Street · 94122",         geoName: null },
      { name: "Outer Sunset",   zip: "94116", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Judah Street · 94116",           geoName: "Outer Sunset" },
      { name: "Parkside",       zip: "94116", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Taraval Street · 94116",         geoName: "Parkside" },
    ],
    pipelineNeighborhoods: [
      "sunset", "inner sunset", "outer sunset", "central sunset", "parkside",
    ],
  },

  "5": {
    number: "5",
    label: "District 5",
    fullName: "District 5 — Haight, Western Addition, NoPa",
    allLabel: "All District 5",
    neighborhoods: [
      { name: "Haight-Ashbury",   zip: "94117", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Haight Street · 94117",        geoName: "Haight Ashbury" },
      { name: "NoPa",             zip: "94117", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Divisadero Street · 94117",     geoName: "Panhandle" },
      { name: "Lower Haight",     zip: "94117", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Haight Street · 94117",         geoName: "Lower Haight" },
      { name: "Western Addition", zip: "94115", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Fillmore Street · 94115",       geoName: "Western Addition" },
      { name: "Alamo Square",     zip: "94115", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Steiner Street · 94115",        geoName: "Alamo Square" },
    ],
    pipelineNeighborhoods: [
      "haight", "haight ashbury", "western addition", "nopa",
      "alamo square", "lower haight", "panhandle",
    ],
  },

  "6": {
    number: "6",
    label: "District 6",
    fullName: "District 6 — SoMa, Tenderloin",
    allLabel: "All District 6",
    neighborhoods: [
      { name: "SoMa",         zip: "94103", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Folsom Street · 94103",            geoName: "South of Market" },
      { name: "Tenderloin",   zip: "94102", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Turk Street · 94102",              geoName: "Tenderloin" },
      { name: "Hayes Valley", zip: "94103", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Hayes Street · 94103",             geoName: "Hayes Valley" },
      { name: "Rincon Hill",  zip: "94105", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Beale Street · 94105",             geoName: "Rincon Hill" },
      { name: "Mission Bay",  zip: "94158", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Mission Bay · 94158",              geoName: "Mission Bay" },
    ],
    pipelineNeighborhoods: [
      "south of market", "soma", "tenderloin", "hayes valley",
      "mission bay", "rincon hill", "mid-market", "civic center", "yerba buena",
    ],
  },

  "7": {
    number: "7",
    label: "District 7",
    fullName: "District 7 — West Portal, Glen Park",
    allLabel: "All District 7",
    neighborhoods: [
      { name: "West Portal",     zip: "94127", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "West Portal Ave · 94127",       geoName: "West Portal" },
      { name: "Forest Hill",     zip: "94127", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Dewey Blvd · 94127",            geoName: "Forest Hill" },
      { name: "Diamond Heights", zip: "94131", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Diamond Heights Blvd · 94131",  geoName: "Diamond Heights" },
      { name: "Glen Park",       zip: "94131", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Diamond Street · 94131",        geoName: "Glen Park" },
    ],
    pipelineNeighborhoods: [
      "west portal", "forest hill", "diamond heights", "glen park",
      "miraloma park", "sunnyside", "st francis wood", "monterey heights",
    ],
  },

  "8": {
    number: "8",
    label: "District 8",
    fullName: "District 8 — Castro, Noe Valley",
    allLabel: "All District 8",
    neighborhoods: [
      { name: "Castro",          zip: "94114", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Castro Street · 94114",         geoName: "Castro" },
      { name: "Noe Valley",      zip: "94114", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "24th Street · 94114",           geoName: "Noe Valley" },
      { name: "Eureka Valley",   zip: "94114", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Market Street · 94114",         geoName: "Eureka Valley" },
      { name: "Duboce Triangle", zip: "94103", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Sanchez Street · 94103",        geoName: "Duboce Triangle" },
    ],
    pipelineNeighborhoods: [
      "castro", "castro/upper market", "noe valley", "eureka valley",
      "duboce triangle", "dolores heights",
    ],
  },

  "9": {
    number: "9",
    label: "District 9",
    fullName: "District 9 — Mission, Bernal Heights",
    allLabel: "All District 9",
    neighborhoods: [
      { name: "Mission District", zip: "94110", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Valencia Street · 94110",      geoName: "Mission" },
      { name: "Bernal Heights",   zip: "94110", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Cortland Ave · 94110",          geoName: "Bernal Heights" },
      { name: "Portola",          zip: "94134", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "San Bruno Ave · 94134",         geoName: "Portola" },
    ],
    pipelineNeighborhoods: [
      "mission", "mission district", "bernal heights", "portola", "outer mission",
    ],
  },

  "10": {
    number: "10",
    label: "District 10",
    fullName: "District 10 — Potrero Hill, Dogpatch, Bayview",
    allLabel: "All District 10",
    neighborhoods: [
      { name: "Potrero Hill",      zip: "94107", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "18th Street · 94107",          geoName: "Potrero Hill" },
      { name: "Dogpatch",          zip: "94107", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "3rd Street · 94107",            geoName: "Dogpatch" },
      { name: "Bayview",           zip: "94124", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "3rd Street · 94124",            geoName: "Bayview" },
      { name: "Hunters Point",     zip: "94124", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Innes Ave · 94124",             geoName: "Hunters Point" },
      { name: "Visitacion Valley", zip: "94134", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Leland Ave · 94134",            geoName: "Visitacion Valley" },
    ],
    pipelineNeighborhoods: [
      "potrero hill", "dogpatch", "bayview", "bayview hunters point",
      "hunters point", "visitacion valley", "silver terrace", "little hollywood",
    ],
  },

  "11": {
    number: "11",
    label: "District 11",
    fullName: "District 11 — Excelsior, Ingleside",
    allLabel: "All District 11",
    neighborhoods: [
      { name: "Excelsior",      zip: "94112", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Mission Street · 94112",         geoName: "Excelsior" },
      { name: "Ingleside",      zip: "94112", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Ocean Ave · 94112",              geoName: "Ingleside" },
      { name: "Outer Mission",  zip: "94112", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Excelsior Ave · 94112",          geoName: "Outer Mission" },
      { name: "Ocean View",     zip: "94112", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Junipero Serra Blvd · 94112",    geoName: "Oceanview" },
      { name: "Crocker Amazon", zip: "94112", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Moscow Street · 94112",          geoName: "Crocker Amazon" },
    ],
    pipelineNeighborhoods: [
      "excelsior", "ingleside", "outer mission", "ocean view",
      "crocker amazon", "mission terrace",
    ],
  },
};

export const DEFAULT_DISTRICT = DISTRICTS["3"];

/** Sentinel config representing all 11 SF supervisor districts combined. */
export const CITYWIDE_DISTRICT: DistrictConfig = {
  number: "0",
  label: "All Tempe",
  fullName: "All Tempe, AZ",
  allLabel: "All Tempe",
  neighborhoods: Object.values(DISTRICTS).map(d => ({
    name:    d.label,        // "District 1" … "District 11"
    zip:     d.number,       // "1" … "11" — used as district key in by_zip
    Icon:    DistrictIcon,
    gradient: DEFAULT_GRADIENT,
    subtitle: d.fullName,
    geoName: null,           // district-level, no neighborhood polygon
  })),
  pipelineNeighborhoods: [], // no filter — all neighborhoods included
};
