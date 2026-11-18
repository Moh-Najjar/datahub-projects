import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
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
 * - HR Admin (other origin) → `<portal>/sso#token=…`, with a handoff token created now (it lives ~2 minutes).
 */
export default function WorkspaceOpenPage() {
  const { locale } = useLocale();
  const { app } = useParams();
  const { pathname } = useLocation();
  const session = useWorkspaceSession();
  const allowed = session ? applicationsFor(session.role).includes(app as ApplicationId) : false;
  const openHr = session !== null && allowed && app === 'hr-admin' && HR_ADMIN_PORTAL_URL !== undefined;

  useEffect(() => {
    // The token is created at the moment of leaving for the portal (it lives ~2 minutes).
    if (openHr && session && HR_ADMIN_PORTAL_URL) window.location.replace(hrSignInUrl(HR_ADMIN_PORTAL_URL, session));
  }, [openHr, session]);

  if (!session) return <Navigate to={localizePath(WORKSPACE_ROUTES.login, locale)} replace state={{ from: pathname } satisfies WorkspaceLocationState} />;
  if (!allowed) {
    const known = app === 'hr-admin' || app === 'blogs-admin';
    return <Navigate to={localizePath(WORKSPACE_ROUTES.root, locale)} replace state={known ? ({ denied: app } satisfies WorkspaceLocationState) : null} />;
  }
  if (app === 'blogs-admin') return <Navigate to={ADMIN_ROUTES.blogs} replace />;
  return null;
}
