/**
 * Dry-run: compare sfplanning.org archive against Supabase hearings table.
 * Reports which dates have PDFs but are missing from the DB.
 *
 * Usage: npx tsx scripts/dryRunMinutes.ts [startYear] [endYear]
 *   e.g. npx tsx scripts/dryRunMinutes.ts 2025 2026
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY!;
const ARCHIVE_INDEX = 'https://sfplanning.org/cpc-hearing-archives';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const startYear = parseInt(process.argv[2] ?? '2025');
const endYear   = parseInt(process.argv[3] ?? '2026');

function parseDateFromUrl(url: string): string | null {
  const m = url.match(/\/(\d{4})(\d{2})(\d{2})_(?:cpc|cal)_min\.pdf/i);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

async function main() {
  // 1. Fetch archive index
  console.log(`Fetching ${ARCHIVE_INDEX} …`);
  const res = await fetch(ARCHIVE_INDEX);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // 2. Extract all PDF links
  const linkRegex = /href=["'](https?:\/\/citypln-m-extnl\.sfgov\.org[^"']*?(?:cpc|cal)_min\.pdf)["']/gi;
  const seen = new Set<string>();
  const available: { dateStr: string; url: string }[] = [];

  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const dateStr = parseDateFromUrl(url);
    if (!dateStr) continue;
    const year = parseInt(dateStr.slice(0, 4));
    if (year < startYear || year > endYear) continue;
    available.push({ dateStr, url });
  }
  available.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  console.log(`\nFound ${available.length} PDFs on sfplanning.org for ${startYear}–${endYear}:`);
  for (const { dateStr } of available) console.log(`  ${dateStr}`);

  // 3. Fetch existing hearings from Supabase in range
  const { data: rows, error } = await supabase
    .from('hearings')
    .select('hearing_date')
    .gte('hearing_date', `${startYear}-01-01`)
    .lte('hearing_date', `${endYear}-12-31`)
    .order('hearing_date', { ascending: false });

  if (error) throw new Error(`Supabase error: ${error.message}`);

  const inDb = new Set((rows ?? []).map(r => r.hearing_date as string));
  console.log(`\nIn Supabase for ${startYear}–${endYear}: ${inDb.size} hearings`);
  for (const d of [...inDb].sort().reverse()) console.log(`  ${d}`);

  // 4. Find gaps
  const missing = available.filter(({ dateStr }) => !inDb.has(dateStr));
  console.log(`\n*** MISSING (${missing.length} dates with PDFs not yet in DB) ***`);
  for (const { dateStr, url } of missing) console.log(`  ${dateStr}  ${url}`);

  // 5. Also flag anything in DB but NOT on the site (orphans)
  const onSite = new Set(available.map(a => a.dateStr));
  const orphans = [...inDb].filter(d => !onSite.has(d));
  if (orphans.length) {
    console.log(`\nIn DB but no PDF on site (${orphans.length}):`);
    for (const d of orphans) console.log(`  ${d}`);
  }

  // 6. Overall DB counts
  const { count: totalHearings } = await supabase.from('hearings').select('*', { count: 'exact', head: true });
  const { count: totalProjects } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  console.log(`\nCurrent DB totals — hearings: ${totalHearings}, projects: ${totalProjects}`);
}

main().catch(err => { console.error(err); process.exit(1); });
