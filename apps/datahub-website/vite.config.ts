import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/](@mui|@emotion|stylis|stylis-plugin-rtl)[\\/]/.test(id)) return 'mui';
            if (id.includes('framer-motion') || id.includes('motion-')) return 'motion';
            if (/[\\/](react-hook-form|zod|@hookform)[\\/]/.test(id)) return 'forms';
          }
          return undefined;
        },
      },
    },
  },
});
