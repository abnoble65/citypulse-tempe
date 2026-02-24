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

const base = process.env.VITE_SUPABASE_URL!;
const key  = process.env.VITE_SUPABASE_SERVICE_KEY!;

// PostgREST exposes column metadata via the root openapi endpoint
const res = await fetch(`${base}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});
const spec = await res.json() as any;
const tbl = spec?.definitions?.public_sentiment;
if (tbl) {
  console.log('\npublic_sentiment properties:');
  for (const [name, def] of Object.entries(tbl.properties ?? {})) {
    console.log(' ', name, '-', (def as any).type ?? (def as any).format ?? '?');
  }
  console.log('\nrequired:', tbl.required?.join(', ') ?? 'none');
} else {
  console.log('Table not found in OpenAPI spec. Available tables:');
  console.log(Object.keys(spec?.definitions ?? {}).join(', '));
}
