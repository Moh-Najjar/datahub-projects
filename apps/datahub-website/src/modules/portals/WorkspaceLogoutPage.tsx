import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKSPACE_ROUTES } from '@/core/routes/paths';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath } from '@/i18n/paths';
import { signOut } from '@/modules/portals/api/workspaceAuth';
import type { WorkspaceLocationState } from '@/modules/portals/types';

/**
 * `/workspace/logout/` — ends the central session and shows the Workspace sign-in with a confirmation. Every
 * application's Sign out lands here: the Workspace header, Blogs Admin and the HR Admin portal. Other tabs of this site
 * sign out at once (storage event); the HR portal notices through the session bridge and ends its own session.
 */
export default function WorkspaceLogoutPage() {
  const { locale } = useLocale();
  const navigate = useNavigate();

  useEffect(() => {
    signOut();
    navigate(localizePath(WORKSPACE_ROUTES.login, locale), { replace: true, state: { signedOut: true } satisfies WorkspaceLocationState });
  }, [locale, navigate]);

  return null;
}
