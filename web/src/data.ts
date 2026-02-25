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
