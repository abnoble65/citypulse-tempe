import { CoitTowerIcon, TransamericaIcon, ChinatownGateIcon, CableCarIcon, DistrictIcon } from "./components/Icons";

export interface Neighborhood {
  name: string;
  zip: string | null;
  Icon: React.FC<{ size?: number; color?: string }>;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  { name: "All District 3", zip: null, Icon: DistrictIcon },
  { name: "North Beach", zip: "94133", Icon: CoitTowerIcon },
  { name: "Financial District", zip: "94111", Icon: TransamericaIcon },
  { name: "Chinatown", zip: "94108", Icon: ChinatownGateIcon },
  { name: "Russian Hill", zip: "94109", Icon: CableCarIcon },
];

export const MOCK_PERMITS = [
  { address: "350 Bush St", value: 12.4, type: "Commercial", status: "Issued" },
  { address: "600 Stockton St", value: 8.7, type: "Residential", status: "Filed" },
  { address: "1 Grant Ave", value: 6.2, type: "Mixed Use", status: "Issued" },
  { address: "888 Kearny St", value: 5.8, type: "Commercial", status: "Complete" },
  { address: "1200 Columbus Ave", value: 4.9, type: "Residential", status: "Filed" },
  { address: "455 Broadway", value: 4.1, type: "Retail", status: "Issued" },
  { address: "200 Bay St", value: 3.6, type: "Mixed Use", status: "Filed" },
  { address: "770 Pacific Ave", value: 2.8, type: "Residential", status: "Complete" },
  { address: "333 Grant Ave", value: 2.3, type: "Retail", status: "Issued" },
  { address: "50 Francisco St", value: 1.9, type: "Residential", status: "Filed" },
];

export const MOCK_STATUS = [
  { name: "Issued", value: 312, pct: 38, color: "#D4643B" },
  { name: "Filed", value: 267, pct: 33, color: "#E8845E" },
  { name: "Complete", value: 156, pct: 19, color: "#5B9A5F" },
  { name: "Expired", value: 82, pct: 10, color: "#B0A89E" },
];

export const MOCK_VALUE_BY_TYPE = [
  { type: "Commercial", val: 22.4, color: "#D4643B" },
  { type: "Residential", val: 14.1, color: "#E8845E" },
  { type: "Mixed Use", val: 9.8, color: "#D4963B" },
  { type: "Retail", val: 5.9, color: "#5B9A5F" },
];

export const MOCK_HEARINGS = [
  {
    date: "Jan 16, 2025",
    address: "350 Bush St",
    action: "Approved" as const,
    votes: { aye: 5, nay: 1, absent: 1 },
    desc: "Office-to-residential conversion, 120 units with ground floor retail.",
    shadow: true,
  },
  {
    date: "Jan 9, 2025",
    address: "600 Stockton St",
    action: "Continued" as const,
    votes: { aye: 0, nay: 0, absent: 0 },
    desc: "Mixed-use development, 80 units. Continued for environmental review.",
    shadow: false,
  },
  {
    date: "Dec 19, 2024",
    address: "1 Grant Ave",
    action: "Approved" as const,
    votes: { aye: 6, nay: 0, absent: 1 },
    desc: "Former department store conversion to hotel and retail complex.",
    shadow: false,
  },
];
