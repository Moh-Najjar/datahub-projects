import { createTheme, type Theme } from '@mui/material/styles';
import type { Direction } from '@/i18n/languages';
import { brand, breakpoints, dark, fontFamily, fontSize, neutral, radius, shadows, spacingUnit, status } from './tokens';

/** `<html data-color-scheme="light|dark">` — set by MUI from the user's choice. */
export const COLOR_SCHEME_ATTRIBUTE = 'data-color-scheme';

/**
 * MUI theme for one text direction, with a light (default) and a dark colour scheme served as CSS
 * variables: switching scheme swaps variables instead of rebuilding styles. Dark-only tweaks use
 * `theme.applyStyles('dark', …)`.
 */
export function createAppTheme(direction: Direction): Theme {
  return createTheme({
    direction,
    cssVariables: { colorSchemeSelector: COLOR_SCHEME_ATTRIBUTE },
    colorSchemes: {
      light: {
        palette: {
          primary: { main: brand.blue, dark: brand.blueDark, light: brand.blueLight, contrastText: neutral[0] },
          secondary: { main: brand.greenDark, light: brand.greenLight, contrastText: neutral[0] },
          success: { main: status.success },
          warning: { main: status.warning },
          error: { main: status.error },
          info: { main: status.info },
          text: { primary: neutral[900], secondary: neutral[600], disabled: neutral[400] },
          divider: neutral[200],
          background: { default: neutral[50], paper: neutral[0] },
          grey: neutral,
        },
      },
      dark: {
        palette: {
          primary: { main: dark.primary, contrastText: dark.onAccent },
          secondary: { main: dark.secondary, contrastText: dark.onAccent },
          success: { main: dark.success, contrastText: dark.onAccent },
          warning: { main: dark.warning, contrastText: dark.onAccent },
          error: { main: dark.error, contrastText: dark.onAccent },
          info: { main: dark.info, contrastText: dark.onAccent },
          text: { primary: dark.textPrimary, secondary: dark.textSecondary, disabled: dark.textDisabled },
          divider: dark.divider,
          background: { default: dark.background, paper: dark.paper },
          grey: neutral,
        },
      },
    },
    breakpoints: { values: breakpoints },
    spacing: spacingUnit,
    shape: { borderRadius: radius.md },
    typography: {
      fontFamily: direction === 'rtl' ? fontFamily.arabic : fontFamily.latin,
      fontSize: fontSize.body1,
      h1: { fontSize: fontSize.h1, fontWeight: 700, lineHeight: 1.25 },
      h2: { fontSize: fontSize.h2, fontWeight: 700, lineHeight: 1.3 },
      h3: { fontSize: fontSize.h3, fontWeight: 600, lineHeight: 1.35 },
      h4: { fontSize: fontSize.h4, fontWeight: 600, lineHeight: 1.4 },
      h5: { fontSize: fontSize.h5, fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: fontSize.h6, fontWeight: 600, lineHeight: 1.45 },
      subtitle1: { fontSize: fontSize.subtitle, fontWeight: 500 },
      body1: { fontSize: fontSize.body1, lineHeight: 1.6 },
      body2: { fontSize: fontSize.body2, lineHeight: 1.55 },
      caption: { fontSize: fontSize.caption },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: 'antialiased' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: radius.sm } },
      },
      MuiPaper: {
        // Flat surfaces in both schemes (no dark-mode elevation overlay); depth comes from borders/shadows.
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiMenu: {
        styleOverrides: { paper: { boxShadow: shadows.md } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: radius.lg, boxShadow: shadows.lg } },
      },
    },
  });
}
