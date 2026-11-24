/**
 * The DataHub Trainee App — a separate application (apps/datahub-trainee-app) on its own origin, opened from the
 * Workspace's "Trainee App" card through its `/sso` page (same handoff as the HR Admin portal, see modules/portals).
 *
 * The app's base URL comes from `VITE_TRAINEE_APP_URL` (see `.env.example`). In development it defaults to the app's
 * dev server; a production build without the variable hides the card instead of pointing staff at localhost.
 */
const DEV_DEFAULT_URL = 'http://localhost:3002';

/** The app's base URL without a trailing slash (http/https only), or `undefined`. */
export function resolveTraineeAppUrl(configured: string | undefined, isDev: boolean): string | undefined {
  const base = configured?.trim() || (isDev ? DEV_DEFAULT_URL : undefined);
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return undefined;
  }
}

/** Base URL of the Trainee App, or `undefined` when none is configured. */
export const TRAINEE_APP_URL = resolveTraineeAppUrl(import.meta.env.VITE_TRAINEE_APP_URL, import.meta.env.DEV);
