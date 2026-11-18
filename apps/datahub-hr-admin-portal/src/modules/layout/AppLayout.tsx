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

/** Signed-in shell: sidebar + top bar around the current page. Breadcrumbs live in the top bar. */
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
        {/* The provider wraps the bar and the page so detail screens can append crumbs. */}
        <BreadcrumbProvider>
          <TopBar onOpenNavigation={isDesktop ? undefined : () => setOpenedOn(pathname)} />
          <Box
            component="main"
            sx={{
              flex: 1,
              width: '100%',
              maxWidth: layout.contentMax,
              mx: 'auto',
              px: { xs: 2, sm: 2.5, lg: 3.5 },
              py: { xs: 2, md: 3 },
            }}
          >
            <Suspense fallback={<LinearProgress aria-label={t('shell.loading')} />}>
              <Outlet />
            </Suspense>
          </Box>
        </BreadcrumbProvider>
      </Box>
    </Box>
  );
}
