import { Suspense } from 'react';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { ADMIN_ROUTES, ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { canOpen, useWorkspaceSession, type WorkspaceLocationState, type WorkspaceSession } from '@/modules/portals';
import { PageLoading } from './components/PageLoading';

const T = ADMIN_TEXT;

function AdminBar({ session }: { session: WorkspaceSession }) {
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #ededed', bgcolor: 'common.white' }}>
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: { xs: 60 }, px: { xs: '15px', md: '30px' } }}>
        <Box component={RouterLink} to={ADMIN_ROUTES.blogs} sx={{ display: 'flex', alignItems: 'center', gap: '12px', mr: 'auto', minWidth: 0 }} aria-label={T.nav.blogs}>
          <Box component="img" src="/assets/logos/datahub-logo.png" srcSet="/assets/logos/datahub-logo.png 1x, /assets/logos/datahub-logo@2x.png 2x" alt="Datahub Analytics" width={250} height={46} sx={{ width: { xs: 130, sm: 160 }, height: 'auto' }} />
          <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, px: '8px', py: '2px', borderRadius: '4px', bgcolor: 'brand.heading', color: 'common.white', fontSize: 12, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {T.areaName}
          </Typography>
        </Box>
        <Button component={RouterLink} to={WORKSPACE_ROUTES.root} color="inherit" startIcon={<AppsOutlinedIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 40, px: 2 }}>
          {T.nav.workspace}
        </Button>
        <Button component="a" href={ROUTES.blog} target="_blank" rel="noopener" color="inherit" startIcon={<OpenInNewOutlinedIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 40, px: 2 }}>
          {T.nav.viewSite}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', lg: 'block' } }}>
          {T.nav.signedInAs(session.name.en, UI.en.workspace.roles[session.role])}
        </Typography>
        <Button component={RouterLink} to={WORKSPACE_ROUTES.logout} variant="outlined" startIcon={<LogoutOutlinedIcon />} sx={{ height: 40, px: 2 }}>
          {T.nav.signOut}
        </Button>
      </Toolbar>
    </AppBar>
  );
}

/**
 * Root of Blogs Admin (`/admin/…`): the site theme in English, a slim admin bar, and the route guard. There is no
 * separate admin sign-in: the guard uses the central Workspace session. Signed-out users go to the Workspace sign-in
 * (then back to the requested page); roles without Blogs Admin access go to the Workspace dashboard with a notice.
 */
export default function AdminLayout() {
  const location = useLocation();
  const session = useWorkspaceSession();

  let content;
  if (!session) {
    content = <Navigate to={WORKSPACE_ROUTES.login} replace state={{ from: `${location.pathname}${location.search}` } satisfies WorkspaceLocationState} />;
  } else if (!canOpen(session.role, 'blogs-admin')) {
    content = <Navigate to={WORKSPACE_ROUTES.root} replace state={{ denied: 'blogs-admin' } satisfies WorkspaceLocationState} />;
  } else {
    content = (
      <>
        <AdminBar session={session} />
        <Box component="main" sx={{ maxWidth: 1240, mx: 'auto', px: { xs: '15px', md: '30px' }, py: { xs: '24px', md: '40px' } }}>
          <Alert severity="info" variant="outlined" sx={{ mb: 3, bgcolor: 'common.white' }}>
            {T.prototypeNotice}
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
        <meta name="robots" content="noindex, nofollow" />
        <ScrollRestoration />
        <Box sx={{ minHeight: '100vh', bgcolor: '#f7f8fa' }}>
          <Suspense fallback={<PageLoading />}>{content}</Suspense>
        </Box>
      </AppThemeProvider>
    </LocaleProvider>
  );
}
