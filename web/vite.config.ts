import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Dev-only middleware that mimics the Vercel /api/ai serverless function.
 * Forwards requests to the Anthropic Messages API using the local
 * ANTHROPIC_API_KEY env var, so `vite dev` works without `vercel dev`.
 */
function apiAiDevProxy(apiKey: string): Plugin {
  return {
    name: 'api-ai-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        if (!apiKey) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set — AI features unavailable in dev' }));
          return;
        }
        // Read request body
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const MODEL_ALLOWLIST = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'];
        if (!MODEL_ALLOWLIST.includes(body.model)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request.' }));
          return;
        }
        body.max_tokens = Math.min(body.max_tokens ?? 1024, 2048);

        try {
          const upstream = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
          });
          const result = await upstream.text();
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(result);
        } catch (e: any) {
          console.error('[api/ai dev]', e);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unable to generate briefing right now. Please try again.' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all vars from .env (empty prefix = no VITE_ restriction)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      apiAiDevProxy(env.ANTHROPIC_API_KEY ?? ''),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':    ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: ['tomeka-unleached-fluctuatingly.ngrok-free.dev'],
    },
  };
});
