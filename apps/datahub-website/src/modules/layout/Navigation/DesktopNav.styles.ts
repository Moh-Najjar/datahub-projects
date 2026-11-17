import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import { easing } from '@/core/theme/tokens';

/**
 * Styles for the desktop menu (header-03 of the Mitech theme).
 * Physical left/right are used deliberately — the RTL Emotion cache mirrors them.
 */

/** Viewport width from which top-level items use the original (roomier) spacing, per direction. */
const ROOMY_FROM = { ltr: 1540, rtl: 1800 } as const;

/**
 * Below this width an `app` item (HR Portal) shows as an icon: even with the tight spacing the
 * Arabic menu is ~125px too wide for 1200–1439px with the full label.
 */
export const APP_ITEM_LABEL_FROM = 1440;

const noForward =(...names: string[]) => (prop: PropertyKey) => !names.includes(String(prop));

export const MenuList = styled('ul')({
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'center',
  height: '100%',
});

export const MenuItem = styled('li', { shouldForwardProp: noForward('active', 'open', 'mega') })<{
  active?: boolean;
  open?: boolean;
  mega?: boolean;
}>(({ theme, active, open, mega }) => {
  const highlighted = active || open;
  return {
    // The mega menu is positioned against the header container, not the item.
    position: mega ? 'static' : 'relative',
    display: 'flex',
    '& > .nav-link': {
      display: 'flex',
      alignItems: 'center',
      margin: '0 2px',
      padding: '22px 12px',
      color: highlighted ? theme.palette.primary.main : theme.palette.common.black,
      fontSize: 16,
      lineHeight: 1.18,
      whiteSpace: 'nowrap',
      background: 'none',
      border: 0,
      cursor: 'pointer',
      '&:hover, &:focus-visible': { color: theme.palette.primary.main },
      // Tighter items until the full menu (incl. Products and HR Portal) fits with the original spacing:
      // measured, the menu needs 1099px (EN) / 1206px (AR) beside the logo, i.e. a viewport of about
      // 1530px / 1740px (plus a margin). From ROOMY_FROM up the original spacing applies unchanged.
      [theme.breakpoints.between('xl', ROOMY_FROM[theme.direction])]: {
        margin: 0,
        padding: '22px 6px',
      },
    },
    '& .nav-wrap': {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '9px 0',
      // Animated 3px underline for current/hovered items.
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        right: highlighted ? 'auto' : 0,
        left: highlighted ? 0 : 'auto',
        width: highlighted ? '100%' : 0,
        height: 3,
        background: theme.palette.primary.main,
        transition: `width .6s ${easing.theme}`,
      },
    },
    '&:hover .nav-wrap::after': { width: '100%', left: 0, right: 'auto' },
  };
});

/** Shared look of dropdown panels: white, soft shadow, 4px green bar at the bottom. */
export const DropdownPanel = styled(Paper, { shouldForwardProp: noForward('open') })<{ open: boolean }>(
  ({ theme, open }) => ({
    position: 'absolute',
    top: '100%',
    zIndex: 20,
    borderRadius: 0,
    visibility: open ? 'visible' : 'hidden',
    opacity: open ? 1 : 0,
    transform: open ? 'none' : 'translateY(15px)',
    transition: 'opacity .3s, transform .3s, visibility .3s',
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 4,
      background: theme.palette.brand.green,
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  }),
);

/** Link inside a dropdown, with the theme's growing 1px underline on hover. */
export const subLinkSx = {
  display: 'block',
  py: '9px',
  color: 'brand.submenu',
  fontSize: 14,
  lineHeight: 1.47,
  '& .sub-label': {
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 0,
      height: '1px',
      background: 'currentColor',
      transition: `width .6s ${easing.theme}`,
    },
  },
  '&:hover, &:focus-visible': {
    color: 'info.main',
    '& .sub-label::after': { width: '100%', left: 0, right: 'auto' },
  },
} as const;
