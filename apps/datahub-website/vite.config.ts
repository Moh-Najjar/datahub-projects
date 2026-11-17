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
    // Monorepo safety: always bundle a single React, whatever npm hoists to the root.
    dedupe: ['react', 'react-dom'],
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      // Module barrels (src/modules/*/index.ts) only re-export. Marking them side-effect free lets
      // the bundler resolve each import to the module that defines it, so a barrel never drags a
      // module's other files into the importing page's chunk.
      treeshake: {
        moduleSideEffects: (id) => !/[\\/]src[\\/]modules[\\/][^\\/]+[\\/]index\.ts$/.test(id),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // The admin's rich-text editor (TipTap, incl. `@tiptap/react`) stays in the admin editor's lazy chunk.
            if (/[\\/](@tiptap|prosemirror-[^\\/]+)[\\/]/.test(id)) return undefined;
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
