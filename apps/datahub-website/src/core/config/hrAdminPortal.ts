/**
 * Link to the DataHub HR Admin Portal — a separate application (apps/datahub-hr-admin-portal).
 * This is navigation only: no authentication, tokens or session data are shared with the portal.
 *
 * The portal's base URL comes from `VITE_HR_ADMIN_PORTAL_URL` (see `.env.example`). In development it
 * defaults to the portal's dev server; a production build without the variable hides the link instead
 * of pointing visitors at localhost.
 */
const DEV_DEFAULT_URL = 'http://localhost:5174';

/** Path of the portal's sign-in page. */
const LOGIN_PATH = '/login';

export function resolveHrAdminPortalLoginUrl(configured: string | undefined, isDev: boolean): string | undefined {
  const base = configured?.trim() || (isDev ? DEV_DEFAULT_URL : undefined);
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}${LOGIN_PATH}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Absolute URL of the portal's sign-in page, or `undefined` when no portal URL is configured. */
export const HR_ADMIN_PORTAL_LOGIN_URL = resolveHrAdminPortalLoginUrl(
  import.meta.env.VITE_HR_ADMIN_PORTAL_URL,
  import.meta.env.DEV,
);
