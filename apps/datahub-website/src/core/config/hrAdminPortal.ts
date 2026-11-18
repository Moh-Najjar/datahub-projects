/**
 * The DataHub HR Admin Portal — a separate application (apps/datahub-hr-admin-portal) on its own origin, opened from
 * the Workspace's "HR Admin" card through its `/sso` page (prototype single sign-in, see modules/portals).
 *
 * The portal's base URL comes from `VITE_HR_ADMIN_PORTAL_URL` (see `.env.example`). In development it defaults to the
 * portal's dev server; a production build without the variable hides the HR Admin card instead of pointing staff at
 * localhost.
 */
const DEV_DEFAULT_URL = 'http://localhost:3001';

/** The portal's base URL without a trailing slash (http/https only), or `undefined`. */
export function resolveHrAdminPortalUrl(configured: string | undefined, isDev: boolean): string | undefined {
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

/** Base URL of the HR Admin Portal, or `undefined` when no portal URL is configured. */
export const HR_ADMIN_PORTAL_URL = resolveHrAdminPortalUrl(import.meta.env.VITE_HR_ADMIN_PORTAL_URL, import.meta.env.DEV);
