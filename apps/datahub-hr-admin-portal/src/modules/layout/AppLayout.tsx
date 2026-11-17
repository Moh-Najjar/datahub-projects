import { Suspense, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { BreadcrumbProvider } from '@/core/context/BreadcrumbProvider';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Signed-in shell: sidebar + top bar + breadcrumbs around the current page. */
export function AppLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const { pathname } = useLocation();
  // The mobile drawer is open only on the page where it was opened, so navigating closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar permanent={isDesktop} open={mobileOpen} onClose={() => setOpenedOn(null)} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar onOpenNavigation={isDesktop ? undefined : () => setOpenedOn(pathname)} />
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 4 }, maxWidth: 1440, width: '100%', mx: 'auto' }}>
          <BreadcrumbProvider>
            <AppBreadcrumbs />
            <Suspense fallback={<LinearProgress aria-label={t('shell.loading')} />}>
              <Outlet />
            </Suspense>
          </BreadcrumbProvider>
        </Box>
      </Box>
    </Box>
  );
}
