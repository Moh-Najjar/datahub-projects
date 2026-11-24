import { Suspense, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { BreadcrumbProvider } from '@/core/context/BreadcrumbProvider';
import { layout } from '@/core/theme/tokens';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * Signed-in shell (DataHub admin design): a full-width top bar (breadcrumbs and the main actions) above a light sidebar
 * (a drawer on phones) and the current page.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const { pathname } = useLocation();
  // The mobile drawer is open only on the page where it was opened, so navigating closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;

  return (
    // The provider wraps the bar and the page so detail screens can append crumbs.
    <BreadcrumbProvider>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <TopBar onOpenNavigation={isDesktop ? undefined : () => setOpenedOn(pathname)} />
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Sidebar permanent={isDesktop} open={mobileOpen} onClose={() => setOpenedOn(null)} />
          <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 2.5, md: 4 } }}>
            <Box sx={{ width: '100%', maxWidth: layout.contentMax, mx: 'auto' }}>
              <Suspense fallback={<LinearProgress aria-label={t('shell.loading')} />}>
                <Outlet />
              </Suspense>
            </Box>
          </Box>
        </Box>
      </Box>
    </BreadcrumbProvider>
  );
}
