/**
 * cbdFetch.ts — Server-side spatial filtering for CBD data.
 *
 * Calculates the CBD bounding box from its GeoJSON boundary and passes
 * lat/lng bounds directly to the DataSF API query. No client-side
 * point-in-polygon filtering needed.
 */

import type { CBDConfig } from "../contexts/CBDContext";

// DataSF/Socrata API calls stubbed for Tempe fork — returns empty arrays.

// ── Types ───────────────────────────────────────────────────────────────────

export interface CBDPermitRow {
  lat: number;
  lng: number;
  permitNumber: string;
  type: string;
  description: string;
  status: string;
  cost: number;
  revisedCost: number;
  address: string;
  filedDate: string;
  issuedDate: string;
  completedDate: string;
  neighborhood: string;
  existingUse: string;
  proposedUse: string;
  month: string;
  block: string;
  lot: string;
}

export interface CBDBusinessRow {
  name: string;
  dba: string;
  address: string;
  zip: string;
  startDate: string;
  endDate: string | null;
  month: string;
}

export interface CBD311Row {
  lat: number;
  lng: number;
  serviceRequestId: string;
  category: string;
  address: string;
  neighborhood?: string;
  date: string;
  updatedDate: string;
  closedDate: string | null;
  month: string;
  status?: string;
  subtype?: string;
  serviceDetails?: string;
  agencyResponsible?: string;
}

// ── Fetch functions (stubbed for Tempe fork — DataSF removed) ───────────────

export async function fetch311ForCBD(
  config: CBDConfig,
  opts: { days?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<CBD311Row[]> {
  return [];
}

export async function fetchPermitsForCBD(
  config: CBDConfig,
  opts: { days?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<CBDPermitRow[]> {
  return [];
}

export async function fetchBusinessesForCBD(
  config: CBDConfig,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<CBDBusinessRow[]> {
  return [];
}
