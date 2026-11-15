/**
 * DataHub HR Admin design tokens — the single source for colours, type, spacing, radius, shadows and
 * breakpoints. The palette starts from DataHub's brand blue and green; neutrals are a cool slate scale
 * suited to dense admin screens. Use these through the MUI theme (`theme.palette`, `theme.spacing`, …),
 * not by importing them in components.
 */

export const brand = {
  /** 6.57:1 with white — safe for text and filled buttons. */
  blue: '#1456c8',
  blueDark: '#0b3d91',
  blueLight: '#e8f0fc',
  /** DataHub brand green — 3.97:1 with white: decorative use and large text only. */
  green: '#2a9243',
  /** Accessible brand green (4.73:1 with white) for text and filled components. */
  greenDark: '#24843d',
  greenLight: '#e7f4ea',
} as const;

/** Slate neutrals: 50 = app background … 900 = primary text. */
export const neutral = {
  0: '#ffffff',
  50: '#f6f8fb',
  100: '#eef1f6',
  200: '#dde3ec',
  300: '#c4ccd8',
  400: '#98a3b3',
  500: '#6b7789',
  600: '#4f5a6b',
  700: '#3a4455',
  800: '#252d3a',
  900: '#151b26',
} as const;

/** Status colours (form errors, approvals, alerts). Each passes WCAG AA (≥ 4.5:1) as text on white. */
export const status = {
  success: '#1f7a37',
  warning: '#a35a00',
  error: '#c62828',
  info: '#0b62b8',
} as const;

/**
 * Dark colour scheme. Every foreground passes WCAG AA (≥ 4.5:1) on `paper` and `background`; filled
 * buttons use dark text (`onAccent`) on the lighter accents.
 */
export const dark = {
  background: '#10151d',
  paper: '#171e29',
  divider: '#2a3342',
  textPrimary: '#e6ebf2',
  textSecondary: '#a7b1c2',
  textDisabled: '#6b7789',
  primary: '#7aa7f7',
  secondary: '#5cc176',
  success: '#5cc977',
  warning: '#f0a640',
  error: '#f07575',
  info: '#62b0f2',
  onAccent: '#0b1424',
} as const;

export const fontFamily = {
  /** Latin UI text; Arabic glyphs fall back to IBM Plex Sans Arabic. Both self-hosted (@fontsource). */
  latin: '"Inter Variable", "IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  /** Arabic UI text; Plex Arabic also contains Latin glyphs for mixed content. */
  arabic: '"IBM Plex Sans Arabic", "Inter Variable", system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif',
} as const;

/** Type scale (px). Admin screens favour compact, highly legible sizes. */
export const fontSize = {
  caption: 12,
  body2: 13,
  body1: 14,
  subtitle: 15,
  h6: 16,
  h5: 18,
  h4: 20,
  h3: 24,
  h2: 28,
  h1: 32,
} as const;

/**
 * Chart colours (Apache ECharts takes real colour values, not CSS variables). Every series colour has
 * ≥ 3:1 contrast with its scheme's `paper` background (WCAG non-text contrast). `reference` is for
 * comparison series (e.g. previous year), drawn dashed.
 */
export const chartColors = {
  light: {
    blue: '#1456c8',
    green: '#24843d',
    amber: '#b86e00',
    red: '#c62828',
    slate: '#6b7789',
    teal: '#0f7b8a',
    purple: '#6a4fc3',
    reference: '#6b7789',
    text: neutral[700],
    mutedText: neutral[600],
    axisLine: neutral[300],
    splitLine: neutral[200],
    tooltipBackground: neutral[0],
    tooltipBorder: neutral[200],
    surface: neutral[0],
  },
  dark: {
    blue: dark.primary,
    green: dark.secondary,
    amber: dark.warning,
    red: dark.error,
    slate: dark.textSecondary,
    teal: '#4fc3cf',
    purple: '#a993f0',
    reference: '#6b7789',
    text: dark.textPrimary,
    mutedText: dark.textSecondary,
    axisLine: '#3a4455',
    splitLine: dark.divider,
    tooltipBackground: dark.paper,
    tooltipBorder: dark.divider,
    surface: dark.paper,
  },
} as const;

/** Base spacing unit (px): `theme.spacing(2)` = 16px. */
export const spacingUnit = 8;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export const shadows = {
  /** Resting surfaces (cards, panels). */
  sm: '0 1px 2px rgba(21, 27, 38, 0.06), 0 1px 3px rgba(21, 27, 38, 0.08)',
  /** Raised surfaces (menus, popovers). */
  md: '0 4px 12px rgba(21, 27, 38, 0.10)',
  /** Overlays (dialogs, drawers). */
  lg: '0 12px 32px rgba(21, 27, 38, 0.16)',
} as const;

/** Breakpoints (px): phone < 600 ≤ tablet < 900 ≤ laptop < 1200 ≤ desktop < 1536 ≤ wide. */
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
} as const;
