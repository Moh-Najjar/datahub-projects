import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { adminBlogKeys } from '@/core/hooks/useAdminBlogs';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { ADMIN_ROUTES, ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { createAdminTheme } from '@/modules/admin/adminTheme';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { formatLocalTime } from '@/modules/admin/utils/date';
import { canOpen, hasPermission, roleLabel, useWorkspaceSession, type WorkspaceLocationState, type WorkspaceSession } from '@/modules/portals';
import { PageLoading } from './components/PageLoading';

const T = ADMIN_TEXT;

/** Up to two initials from a display name. */
function accountInitials(name: string): string {
  const parts = name.split(' ').filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? '') : '';
  return `${first}${second}`.toUpperCase();
}

/** Applies the admin surface on top of the public site theme, without changing that theme. */
function AdminTheme({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const adminTheme = useMemo(() => createAdminTheme(theme), [theme]);
  return <ThemeProvider theme={adminTheme}>{children}</ThemeProvider>;
}

function AdminBar({ session }: { session: WorkspaceSession }) {
  const name = session.name.en;
  const role = roleLabel(session, UI.en.workspace.roles);
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: { xs: 1, sm: 1.5 }, minHeight: 64, px: { xs: '16px', md: '28px' } }}>
        <Box component={RouterLink} to={ADMIN_ROUTES.blogs} sx={{ display: 'flex', alignItems: 'center', gap: '12px', mr: 'auto', minWidth: 0, color: 'text.primary' }} aria-label={T.nav.blogs}>
          <Box component="img" src="/assets/logos/datahub-logo.png" srcSet="/assets/logos/datahub-logo.png 1x, /assets/logos/datahub-logo@2x.png 2x" alt="Datahub Analytics" width={250} height={46} sx={{ width: { xs: 120, sm: 148 }, height: 'auto' }} />
          <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, px: '8px', py: '3px', borderRadius: '6px', bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {T.areaName}
          </Typography>
        </Box>
        <Button component={RouterLink} to={WORKSPACE_ROUTES.root} color="inherit" startIcon={<AppsOutlinedIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 36, px: 1.5, color: 'text.primary' }}>
          {T.nav.workspace}
        </Button>
        <Button component="a" href={ROUTES.blog} target="_blank" rel="noopener" color="inherit" startIcon={<OpenInNewOutlinedIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 36, px: 1.5, color: 'text.primary' }}>
          {T.nav.viewSite}
        </Button>
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: '10px', minWidth: 0, pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: 'primary.main' }}>{accountInitials(name)}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
              {name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
              {role}
            </Typography>
          </Box>
        </Box>
        <Button component={RouterLink} to={WORKSPACE_ROUTES.logout} variant="outlined" startIcon={<LogoutOutlinedIcon />} sx={{ height: 36, px: 1.5 }}>
          {T.nav.signOut}
        </Button>
      </Toolbar>
    </AppBar>
  );
}

/**
 * Root of Blogs Admin (`/admin/…`): the site theme in English, a slim admin bar, and the route guard. There is no
 * separate admin sign-in: the guard uses the central Workspace session, which must be a backend session whose
 * applications include Blogs Admin (its access token authorises the admin API). Signed-out users — also when the token
 * expires or is refused — go to the Workspace sign-in (then back to the requested page); others go to the Workspace
 * dashboard with a notice.
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
    content = (
      <>
        <AdminBar session={session} />
        <Box component="main" sx={{ maxWidth: 1280, mx: 'auto', px: { xs: '16px', md: '28px' }, py: { xs: '20px', md: '28px' } }}>
          <Alert severity="info" variant="outlined" sx={{ mb: '20px', bgcolor: 'background.paper', borderRadius: '10px' }}>
            {T.prototypeNotice} {T.sessionNotice(formatLocalTime(session.expiresAt))}
          </Alert>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </Box>
      </>
    );
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
