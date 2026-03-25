/**
 * parcelLookup.ts — Client-side parcel lookup via DataSF Parcels API (acdm-wktn).
 *
 * Two entry points:
 *   lookupByAPN(apn)         → ParcelInfo | null
 *   lookupByAddress(address) → ParcelInfo | null  (geocodes first, then intersects)
 *
 * Results are cached in sessionStorage for the page session.
 * Used by Map, Commission, and future CC3D deep-link.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParcelInfo {
  apn:   string;
  block: string;
  lot:   string;
  lat:   number;
  lng:   number;
  zoning: string | null;  // planning_district from DataSF
}

// DataSF parcel lookups stubbed for Tempe fork — returns null.

export async function lookupByAPN(apn: string): Promise<ParcelInfo | null> {
  return null;
}

export async function lookupByAddress(address: string): Promise<ParcelInfo | null> {
  return null;
}
