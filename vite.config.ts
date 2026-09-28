import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// GEMINI_API_KEY must NEVER be exposed to the client. Use server-side only (see server/).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prefer an explicit proxy target (e.g. production Render). Otherwise local OPS_API_PORT.
  const apiTarget =
    env.VITE_API_PROXY_TARGET?.trim() || `http://localhost:${env.OPS_API_PORT || '3001'}`;
  return {
    // Ops dashboards and P2P Login are off unless VITE_ENABLE_OPS=true. A literal
    // `false` lets the build drop the ops pages (and their demo accounts) entirely.
    define: { __OPS_ENABLED__: JSON.stringify(env.VITE_ENABLE_OPS === 'true') },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // When VITE_API_BASE_URL is empty, the client calls same-origin /api/* and Vite proxies here.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true, secure: true },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
