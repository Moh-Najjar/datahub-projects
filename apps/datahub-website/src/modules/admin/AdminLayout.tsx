import '@fontsource-variable/inter';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { adminBlogKeys } from '@/core/hooks/useAdminBlogs';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { WORKSPACE_ROUTES } from '@/core/routes/paths';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { createAdminTheme } from '@/modules/admin/adminTheme';
import { layout } from '@/modules/admin/adminTokens';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { formatLocalTime } from '@/modules/admin/utils/date';
import { canOpen, hasPermission, useWorkspaceSession, type WorkspaceLocationState, type WorkspaceSession } from '@/modules/portals';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminTopBar } from './components/AdminTopBar';
import { PageLoading } from './components/PageLoading';

const T = ADMIN_TEXT;

/** Applies the DataHub admin theme under /admin/ only, without changing the public site theme. */
function AdminTheme({ children }: { children: ReactNode }) {
  const adminTheme = useMemo(() => createAdminTheme(), []);
  return <ThemeProvider theme={adminTheme}>{children}</ThemeProvider>;
}

/** The signed-in shell (DataHub admin design): a full-width top bar above a light sidebar (a drawer on phones) and the page. */
function AdminShell({ session }: { session: WorkspaceSession }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const { pathname } = useLocation();
  // The mobile drawer is open only on the page where it was opened, so navigating closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AdminTopBar session={session} onOpenNavigation={isDesktop ? undefined : () => setOpenedOn(pathname)} />
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <AdminSidebar permanent={isDesktop} open={openedOn === pathname} onClose={() => setOpenedOn(null)} />
        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 2.5, md: 4 } }}>
          <Box sx={{ width: '100%', maxWidth: layout.contentMax, mx: 'auto' }}>
            <Alert severity="info" variant="outlined" sx={{ mb: 3, bgcolor: 'background.paper' }}>
              {T.prototypeNotice} {T.sessionNotice(formatLocalTime(session.expiresAt))}
            </Alert>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Root of Blogs Admin (`/admin/…`): the DataHub admin look (same tokens and shell as the HR Admin Portal and Trainee App) in English,
 * and the route guard. There is no separate admin sign-in: the guard uses the central Workspace session, which must be a
 * backend session whose applications include Blogs Admin (its access token authorises the admin API). Signed-out users —
 * also when the token expires or is refused — go to the Workspace sign-in (then back to the requested page); others go
 * to the Workspace dashboard with a notice.
 */
export default function AdminLayout() {
  const location = useLocation();
  const session = useWorkspaceSession();
  const queryClient = useQueryClient();

  // Signed out (here, in another tab, or the token expired): forget the admin data of the previous user.
  useEffect(() => {
    if (!session) queryClient.removeQueries({ queryKey: adminBlogKeys.all });
  }, [session, queryClient]);

  // The former browser-only blog editor kept its posts under this key; posts now live in the API only.
  useEffect(() => {
    try {
      localStorage.removeItem('datahub-website.blog.v1');
    } catch {
      // Storage blocked: nothing to clean.
    }
  }, []);

  let content;
  if (!session) {
    content = <Navigate to={WORKSPACE_ROUTES.login} replace state={{ from: `${location.pathname}${location.search}` } satisfies WorkspaceLocationState} />;
  } else if (!canOpen(session, 'blogs-admin') || !hasPermission(session, 'cms.blogs.view')) {
    content = <Navigate to={WORKSPACE_ROUTES.root} replace state={{ denied: 'blogs-admin' } satisfies WorkspaceLocationState} />;
  } else {
    content = <AdminShell session={session} />;
  }

  return (
    <LocaleProvider locale="en">
      <AppThemeProvider>
        <AdminTheme>
          <meta name="robots" content="noindex, nofollow" />
          <ScrollRestoration />
          <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
            <Suspense fallback={<PageLoading />}>{content}</Suspense>
          </Box>
        </AdminTheme>
      </AppThemeProvider>
    </LocaleProvider>
  );
}
