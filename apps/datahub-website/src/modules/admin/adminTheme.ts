import { createTheme, type Theme } from '@mui/material/styles';

/** Admin-only surfaces. The public site theme is left unchanged. */
const canvas = '#f4f6f9';
const ink = '#1c2430';
const muted = '#5c6a7a';
const line = '#e3e8ef';
const radius = 8;

/**
 * A nested theme for `/admin/` only. It keeps the website's brand blue and Satoshi,
 * and tightens type, borders and controls so the admin reads as a product surface.
 */
export function createAdminTheme(base: Theme): Theme {
  return createTheme(base, {
    shape: { borderRadius: radius },
    palette: {
      text: { primary: ink, secondary: muted },
      background: { default: canvas, paper: '#ffffff' },
      divider: line,
    },
    typography: {
      h1: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em', color: ink },
      h2: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.35, color: ink },
      button: { fontWeight: 600, letterSpacing: 0, textTransform: 'none' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: radius, fontWeight: 600 },
          contained: { boxShadow: 'none' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: line,
            borderRadius: 12,
            backgroundImage: 'none',
            boxShadow: '0 1px 2px rgba(20, 27, 38, 0.04)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { padding: '12px 16px', borderColor: line, fontSize: 14 },
          head: { fontWeight: 600, color: muted, backgroundColor: canvas, fontSize: 13 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${line}` },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radius, backgroundColor: '#ffffff' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 6 },
        },
      },
    },
  });
}
