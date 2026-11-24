import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Outlet, useLocation } from 'react-router-dom';
import { layout } from '@/core/theme/tokens';
import { useT } from '@/i18n/useT';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * The signed-in shell: a full-width top bar (page context and the main actions) above a light sidebar (a drawer on
 * phones) and the routed page.
 */
export function AppLayout() {
  const t = useT();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const { pathname } = useLocation();
  // The mobile drawer is open only on the page where it was opened, so navigating closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Link href="#main-content" sx={{ position: 'absolute', left: -9999, top: 8, zIndex: 2000, bgcolor: 'background.paper', p: 1, borderRadius: 1, '&:focus': { left: 8 } }}>
        {t.shell.skipToContent}
      </Link>
      <TopBar onOpenNavigation={isDesktop ? undefined : () => setOpenedOn(pathname)} />
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar permanent={isDesktop} open={openedOn === pathname} onClose={() => setOpenedOn(null)} />
        <Box component="main" id="main-content" tabIndex={-1} sx={{ flex: 1, minWidth: 0, outline: 'none', px: { xs: 2, sm: 3, lg: 6 }, py: { xs: 3, md: 5 } }}>
          <Box sx={{ width: '100%', maxWidth: layout.contentMax, mx: 'auto' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
