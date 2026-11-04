import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Stamps a unique build id into dist/sw.js so every deploy invalidates old caches. */
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'bazaar-stamp-sw',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const id = Date.now().toString(36);
      writeFileSync(file, readFileSync(file, 'utf8').replace(/__BUILD_ID__/g, id));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
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
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
