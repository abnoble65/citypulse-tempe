/**
 * geocodeProjects.ts — Batch-geocode all projects in Supabase that lack lat/lng.
 *
 * 1. Fetches all projects where lat IS NULL (up to 2 000 rows per page).
 * 2. Geocodes addresses via ArcGIS World Geocoding Service (no API key needed).
 * 3. Looks up each lat/lng against DataSF parcel data (acdm-wktn) to get the APN.
 * 4. Writes lat, lng, parcel_apn back to Supabase in batches of 50.
 *
 * Usage:
 *   npx tsx scripts/geocodeProjects.ts
 *
 * Pre-requisites:
 *   - Run scripts/addGeoColumns.sql in the Supabase Dashboard first.
 *   - .env must contain VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY.
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

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.VITE_SUPABASE_SERVICE_KEY!;
const DATASF_TOKEN  = process.env.VITE_DATASF_APP_TOKEN ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ARCGIS_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const PARCEL_URL =
  'https://data.sfgov.org/resource/acdm-wktn.json';

const BATCH_SIZE  = 50;
const BATCH_DELAY = 1_200; // ms between geocoding batches

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  address: string | null;
}

interface GeoResult {
  id: string;
  lat: number;
  lng: number;
  parcel_apn: string | null;
}

// ── ArcGIS geocoding ──────────────────────────────────────────────────────────

async function geocodeOne(address: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    SingleLine: `${address}, San Francisco, CA`,
    f:           'json',
    maxLocations: '1',
    outFields:    '',
  });
  try {
    const res  = await fetch(`${ARCGIS_URL}?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as {
      candidates: Array<{ score: number; location: { x: number; y: number } }>;
    };
    const c = json.candidates?.[0];
    if (!c || c.score < 70) return null;
    return { lat: c.location.y, lng: c.location.x };
  } catch {
    return null;
  }
}

// ── DataSF parcel lookup ──────────────────────────────────────────────────────

async function lookupParcelApn(lat: number, lng: number): Promise<string | null> {
  // Use intersects() to find the parcel whose polygon contains this exact point.
  // WKT format is POINT(lng lat) — x,y order.
  const wkt    = `POINT (${lng} ${lat})`;
  const params = new URLSearchParams({
    '$where':  `intersects(shape, '${wkt}')`,
    '$select': 'blklot',
    '$limit':  '1',
  });
  if (DATASF_TOKEN) params.set('$$app_token', DATASF_TOKEN);
  try {
    const res  = await fetch(`${PARCEL_URL}?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as Array<{ blklot: string }>;
    return json[0]?.blklot ?? null;
  } catch {
    return null;
  }
}

// ── Sleep helper ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Fetch ungeocoded projects from Supabase ───────────────────────────────────

async function fetchUngeocoded(): Promise<Project[]> {
  const all: Project[] = [];
  let page = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, address')
      .is('lat', null)
      .not('address', 'is', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) {
      console.error('[fetch] Supabase error:', error.message);
      // If "column projects.lat does not exist", the SQL migration hasn't been run yet.
      if (error.message.includes('lat')) {
        console.error('\n──────────────────────────────────────────────────────');
        console.error('ERROR: lat/lng columns do not exist yet.');
        console.error('Please run scripts/addGeoColumns.sql in the Supabase');
        console.error('Dashboard → SQL Editor first, then re-run this script.');
        console.error('  https://app.supabase.com/project/tgokablobqwaswilidyp/editor');
        console.error('──────────────────────────────────────────────────────\n');
        process.exit(1);
      }
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as Project[]));
    if (data.length < PAGE) break;
    page++;
  }

  return all;
}

// ── Write results to Supabase ─────────────────────────────────────────────────

async function writeResults(results: GeoResult[]): Promise<number> {
  let written = 0;
  for (const r of results) {
    const { error } = await supabase
      .from('projects')
      .update({ lat: r.lat, lng: r.lng, parcel_apn: r.parcel_apn })
      .eq('id', r.id);
    if (error) {
      console.warn(`  [write] ${r.id} failed: ${error.message}`);
    } else {
      written++;
    }
  }
  return written;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('CityPulse — geocodeProjects.ts');
  console.log('Fetching ungeocoded projects from Supabase…');

  const projects = await fetchUngeocoded();
  console.log(`Found ${projects.length} projects with address but no lat/lng.\n`);

  if (projects.length === 0) {
    console.log('Nothing to geocode. All done!');
    return;
  }

  let geocodedCount = 0;
  let apnCount      = 0;
  let failCount     = 0;
  const results: GeoResult[] = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch   = projects.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const total   = Math.ceil(projects.length / BATCH_SIZE);
    console.log(`Batch ${batchNo}/${total} — geocoding ${batch.length} addresses…`);

    // Geocode all addresses in this batch in parallel
    const geoPromises = batch.map(async (p) => {
      if (!p.address) return null;
      const geo = await geocodeOne(p.address);
      if (!geo) { failCount++; return null; }

      geocodedCount++;
      const apn = await lookupParcelApn(geo.lat, geo.lng);
      if (apn) apnCount++;

      return { id: p.id, lat: geo.lat, lng: geo.lng, parcel_apn: apn } as GeoResult;
    });

    const batchResults = (await Promise.all(geoPromises)).filter((r): r is GeoResult => r !== null);
    results.push(...batchResults);

    // Write this batch immediately (don't accumulate everything in memory)
    const written = await writeResults(batchResults);
    console.log(
      `  → Geocoded ${batchResults.length}/${batch.length} | APN matches: ${batchResults.filter(r => r.parcel_apn).length} | Written: ${written}`,
    );
    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, projects.length)}/${projects.length} total`);

    // Respect rate limits between batches (not needed for last batch)
    if (i + BATCH_SIZE < projects.length) {
      await sleep(BATCH_DELAY);
    }
  }

  console.log('\n── Final Results ──────────────────────────────────────');
  console.log(`Total projects found:  ${projects.length}`);
  console.log(`Successfully geocoded: ${geocodedCount} (${((geocodedCount / projects.length) * 100).toFixed(1)}%)`);
  console.log(`APN matches:           ${apnCount} (${((apnCount / projects.length) * 100).toFixed(1)}%)`);
  console.log(`Failed to geocode:     ${failCount}`);
  console.log('──────────────────────────────────────────────────────');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
