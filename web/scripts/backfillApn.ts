/**
 * backfillApn.ts — Add parcel_apn to all projects that have lat/lng but no APN.
 *
 * Runs APN lookups SEQUENTIALLY (200ms apart) to avoid DataSF rate limits.
 *
 * Usage:
 *   npx tsx scripts/backfillApn.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env ─────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY!;
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const PARCEL_URL   = 'https://data.sfgov.org/resource/acdm-wktn.json';
const APN_DELAY_MS = 200; // sequential requests — 5 req/s, well under DataSF limits

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function lookupApn(lat: number, lng: number): Promise<string | null> {
  const wkt    = `POINT (${lng} ${lat})`;
  const params = new URLSearchParams({
    '$where':  `intersects(shape, '${wkt}')`,
    '$select': 'blklot',
    '$limit':  '1',
  });
  try {
    const res  = await fetch(`${PARCEL_URL}?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as Array<{ blklot: string }>;
    return json[0]?.blklot ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('CityPulse — backfillApn.ts');

  // Fetch all rows with lat/lng but no APN
  const all: Array<{ id: string; lat: number; lng: number }> = [];
  let page = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, lat, lng')
      .not('lat', 'is', null)
      .is('parcel_apn', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) { console.error(error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as typeof all));
    if (data.length < PAGE) break;
    page++;
  }

  console.log(`Found ${all.length} rows with lat/lng but no APN.\n`);
  if (all.length === 0) { console.log('All done — nothing to backfill.'); return; }

  let matched = 0, failed = 0;

  for (let i = 0; i < all.length; i++) {
    const row = all[i];
    const apn = await lookupApn(row.lat, row.lng);
    if (apn) {
      const { error } = await supabase.from('projects').update({ parcel_apn: apn }).eq('id', row.id);
      if (!error) matched++;
    } else {
      failed++;
    }

    // Progress log every 50 rows
    if ((i + 1) % 50 === 0 || i === all.length - 1) {
      console.log(`  ${i + 1}/${all.length} — matched: ${matched}, no parcel: ${failed}`);
    }

    await sleep(APN_DELAY_MS);
  }

  console.log('\n── APN Backfill Results ──────────────────────────────');
  console.log(`Total processed: ${all.length}`);
  console.log(`APN matched:     ${matched} (${((matched / all.length) * 100).toFixed(1)}%)`);
  console.log(`No parcel found: ${failed}`);
  console.log('──────────────────────────────────────────────────────');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
