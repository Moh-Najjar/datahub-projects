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
    // The website uses 3000, the HR Admin Portal 3001.
    port: 3002,
    strictPort: true,
  },
  preview: {
    port: 4175,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React DOM's static-markup renderer is not needed here; keep the core vendor groups stable.
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/](@mui|@emotion|stylis|stylis-plugin-rtl)[\\/]/.test(id)) return 'mui';
            if (id.includes('@tanstack')) return 'query';
            if (/[\\/](react-hook-form|zod|@hookform)[\\/]/.test(id)) return 'forms';
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
    testTimeout: 15_000,
    maxWorkers: '50%',
  },
});
