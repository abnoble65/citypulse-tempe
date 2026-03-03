import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all vars from .env (empty prefix = no VITE_ restriction)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      // Copy @arcgis/core assets into dist so the SDK can load workers/fonts/images.
      viteStaticCopy({
        targets: [{
          src: 'node_modules/@arcgis/core/assets',
          dest: 'arcgis',
        }],
      }),
    ],
    optimizeDeps: {
      // @arcgis/core uses dynamic imports internally — exclude from pre-bundling
      // to avoid CommonJS interop issues.
      exclude: ['@arcgis/core'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':    ['react', 'react-dom'],
            'vendor-anthropic': ['@anthropic-ai/sdk'],
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
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const apiKey =
                env.ANTHROPIC_API_KEY ??
                env.EXPO_PUBLIC_ANTHROPIC_API_KEY ??
                '';
              proxyReq.setHeader('x-api-key', apiKey);
              proxyReq.setHeader('anthropic-version', '2023-06-01');
            });
          },
        },
      },
    },
  };
});
