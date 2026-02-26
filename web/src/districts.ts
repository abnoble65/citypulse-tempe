/**
 * districts.ts — CityPulse
 *
 * Single source of truth for SF supervisor district configuration.
 * District 3 keeps the hand-crafted icons and NeighborhoodHero gradients.
 * Districts 1-2 and 4-6 use the generic DistrictIcon and a default gradient
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
      { name: "Inner Richmond", zip: "94118", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Clement Street · 94118" },
      { name: "Outer Richmond", zip: "94121", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Balboa Street · 94121" },
    ],
    pipelineNeighborhoods: ["inner richmond", "outer richmond", "richmond district", "lone mountain", "anza vista"],
  },

  "2": {
    number: "2",
    label: "District 2",
    fullName: "District 2 — Marina, Pacific Heights",
    allLabel: "All District 2",
    neighborhoods: [
      { name: "Marina",          zip: "94123", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Chestnut Street · 94123" },
      { name: "Pacific Heights", zip: "94115", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Fillmore Street · 94115" },
      { name: "Cow Hollow",      zip: "94123", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Union Street · 94123" },
    ],
    pipelineNeighborhoods: ["marina", "pacific heights", "cow hollow", "presidio heights", "laurel heights"],
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
      },
      {
        name: "Financial District", zip: "94111", Icon: TransamericaIcon,
        gradient: "linear-gradient(135deg, #141E38 0%, #243860 55%, #8A5E20 100%)",
        subtitle: "Jackson Square · 94111",
      },
      {
        name: "Chinatown", zip: "94108", Icon: ChinatownGateIcon,
        gradient: "linear-gradient(135deg, #5A1410 0%, #943820 55%, #B87820 100%)",
        subtitle: "Nob Hill · 94108",
      },
      {
        name: "Russian Hill", zip: "94109", Icon: CableCarIcon,
        gradient: "linear-gradient(135deg, #263848 0%, #4A6A88 55%, #9A7040 100%)",
        subtitle: "Hyde Street · 94109",
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
    fullName: "District 4 — Sunset, West Portal",
    allLabel: "All District 4",
    neighborhoods: [
      { name: "Inner Sunset", zip: "94122", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Irving Street · 94122" },
      { name: "Outer Sunset", zip: "94116", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Noriega Street · 94116" },
      { name: "West Portal",  zip: "94127", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "West Portal Ave · 94127" },
    ],
    pipelineNeighborhoods: ["sunset", "inner sunset", "outer sunset", "west portal", "forest hill", "st francis wood"],
  },

  "5": {
    number: "5",
    label: "District 5",
    fullName: "District 5 — Haight, Western Addition, NoPa",
    allLabel: "All District 5",
    neighborhoods: [
      { name: "Haight-Ashbury",  zip: "94117", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Haight Street · 94117" },
      { name: "Western Addition", zip: "94115", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Fillmore Street · 94115" },
      { name: "NoPa",             zip: "94117", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Divisadero Street · 94117" },
    ],
    pipelineNeighborhoods: [
      "haight", "haight ashbury", "western addition", "nopa",
      "alamo square", "hayes valley", "lower haight", "panhandle",
    ],
  },

  "6": {
    number: "6",
    label: "District 6",
    fullName: "District 6 — SoMa, Tenderloin",
    allLabel: "All District 6",
    neighborhoods: [
      { name: "SoMa",        zip: "94103", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Folsom Street · 94103" },
      { name: "Tenderloin",  zip: "94102", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Turk Street · 94102" },
      { name: "Mission Bay", zip: "94158", Icon: DistrictIcon, gradient: DEFAULT_GRADIENT, subtitle: "Mission Bay · 94158" },
    ],
    pipelineNeighborhoods: [
      "south of market", "soma", "tenderloin", "hayes valley",
      "mission bay", "rincon hill", "mid-market", "civic center", "yerba buena",
    ],
  },
};

export const DEFAULT_DISTRICT = DISTRICTS["3"];
