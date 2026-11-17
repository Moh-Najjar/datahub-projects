import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/ — the `test` block configures Vitest (same file, one source of truth).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Monorepo safety: always bundle a single React, whatever npm hoists to the root.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // The website uses 5173.
    port: 5174,
  },
  preview: {
    port: 4174,
  },
  build: {
    target: 'es2022',
    // The modular Apache ECharts core (~590 kB min / ~200 kB gzip) is a lazy chunk shared by the dashboard and
    // attendance pages (never preloaded by index.html). The limit sits just above it so any NEW oversized chunk warns.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React DOM's static-markup renderer is used only to print payslips: keep it in its own lazy chunk.
            if (/[\\/]react-dom[\\/](server|cjs[\\/]react-dom-server)/.test(id)) return undefined;
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/](@mui|@emotion|stylis|stylis-plugin-rtl)[\\/]/.test(id)) return 'mui';
            if (/[\\/](i18next|react-i18next)[\\/]/.test(id)) return 'i18n';
            if (id.includes('@tanstack')) return 'query';
            // Apache ECharts is deliberately NOT a manual chunk: as one, the bundler also moves shared runtime
            // helpers into it and every page would preload it. Left alone, it stays inside the lazy dashboard chunk.
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/matchMedia.ts', './src/test/setup.ts'],
    css: false,
    // jsdom renders of whole pages (lazy chunks, ECharts) can exceed 5 s while every file runs in parallel.
    // Individual waits keep their own short timeouts, so real failures still surface quickly.
    testTimeout: 15_000,
    // 39 files of whole-page jsdom renders: one worker per core starves the cold lazy-page loads on a busy machine
    // (first test of a file timing out). Half the cores keeps the suite fast and stable.
    maxWorkers: '50%',
  },
});
