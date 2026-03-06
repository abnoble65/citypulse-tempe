/**
 * seedCBDProfiles.ts — Seed cbd_profiles from DataSF CBD boundaries
 *
 * Fetches CBD boundary polygons from DataSF (c28a-f6gs), computes centroids,
 * and upserts rows into the cbd_profiles Supabase table.
 *
 * Usage:
 *   npx tsx scripts/seedCBDProfiles.ts
 *
 * Required environment variables (in .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env manually ─────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function shortName(name: string): string {
  const map: Record<string, string> = {
    'Downtown':                    'Downtown SF',
    'Yerba Buena':                 'Yerba Buena',
    'Union Square':                'Union Square',
    'Noe Valley':                  'Noe Valley',
    'Castro':                      'Castro',
    'Civic Center':                'Civic Center',
    'Tenderloin':                  'Tenderloin',
    'Fisherman\'s Wharf':          'Fisherman\'s Wharf',
    'Mid Market':                  'Mid Market',
    'Ocean Avenue':                'Ocean Ave',
    'SoMa West':                   'SoMa West',
    'Excelsior':                   'Excelsior',
    'Lower Polk':                  'Lower Polk',
    'Dogpatch':                    'Dogpatch',
    'Central Market':              'Central Market',
    'Japantown':                   'Japantown',
    'East Cut':                    'East Cut',
    'Discover Polk':               'Discover Polk',
    'Bayview':                     'Bayview',
  };
  return map[name] ?? name;
}

interface CBDRow {
  community_benefit_district: string;
  multipolygon?: { type: string; coordinates: number[][][][] };
  revenue?: number;
  sup_districts?: string;
}

function computeCentroid(coords: number[][][][]): { lat: number; lng: number } {
  let sumLat = 0, sumLng = 0, count = 0;
  for (const polygon of coords) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        sumLat += lat;
        sumLng += lng;
        count++;
      }
    }
  }
  return count > 0
    ? { lat: sumLat / count, lng: sumLng / count }
    : { lat: 37.78, lng: -122.41 };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching CBD boundaries from DataSF...');

  const url = 'https://data.sfgov.org/resource/c28a-f6gs.json?$limit=50';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DataSF fetch failed: ${res.status}`);
  const rows: CBDRow[] = await res.json();

  const valid = rows.filter(r => r.multipolygon?.coordinates && r.community_benefit_district);
  console.log(`Found ${valid.length} CBDs with boundaries`);

  for (const row of valid) {
    const name = row.community_benefit_district;
    const slug = slugify(name);
    const centroid = computeCentroid(row.multipolygon!.coordinates);
    const supDist = row.sup_districts
      ? parseInt(row.sup_districts.split(',')[0].trim(), 10) || null
      : null;

    const isDowntown = slug === 'downtown';

    const profile: Record<string, unknown> = {
      slug,
      name,
      short_name: shortName(name),
      boundary_geojson: row.multipolygon,
      center_lat: Math.round(centroid.lat * 1e6) / 1e6,
      center_lng: Math.round(centroid.lng * 1e6) / 1e6,
      supervisor_district: supDist,
      is_active: isDowntown,
    };

    // Populate full Downtown entry
    if (isDowntown) {
      profile.executive_director = 'Robbie Silver';
      profile.contact_email = 'info@downtownsf.org';
      profile.contact_phone = '415-634-2251';
      profile.website_url = 'https://downtownsf.org';
      profile.accent_color = '#1A5276';
      profile.description = 'The Downtown SF Partnership leads the way in building a thriving downtown through clean and safe operations, economic development, placemaking, and marketing.';
      profile.services = JSON.stringify(['cleaning', 'safety', 'marketing', 'placemaking', 'economic_development']);
      profile.supervisor_district = 3;
    }

    const { error } = await supabase
      .from('cbd_profiles')
      .upsert(profile, { onConflict: 'slug' });

    if (error) {
      console.error(`  FAILED: ${name} (${slug}):`, error.message);
    } else {
      console.log(`  ${isDowntown ? '★' : '○'} ${name} → ${slug} (${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)})${isDowntown ? ' [ACTIVE]' : ''}`);
    }
  }

  console.log('\nDone. Run setupCBDProfiles.sql first if tables do not exist.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
