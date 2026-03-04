/**
 * enrichParcels.ts — Enrich projects with parcel data from DataSF.
 *
 * For each project with a parcel_apn, fetches block, lot, centroid,
 * and planning_district from the DataSF Parcels API (acdm-wktn).
 *
 * Prerequisites:
 *   - Run addParcelColumns.sql in Supabase SQL Editor first
 *   - .env must have VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY
 *
 * Usage:
 *   npx tsx scripts/enrichParcels.ts
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

const PARCEL_API = 'https://data.sfgov.org/resource/acdm-wktn.json';
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;
const REQ_DELAY_MS   = 200;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParcelRecord {
  blklot:              string;
  block_num:           string;
  lot_num:             string;
  centroid_latitude:   string;
  centroid_longitude:  string;
  planning_district?:  string;
}

interface ProjectRow {
  id:         string;
  parcel_apn: string;
}

// ── Parcel lookup ─────────────────────────────────────────────────────────────

async function fetchParcel(apn: string): Promise<ParcelRecord | null> {
  const params = new URLSearchParams({
    '$where':  `blklot='${apn}'`,
    '$select': 'blklot,block_num,lot_num,centroid_latitude,centroid_longitude,planning_district',
    '$limit':  '1',
  });
  try {
    const res = await fetch(`${PARCEL_API}?${params}`);
    if (!res.ok) return null;
    const rows = await res.json() as ParcelRecord[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('CityPulse — enrichParcels.ts');
  console.log('─'.repeat(55));

  // Fetch all projects with parcel_apn but no block yet
  const all: ProjectRow[] = [];
  let page = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, parcel_apn')
      .not('parcel_apn', 'is', null)
      .is('block', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) { console.error('Query error:', error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as ProjectRow[]));
    if (data.length < PAGE) break;
    page++;
  }

  console.log(`Found ${all.length} projects with parcel_apn but no block/lot.\n`);
  if (all.length === 0) { console.log('Nothing to enrich.'); return; }

  // Deduplicate APNs — many projects share the same parcel
  const apnToProjects = new Map<string, string[]>();
  for (const row of all) {
    const ids = apnToProjects.get(row.parcel_apn) ?? [];
    ids.push(row.id);
    apnToProjects.set(row.parcel_apn, ids);
  }

  const uniqueApns = [...apnToProjects.keys()];
  console.log(`Unique APNs to look up: ${uniqueApns.length}`);
  console.log(`Projects to update:     ${all.length}\n`);

  let enriched = 0;
  let withZoning = 0;
  let failed = 0;
  const failedApns: string[] = [];

  for (let i = 0; i < uniqueApns.length; i++) {
    const apn = uniqueApns[i];
    const parcel = await fetchParcel(apn);

    if (parcel) {
      const update = {
        block:               parcel.block_num,
        lot:                 parcel.lot_num,
        parcel_centroid_lat: parseFloat(parcel.centroid_latitude) || null,
        parcel_centroid_lng: parseFloat(parcel.centroid_longitude) || null,
        zoning:              parcel.planning_district || null,
      };

      const projectIds = apnToProjects.get(apn)!;
      const { error } = await supabase
        .from('projects')
        .update(update)
        .in('id', projectIds);

      if (!error) {
        enriched += projectIds.length;
        if (update.zoning) withZoning += projectIds.length;
      } else {
        console.warn(`  Update failed for APN ${apn}: ${error.message}`);
        failed += projectIds.length;
      }
    } else {
      failed += (apnToProjects.get(apn)?.length ?? 0);
      failedApns.push(apn);
    }

    // Progress log every batch
    if ((i + 1) % BATCH_SIZE === 0 || i === uniqueApns.length - 1) {
      console.log(`  ${i + 1}/${uniqueApns.length} APNs — enriched: ${enriched}, failed: ${failed}`);
    }

    // Rate limit: pause between requests, longer pause between batches
    if ((i + 1) % BATCH_SIZE === 0) {
      await sleep(BATCH_DELAY_MS);
    } else {
      await sleep(REQ_DELAY_MS);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log('\n── Parcel Enrichment Results ─────────────────────────');
  console.log(`Unique APNs queried:    ${uniqueApns.length}`);
  console.log(`Projects enriched:      ${enriched} / ${all.length} (${((enriched / all.length) * 100).toFixed(1)}%)`);
  console.log(`With zoning data:       ${withZoning} (${((withZoning / all.length) * 100).toFixed(1)}%)`);
  console.log(`Failed / not found:     ${failed}`);
  if (failedApns.length > 0 && failedApns.length <= 20) {
    console.log(`Failed APNs:            ${failedApns.join(', ')}`);
  } else if (failedApns.length > 20) {
    console.log(`Failed APNs (first 20): ${failedApns.slice(0, 20).join(', ')}`);
  }
  console.log('─────────────────────────────────────────────────────');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
