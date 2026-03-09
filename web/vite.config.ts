import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all vars from .env (empty prefix = no VITE_ restriction)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
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
