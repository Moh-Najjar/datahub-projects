/**
 * Design tokens — every value was measured from the original site's computed styles
 * (Mitech theme, Kirki customizer output and per-element WPBakery CSS).
 */
export const colors = {
  primary: '#086ad8', // links on hover, accents
  button: '#0f56d5', // flat buttons, active nav item
  brandDark: '#004493', // <mark> highlights, hover backgrounds, wave separators
  brandDarkAlt: '#00469b',
  green: '#2a9243', // submenu bar, mobile menu, "110+"
  greenBright: '#36a829',
  text: '#696969',
  heading: '#333333',
  link: '#3d3d3d',
  muted: '#7e7e7e',
  subtitle: '#707070',
  menu: '#000000',
  submenu: '#757575',
  footerLink: '#ababab',
  white: '#ffffff',
  black: '#000000',
  bgSoft: '#f8f8f8',
  bgPanel: '#f6fafe',
  bgInput: '#f5f5f5',
  border: '#ededed',
  borderLight: '#eeeeee',
  footer: '#111d30',
} as const;

/*
 * Angles (90deg), not "to right": the RTL stylis plugin flips direction keywords, but the
 * original's Arabic pages keep these gradients green → blue from left to right.
 */
export const gradients = {
  /** Hero cards and active solutions tab. */
  brand: 'linear-gradient(90deg, #36a829, #00469b)',
  /** WPBakery "gradient-custom" button (sized 200% and slid on hover). */
  button: 'linear-gradient(90deg, #36a829 0%, #00469b 50%, #36a829 100%)',
} as const;

export const shadows = {
  card: '0 0 40px rgba(51, 51, 51, 0.1)',
  submenu: '0 2px 29px rgba(0, 0, 0, 0.05)',
  mega: '0 10px 37px rgba(0, 0, 0, 0.07)',
  stickyHeader: '0 8px 20px rgba(0, 0, 0, 0.1)',
} as const;

export const easing = {
  theme: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
  standard: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
} as const;

export const fonts = {
  sans: "'Satoshi', sans-serif",
  /** The original forces a system sans-serif for Arabic text. */
  arabic: 'sans-serif',
} as const;

export const layout = {
  containerWidth: 1200,
  gutter: 15,
  headerHeight: 81,
  radius: 5,
} as const;
