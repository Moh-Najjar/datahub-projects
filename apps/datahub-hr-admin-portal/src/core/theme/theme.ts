import { createTheme, type Theme } from '@mui/material/styles';
import type { Direction } from '@/i18n/languages';
import { brand, breakpoints, control, dark, fontFamily, fontSize, neutral, radius, shadows, spacingUnit, status } from './tokens';

/** `<html data-color-scheme="light|dark">` — set by MUI from the user's choice. */
export const COLOR_SCHEME_ATTRIBUTE = 'data-color-scheme';

/**
 * MUI theme for one text direction, with a light (default) and a dark colour scheme served as CSS
 * variables: switching scheme swaps variables instead of rebuilding styles. Dark-only tweaks use
 * `theme.applyStyles('dark', …)`.
 *
 * Component defaults here are the portal-wide design system. Screens should not restyle MUI
 * primitives with one-off colours; they compose these defaults.
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
          action: { hover: 'rgba(20, 27, 38, 0.04)', selected: 'rgba(20, 86, 200, 0.08)' },
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
      h1: { fontSize: fontSize.h1, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
      h2: { fontSize: fontSize.h2, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
      h3: { fontSize: fontSize.h3, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.015em' },
      h4: { fontSize: fontSize.h4, fontWeight: 700, lineHeight: 1.35 },
      h5: { fontSize: fontSize.h5, fontWeight: 700, lineHeight: 1.4 },
      h6: { fontSize: fontSize.h6, fontWeight: 600, lineHeight: 1.45 },
      subtitle1: { fontSize: fontSize.subtitle, fontWeight: 600, lineHeight: 1.45 },
      subtitle2: { fontSize: fontSize.body1, fontWeight: 600, lineHeight: 1.45 },
      body1: { fontSize: fontSize.body1, lineHeight: 1.6 },
      body2: { fontSize: fontSize.body2, lineHeight: 1.55 },
      caption: { fontSize: fontSize.caption, lineHeight: 1.45 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0, fontSize: fontSize.body1 },
      overline: { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.4 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' },
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&.Mui-focusVisible': {
              outline: `2px solid ${(theme.vars ?? theme).palette.primary.main}`,
              outlineOffset: 2,
            },
          }),
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            minHeight: control.md,
            padding: '6px 14px',
          },
          sizeSmall: { minHeight: control.sm, padding: '4px 10px', fontSize: fontSize.body2 },
          sizeLarge: { minHeight: control.lg, padding: '8px 18px', fontSize: fontSize.subtitle },
          outlined: ({ theme }) => ({
            borderColor: (theme.vars ?? theme).palette.divider,
            '&:hover': { borderColor: (theme.vars ?? theme).palette.text.secondary },
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: radius.md },
          sizeSmall: { width: control.sm, height: control.sm },
        },
      },
      MuiPaper: {
        // Flat surfaces in both schemes (no dark-mode elevation overlay); depth comes from borders.
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: ({ theme }) => ({
            borderColor: (theme.vars ?? theme).palette.divider,
            boxShadow: shadows.sm,
            ...theme.applyStyles('dark', { boxShadow: 'none' }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.md,
            border: '1px solid',
            borderColor: (theme.vars ?? theme).palette.divider,
            boxShadow: shadows.sm,
            backgroundImage: 'none',
            ...theme.applyStyles('dark', { boxShadow: 'none' }),
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderColor: (theme.vars ?? theme).palette.divider,
            backgroundImage: 'none',
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            boxShadow: shadows.md,
            border: '1px solid',
            borderColor: (theme.vars ?? theme).palette.divider,
            borderRadius: radius.md,
          }),
          list: { padding: 4 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { borderRadius: radius.sm, minHeight: 38, margin: '1px 4px', paddingLeft: 10, paddingRight: 10 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: radius.lg,
            boxShadow: shadows.lg,
            border: '1px solid',
            borderColor: (theme.vars ?? theme).palette.divider,
            backgroundImage: 'none',
          }),
          paperFullScreen: { borderRadius: 0, border: 'none' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: fontSize.h5, fontWeight: 700, padding: '20px 24px 8px' },
        },
      },
      MuiDialogContent: {
        styleOverrides: { root: { paddingTop: 12 } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.md,
            backgroundColor: (theme.vars ?? theme).palette.background.paper,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme.vars ?? theme).palette.divider,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme.vars ?? theme).palette.text.secondary,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1 },
          }),
          input: { paddingTop: 10, paddingBottom: 10 },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginLeft: 2, marginRight: 2 } },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 42 },
          indicator: { height: 2, borderRadius: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 42,
            padding: '8px 14px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: fontSize.body1,
            color: (theme.vars ?? theme).palette.text.secondary,
            '&.Mui-selected': { color: (theme.vars ?? theme).palette.primary.main },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: radius.sm, fontWeight: 600 },
          sizeSmall: { height: 24, fontSize: fontSize.caption },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: fontSize.caption, borderRadius: radius.sm, padding: '6px 10px' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: radius.md, alignItems: 'center' },
          message: { padding: '6px 0' },
        },
      },
      MuiSnackbar: {
        styleOverrides: { root: { borderRadius: radius.md } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: (theme.vars ?? theme).palette.divider,
            padding: '12px 16px',
            fontSize: fontSize.body2,
          }),
          head: ({ theme }) => ({
            fontWeight: 600,
            fontSize: fontSize.caption,
            color: (theme.vars ?? theme).palette.text.secondary,
            backgroundColor: (theme.vars ?? theme).palette.background.default,
          }),
          sizeSmall: { padding: '8px 12px' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:last-of-type .MuiTableCell-body': { borderBottom: 0 },
            '&.MuiTableRow-hover:hover': {
              backgroundColor: theme.alpha((theme.vars ?? theme).palette.primary.main, 0.04),
            },
          }),
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderTop: '1px solid',
            borderColor: (theme.vars ?? theme).palette.divider,
          }),
          toolbar: { minHeight: 52, paddingLeft: 16, paddingRight: 8 },
          selectLabel: { fontSize: fontSize.body2 },
          displayedRows: { fontSize: fontSize.body2 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 0 } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: radius.md, padding: '6px 12px' },
        },
      },
      MuiSkeleton: {
        styleOverrides: { rounded: { borderRadius: radius.md } },
      },
    },
  });
}
