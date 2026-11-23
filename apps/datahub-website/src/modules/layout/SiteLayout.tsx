import { Suspense } from 'react';
import Box from '@mui/material/Box';
import { MotionConfig } from 'framer-motion';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { useLocalized } from '@/i18n/LocaleContext';
import { localeFromPath } from '@/i18n/paths';
import { UI } from '@/i18n';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { layout } from '@/core/theme/tokens';
import { BackToTop } from '@/modules/layout/BackToTop';
import { Footer } from '@/modules/layout/Footer/Footer';
import { Header, SITE_SHELL_ID } from '@/modules/layout/Header/Header';

function SkipLink() {
  const ui = useLocalized(UI);
  return (
    <Box
      component="a"
      href="#main-content"
      sx={{
        position: 'absolute',
        top: -100,
        left: 16,
        zIndex: 2000,
        px: '18px',
        py: '10px',
        color: 'common.white',
        bgcolor: 'primary.main',
        borderRadius: 1,
        '&:focus': { top: 16, color: 'common.white' },
      }}
    >
      {ui.skipToContent}
    </Box>
  );
}

/**
 * Root layout for every route. The locale comes from the URL (`/ar/...` → Arabic),
 * which selects the theme direction (LTR/RTL) and all localized content.
 */
export function SiteLayout() {
  const { pathname } = useLocation();
  const locale = localeFromPath(pathname);

  return (
    <LocaleProvider locale={locale}>
      <AppThemeProvider>
        <MotionConfig reducedMotion="user">
          <ScrollRestoration />
          <SkipLink />
          <Box id={SITE_SHELL_ID}>
            <Header />
            <Box
              component="main"
              id="main-content"
              tabIndex={-1}
              sx={{ outline: 'none', '& [id]': { scrollMarginTop: `${layout.headerHeight}px` } }}
            >
              {/* Page documents load with React 19 `use()`; keep the layout visible meanwhile. */}
              <Suspense fallback={<Box sx={{ minHeight: '100vh' }} />}>
                <Outlet />
              </Suspense>
            </Box>
            <Footer />
          </Box>
          <BackToTop />
        </MotionConfig>
      </AppThemeProvider>
    </LocaleProvider>
  );
}
