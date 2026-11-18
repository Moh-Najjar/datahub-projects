import { Suspense } from 'react';
import Box from '@mui/material/Box';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { localeFromPath } from '@/i18n/paths';

/**
 * Root of `/workspace/…` and `/ar/workspace/…`: the site theme in the URL's language (RTL for Arabic), outside the
 * public `SiteLayout` and not indexed. Each page guards itself (the dashboard needs a session).
 */
export default function WorkspaceLayout() {
  const locale = localeFromPath(useLocation().pathname);
  return (
    <LocaleProvider locale={locale}>
      <AppThemeProvider>
        <meta name="robots" content="noindex, nofollow" />
        <ScrollRestoration />
        <Box sx={{ minHeight: '100vh', bgcolor: '#f7f8fa' }}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </Box>
      </AppThemeProvider>
    </LocaleProvider>
  );
}
