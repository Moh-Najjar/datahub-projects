/**
 * Blogs Admin design tokens — the DataHub admin design language (violet), intentional copies of the Trainee App's and the
 * HR Admin Portal's tokens: keep the three in step. Used only under /admin/ (the public site keeps its own tokens).
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
