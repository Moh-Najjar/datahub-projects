import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import { TRAINEE_APP_URL } from '@/core/config/traineeApp';
import { ADMIN_ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath } from '@/i18n/paths';
import { hrSignInUrl } from '@/modules/portals/api/hrHandoff';
import { applicationsFor, type ApplicationId } from '@/modules/portals/data/applications';
import { useWorkspaceSession } from '@/modules/portals/hooks/useWorkspaceSession';
import type { WorkspaceLocationState } from '@/modules/portals/types';

/**
 * `/workspace/open/<application>/` — opens an application as the signed-in user. Signed-out users sign in first and come
 * back here; roles without access go to the dashboard with a notice. The dashboard cards link here, and the HR portal
 * sends signed-out visitors here, so every way into an application goes through the one Workspace sign-in.
 * - Blogs Admin (same site) → `/admin/blogs/`.
 * - HR Admin / Trainee App (other origins) → `<app>/sso#token=…`, with a handoff token created now (it lives ~2 minutes).
 */
/** Former id of the Trainee App (before the backend's `academy-admin` key): still accepted by `/workspace/open/…/`. */
const ALIASES: Readonly<Record<string, ApplicationId>> = { 'trainee-app': 'academy-admin' };

export default function WorkspaceOpenPage() {
  const { locale } = useLocale();
  const { app: requested } = useParams();
  const app = requested && ALIASES[requested] ? ALIASES[requested] : requested;
  const { pathname } = useLocation();
  const session = useWorkspaceSession();
  const allowed = session ? applicationsFor(session).includes(app as ApplicationId) : false;
  const externalUrl = app === 'hr-admin' ? HR_ADMIN_PORTAL_URL : app === 'academy-admin' ? TRAINEE_APP_URL : undefined;
  const openExternal = session !== null && allowed && externalUrl !== undefined;

  useEffect(() => {
    // The token is created at the moment of leaving for the portal (it lives ~2 minutes).
    if (openExternal && session && externalUrl) window.location.replace(hrSignInUrl(externalUrl, session));
  }, [openExternal, session, externalUrl]);

  if (!session) return <Navigate to={localizePath(WORKSPACE_ROUTES.login, locale)} replace state={{ from: pathname } satisfies WorkspaceLocationState} />;
  if (!allowed) {
    const known = app === 'hr-admin' || app === 'blogs-admin' || app === 'academy-admin';
    return <Navigate to={localizePath(WORKSPACE_ROUTES.root, locale)} replace state={known ? ({ denied: app } satisfies WorkspaceLocationState) : null} />;
  }
  if (app === 'blogs-admin') return <Navigate to={ADMIN_ROUTES.blogs} replace />;
  return null;
}
