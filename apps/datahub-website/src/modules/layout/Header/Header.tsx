import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import GlobalStyles from '@mui/material/GlobalStyles';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import { keyframes, useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import { useLocation } from 'react-router-dom';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n';
import { layout } from '@/core/theme/tokens';
import { MOBILE_MENU_WIDTH, MobileMenu } from '@/modules/layout/Navigation/MobileMenu';
import { DesktopNav } from '@/modules/layout/Navigation/DesktopNav';
import { Logo } from './Logo';

const slideDown = keyframes`from { transform: translateY(-100%); } to { transform: none; }`;

/** Element id of the page wrapper that is pushed aside when the mobile menu opens. */
export const SITE_SHELL_ID = 'site-shell';

/**
 * Site header ("header-03" in the original theme): white bar with the logo and a centered menu.
 * Once the page is scrolled it becomes fixed, gains a shadow and the logo shrinks to 200px.
 */
export function Header() {
  const ui = useLocalized(UI);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('xl'), { noSsr: true });
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: layout.headerHeight });
  const { pathname } = useLocation();
  // The menu is open only on the page where it was opened and only below the desktop
  // breakpoint, so navigating or resizing closes it without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const menuOpen = openedAt === pathname && !isDesktop;
  const closeMenu = useCallback(() => setOpenedAt(null), []);
  const setMenuOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  const pushX = theme.direction === 'rtl' ? MOBILE_MENU_WIDTH : `calc(-1 * ${MOBILE_MENU_WIDTH})`;

  return (
    <Box component="header" sx={{ position: 'relative', zIndex: 1100, height: layout.headerHeight }}>
      {/* The original pushes the whole page aside while the mobile menu is open. */}
      <GlobalStyles
        styles={{
          [`#${SITE_SHELL_ID}`]: {
            transition: 'transform .3s ease',
            transform: menuOpen ? `translateX(${pushX})` : 'none',
          },
        }}
      />
      <Box
        sx={{
          position: scrolled ? 'fixed' : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: layout.headerHeight,
          bgcolor: 'common.white',
          boxShadow: scrolled ? theme.customShadows.stickyHeader : 'none',
          animation: scrolled ? `${slideDown} .45s ease` : 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <Container sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              '& img': { width: scrolled ? 200 : { xs: 245, xl: 250 }, transition: 'width .3s' },
            }}
          >
            <Logo />
          </Box>
          {isDesktop ? (
            <DesktopNav />
          ) : (
            <IconButton
              onClick={() => setMenuOpen(true)}
              aria-label={ui.openMenu}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              sx={{ color: 'common.black', p: 0, '&:hover': { bgcolor: 'transparent' } }}
            >
              <MenuIcon sx={{ fontSize: 34 }} />
            </IconButton>
          )}
        </Container>
      </Box>
      {!isDesktop && <MobileMenu open={menuOpen} onClose={closeMenu} />}
    </Box>
  );
}
