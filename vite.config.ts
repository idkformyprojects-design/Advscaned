import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
    // The Capacitor native project mirrors the web build — don't watch it.
    watch: { ignored: ['**/android/**', '**/ios/**', '**/dist/**'] },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2019', chunkSizeWarningLimit: 1200 },
});
