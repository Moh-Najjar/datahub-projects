import { ROUTES } from '@/core/routes/paths';

/*
 * The page a signed-out visitor asked for, kept across the Workspace round trip (/login → Workspace → /sso) so they come
 * back to it instead of the landing page. This tab only (sessionStorage); an in-app path only (never another site).
 */

const KEY = 'datahub-trainee.return-to';

const isInAppPath = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && ![ROUTES.login, ROUTES.sso, ROUTES.activate].some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`)) && path !== ROUTES.root;

export function rememberReturnTo(path: unknown): void {
  try {
    if (isInAppPath(path)) sessionStorage.setItem(KEY, path);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the user simply lands on their home page.
  }
}

/** The remembered page, or null. */
export function readReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    return isInAppPath(path) ? path : null;
  } catch {
    return null;
  }
}

/** Forgets it (after it was used). */
export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
