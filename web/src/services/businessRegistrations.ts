/**
 * services/businessRegistrations.ts — Spatial query for SF business registrations.
 *
 * Fetches active businesses from DataSF (g8m3-pdis) using Socrata's within_box
 * spatial filter, then clips to the exact CBD polygon via isPointInCBD().
 */

import type { CBDConfig } from '../contexts/CBDContext';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DowntownBusiness {
  id: string;
  name: string;
  address: string;
  category: string;
  openDate: string;
  closeDate: string | null;
  coordinates: { lat: number; lng: number } | null;
  status: 'active' | 'closed';
}

export interface MonthlyActivity {
  month: string;       // "Jan", "Feb", etc.
  monthKey: string;    // "2025-06" for sorting
  Openings: number;
  Closures: number;
}

// ── Fetch (stubbed for Tempe fork — DataSF removed) ─────────────────────────

export async function fetchBusinessRegistrations(
  _config?: CBDConfig,
  _opts?: { limit?: number; signal?: AbortSignal },
): Promise<DowntownBusiness[]> {
  return [];
}

// ── Trend ────────────────────────────────────────────────────────────────────

export function computeOpeningTrend(
  businesses: DowntownBusiness[],
): { days30: number; days60: number; days90: number } {
  const active = businesses.filter(b => b.status === 'active');
  const now = new Date();
  const cutoff = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };
  const c30 = cutoff(30);
  const c60 = cutoff(60);
  const c90 = cutoff(90);
  return {
    days30: active.filter(b => b.openDate >= c30).length,
    days60: active.filter(b => b.openDate >= c60).length,
    days90: active.filter(b => b.openDate >= c90).length,
  };
}

// ── Monthly activity (last 12 months) ────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeMonthlyActivity(businesses: DowntownBusiness[]): MonthlyActivity[] {
  const now = new Date();
  // Build 12-month bucket list
  const buckets: MonthlyActivity[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ month: SHORT_MONTHS[d.getMonth()], monthKey: key, Openings: 0, Closures: 0 });
  }
  const bucketMap = new Map(buckets.map(b => [b.monthKey, b]));

  for (const b of businesses) {
    if (b.openDate) {
      const key = b.openDate.slice(0, 7); // "YYYY-MM"
      const bucket = bucketMap.get(key);
      if (bucket) bucket.Openings++;
    }
    if (b.closeDate) {
      const key = b.closeDate.slice(0, 7);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.Closures++;
    }
  }

  return buckets;
}
