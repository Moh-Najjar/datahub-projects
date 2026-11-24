/**
 * DataHub admin design tokens (violet design language, shared by the HR Admin Portal, the Trainee App and Blogs Admin —
 * intentional copies, keep the three in step). The single source for colours, type, spacing, radius, shadows and
 * breakpoints. Use these through the MUI theme (`theme.palette`, `theme.spacing`, …), not by importing them in components
 * (charts excepted: `chartColors`, because Apache ECharts takes real colour values).
 */

export const brand = {
  /** Violet accent — 5.70:1 with white: safe for text and filled buttons. */
  violet: '#7c3aed',
  violetDark: '#5b21b6',
  /** Selected nav items, tonal chips, insight callouts. */
  violetLight: '#f1ebfe',
  /** DataHub brand green — 3.97:1 with white: decorative use and large text only. */
  green: '#2a9243',
  /** Accessible brand green (4.73:1 with white) for text and filled components. */
  greenDark: '#24843d',
  greenLight: '#e7f4ea',
} as const;

/** Categorical chart colours (bars, donut segments, legend dots). Always paired with text values. */
export const chart = ['#7c3aed', '#2563eb', '#059669', '#ea580c', '#4f46e5', '#0891b2'] as const;

/** Cool slate neutrals: 50 = app canvas … 900 = primary text. */
export const neutral = {
  0: '#ffffff',
  50: '#f6f6fa',
  100: '#ececf3',
  200: '#e2e2ec',
  300: '#c0c9d6',
  400: '#8e9aab',
  500: '#667386',
  600: '#4d596b',
  700: '#384454',
  800: '#232b38',
  900: '#141b26',
} as const;

/** Soft tints for tonal surfaces (icon tiles, avatars). */
export const tint = {
  success: '#e3f6ee',
  warning: '#fff1e6',
  error: '#fdecec',
  info: '#e8f0fe',
} as const;

/** Status colours (form errors, approvals, alerts). Each passes WCAG AA (≥ 4.5:1) as text on white. */
export const status = {
  success: '#047857',
  /** Orange: "needs action soon" (5.18:1 with white). */
  warning: '#c2410c',
  error: '#c62828',
  info: '#1d4ed8',
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

/**
 * Chart colours (Apache ECharts takes real colour values, not CSS variables). Every series colour has
 * ≥ 3:1 contrast with its scheme's `paper` background (WCAG non-text contrast). `reference` is for
 * comparison series (e.g. previous year), drawn dashed. `primary` = the violet accent (main series); the others are
 * categorical.
 */
export const chartColors = {
  light: {
    primary: '#7c3aed',
    green: '#24843d',
    amber: '#b86e00',
    red: '#c62828',
    slate: '#6b7789',
    teal: '#0f7b8a',
    blue: '#2563eb',
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
    primary: '#a78bfa',
    green: dark.secondary,
    amber: dark.warning,
    red: dark.error,
    slate: dark.textSecondary,
    teal: '#4fc3cf',
    blue: '#7aa7f7',
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

/** Base spacing unit (px): `theme.spacing(2)` = 16px. */
export const spacingUnit = 8;

/** Soft radii: controls 10px, cards 14px, dialogs 16px. */
export const radius = {
  sm: 8,
  md: 10,
  card: 14,
  lg: 16,
} as const;

export const shadows = {
  /** Resting cards. A hairline border does most of the work; the shadow only separates the surface. */
  sm: '0 1px 2px rgba(30, 20, 60, 0.03)',
  /** Menus and popovers. */
  md: '0 8px 24px rgba(20, 27, 38, 0.10)',
  /** Dialogs and drawers. */
  lg: '0 18px 48px rgba(20, 27, 38, 0.16)',
} as const;

/** Shell dimensions in pixels. Content stays readable on wide monitors without stretching edge to edge. */
export const layout = {
  sidebar: 240,
  sidebarCollapsed: 76,
  header: 68,
  contentMax: 1440,
} as const;

/** Interactive control heights (px). Touch targets stay at least 32px; primary actions are 40px. */
export const control = {
  sm: 32,
  md: 36,
  lg: 40,
} as const;

/** Breakpoints (px): phone < 600 ≤ tablet < 900 ≤ laptop < 1200 ≤ desktop < 1536 ≤ wide. */
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
} as const;
