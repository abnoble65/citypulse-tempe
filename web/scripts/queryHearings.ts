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
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_KEY!
);

// Inspect hearings table
const { data: hSample, error: hErr } = await supabase.from('hearings').select('*').limit(1);
if (hErr) console.error('hearings error:', hErr.message);
else console.log('hearings columns:  ', Object.keys(hSample?.[0] ?? {}).join(', '));

// Inspect projects table
const { data: pSample, error: pErr } = await supabase.from('projects').select('*').limit(1);
if (pErr) console.error('projects error:', pErr.message);
else console.log('projects columns:  ', Object.keys(pSample?.[0] ?? {}).join(', '));

// Inspect public_sentiment table
const { data: sSample, error: sErr } = await supabase.from('public_sentiment').select('*').limit(1);
if (sErr) console.error('public_sentiment error:', sErr.message);
else console.log('public_sentiment:  ', Object.keys(sSample?.[0] ?? {}).join(', '));

// Recent projects with hearing dates
const { data: rows, error } = await supabase
  .from('projects')
  .select('address, action, project_description, shadow_flag, hearing:hearing_id(hearing_date)')
  .order('hearing_id', { ascending: false })
  .limit(10);

if (error) { console.error('query error:', error.message); process.exit(1); }

console.log('\nRecent projects (newest hearing first):\n');
console.log('address'.padEnd(30), 'date'.padEnd(12), 'action'.padEnd(16), 'shadow?');
console.log('─'.repeat(70));
for (const r of rows ?? []) {
  const date = (r.hearing as any)?.hearing_date ?? '—';
  console.log(
    (r.address ?? '—').slice(0, 28).padEnd(30),
    date.padEnd(12),
    (r.action ?? '—').padEnd(16),
    r.shadow_flag ? '☀ shadow' : ''
  );
}
console.log(`\nTotal: ${rows?.length ?? 0}`);
