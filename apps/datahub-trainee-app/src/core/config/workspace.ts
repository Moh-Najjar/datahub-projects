import type { Locale } from '@/i18n/languages';

/** The id of this application in the Workspace's application catalog (`apps/datahub-website`). */
/** This app's key in the backend's portal list (`GET /api/v1/auth/portals`) and in the Workspace's `/workspace/open/<key>/`. */
export const WORKSPACE_APP_ID = 'academy-admin';

/**
 * The DataHub Workspace — the ONE sign-in of DataHub's staff applications, on the public website
 * (`apps/datahub-website`, `/workspace/`). This app has no sign-in form of its own:
 * - signed-out visitors go to the Workspace's `/workspace/open/academy-admin/` (sign in there, then come back via `/sso`);
 * - Sign out goes to the Workspace's `/workspace/logout/` (ends the central session, shows the Workspace sign-in);
 * - while signed in, the hidden `/workspace-session.html` page reports whether the central session still exists.
 *
 * Base URL from `VITE_WORKSPACE_URL` (public); development default: the website's dev server. A production build
 * without it cannot sign anyone in (the sign-in page says so).
 */
export function resolveWorkspaceUrl(configured: string | undefined, isDev: boolean): string | undefined {
  const value = configured?.trim() || (isDev ? 'http://localhost:3000' : undefined);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return undefined;
  }
}

export const WORKSPACE_URL = resolveWorkspaceUrl(import.meta.env.VITE_WORKSPACE_URL, import.meta.env.DEV);

/** Only messages from this origin are trusted as Workspace session reports. */
export const WORKSPACE_ORIGIN = WORKSPACE_URL ? new URL(WORKSPACE_URL).origin : undefined;

/** A Workspace page in the user's language (the website prefixes Arabic URLs with `/ar`). */
const workspacePage = (path: string, language: Locale): string | undefined =>
  WORKSPACE_URL && `${WORKSPACE_URL}${language === 'ar' ? '/ar' : ''}/workspace/${path}`;

/** The Workspace dashboard ("My applications"). */
export const workspaceHomeUrl = (language: Locale) => workspacePage('', language);

/** Opens this app through the Workspace: its sign-in first when needed, then back here already signed in. */
export const workspaceOpenUrl = (language: Locale) => workspacePage(`open/${WORKSPACE_APP_ID}/`, language);

/** Ends the central session and shows the Workspace sign-in. */
export const workspaceLogoutUrl = (language: Locale) => workspacePage('logout/', language);

/** The hidden session check page (see `core/auth/WorkspaceSessionCheck.tsx`). */
export const WORKSPACE_SESSION_CHECK_URL = WORKSPACE_URL && `${WORKSPACE_URL}/workspace-session.html`;
