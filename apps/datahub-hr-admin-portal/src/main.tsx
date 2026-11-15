import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts (bundled by Vite — no requests to external font services).
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
// Initialises i18next (synchronously) and sets <html lang dir> before the first render.
import './i18n';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
