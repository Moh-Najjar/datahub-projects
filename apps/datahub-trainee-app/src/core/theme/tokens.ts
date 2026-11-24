/**
 * DataHub admin design tokens — the design language shared by the HR Admin Portal (the reference), the Trainee App and
 * Blogs Admin. Keep the three in step. The single source for colours, type, spacing, radius, shadows and
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

/** Cool slate neutrals: 50 = app canvas … 900 = primary text. */
export const neutral = {
  0: '#ffffff',
  50: '#f4f6f9',
  100: '#e8edf3',
  200: '#d5dde8',
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
  success: '#e6f4ea',
  warning: '#fff3df',
  error: '#fdecec',
  info: '#e6f1fb',
} as const;

/** Status colours (form errors, approvals, alerts). Each passes WCAG AA (≥ 4.5:1) as text on white. */
export const status = {
  success: '#1f7a37',
  warning: '#a35a00',
  error: '#c62828',
  info: '#0b62b8',
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

/** Modest radii: controls stay crisp; dialogs are only slightly softer. */
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export const shadows = {
  /** Resting cards. A hairline border does most of the work; the shadow only separates the surface. */
  sm: '0 1px 2px rgba(20, 27, 38, 0.04), 0 1px 1px rgba(20, 27, 38, 0.03)',
  /** Menus and popovers. */
  md: '0 8px 24px rgba(20, 27, 38, 0.10)',
  /** Dialogs and drawers. */
  lg: '0 18px 48px rgba(20, 27, 38, 0.16)',
} as const;

/** Shell dimensions in pixels. Content stays readable on wide monitors without stretching edge to edge. */
export const layout = {
  sidebar: 272,
  sidebarCollapsed: 76,
  header: 64,
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
