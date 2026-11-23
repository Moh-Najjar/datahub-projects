import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The backend API origin (VITE_API_URL). Development proxies `/api` to it: the backend's CORS policy does not allow
  // the dev origin (http://localhost:3000) yet. Remove the proxy once it does (and point core/config/api.ts at it).
  const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL?.trim();
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      // Monorepo safety: always bundle a single React, whatever npm hoists to the root.
      dedupe: ['react', 'react-dom'],
    },
    server: {
      port: 3000,
      strictPort: true,
      proxy: apiUrl ? { '/api': { target: apiUrl, changeOrigin: true, secure: true } } : undefined,
    },
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        // The site, plus the hidden Workspace session check embedded by the HR Admin portal (no React, a few kB).
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          workspaceSession: fileURLToPath(new URL('./workspace-session.html', import.meta.url)),
        },
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
  };
});
