import { Suspense } from 'react';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink, Navigate, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { ADMIN_ROUTES, ROUTES } from '@/core/routes/paths';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { signOut } from '@/modules/admin/api/authService';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useAdminSession } from '@/modules/admin/hooks/useAdminSession';
import { PageLoading } from './components/PageLoading';

const T = ADMIN_TEXT;
const isLoginPath = (pathname: string) => pathname.replace(/\/?$/, '/') === ADMIN_ROUTES.login;

function AdminBar({ username }: { username: string }) {
  const navigate = useNavigate();
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #ededed', bgcolor: 'common.white' }}>
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: { xs: 60 }, px: { xs: '15px', md: '30px' } }}>
        <Box component={RouterLink} to={ADMIN_ROUTES.blogs} sx={{ display: 'flex', alignItems: 'center', gap: '12px', mr: 'auto', minWidth: 0 }} aria-label={T.nav.blogs}>
          <Box component="img" src="/assets/logos/datahub-logo.png" srcSet="/assets/logos/datahub-logo.png 1x, /assets/logos/datahub-logo@2x.png 2x" alt="Datahub Analytics" width={250} height={46} sx={{ width: { xs: 130, sm: 160 }, height: 'auto' }} />
          <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, px: '8px', py: '2px', borderRadius: '4px', bgcolor: 'brand.heading', color: 'common.white', fontSize: 12, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {T.areaName}
          </Typography>
        </Box>
        <Button component="a" href={ROUTES.blog} target="_blank" rel="noopener" color="inherit" startIcon={<OpenInNewOutlinedIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 40, px: 2 }}>
          {T.nav.viewSite}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', lg: 'block' } }}>
          {T.nav.signedInAs(username)}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<LogoutOutlinedIcon />}
          onClick={() => {
            signOut();
            navigate(ADMIN_ROUTES.login, { replace: true });
          }}
          sx={{ height: 40, px: 2 }}
        >
          {T.nav.signOut}
        </Button>
      </Toolbar>
    </AppBar>
  );
}

/**
 * Root of the admin area (`/admin/…`): the site theme in English, a slim admin bar, and the route guard — every
 * page except sign-in requires an admin session (otherwise → sign-in, then back to the requested page).
 */
export default function AdminLayout() {
  const location = useLocation();
  const session = useAdminSession();
  const onLogin = isLoginPath(location.pathname);

  let content;
  if (!session && !onLogin) {
    content = <Navigate to={ADMIN_ROUTES.login} replace state={{ from: `${location.pathname}${location.search}` }} />;
  } else if (onLogin) {
    content = <Outlet />;
  } else {
    content = (
      <>
        <AdminBar username={session!.username} />
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
