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
    // The lazy dashboard chunk includes the modular Apache ECharts core (~620 kB min / ~211 kB gzip) and loads
    // only with the dashboard. The limit sits just above it so any NEW oversized chunk still warns.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
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
  },
});
