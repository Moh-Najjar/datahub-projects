import { createTheme, type Theme } from '@mui/material/styles';
import type { Direction } from '@/i18n/languages';
import { colors, easing, fonts, gradients, layout, shadows } from './tokens';

/** Self-hosted Satoshi (Indian Type Foundry, ITF Free Font License) — see scripts/download-assets.ts. */
const fontFaces = [300, 400, 500, 700, 900]
  .map(
    (weight) => `
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/satoshi/Satoshi-${weight}.woff2') format('woff2');
  font-weight: ${weight === 700 ? '600 700' : weight};
  font-style: normal;
  font-display: swap;
}`,
  )
  .join('\n');

const heading = { fontWeight: 400, lineHeight: 1.42, color: colors.heading } as const;

/**
 * Builds the application theme for a text direction.
 * Values mirror the original Mitech/Kirki configuration of datahubanalytics.com.
 */
export function createAppTheme(direction: Direction): Theme {
  const fontFamily = direction === 'rtl' ? fonts.arabic : fonts.sans;

  return createTheme({
    direction,
    // The original theme's Bootstrap grid breakpoints; desktop menu from `xl`.
    breakpoints: { values: { xs: 0, sm: 544, md: 768, lg: 992, xl: 1200 } },
    // Spacing scale of 5px — the original's spacings are multiples of 5.
    spacing: 5,
    shape: { borderRadius: layout.radius },
    palette: {
      mode: 'light',
      primary: { main: colors.button, dark: colors.brandDark, contrastText: colors.white },
      secondary: { main: colors.green, contrastText: colors.white },
      info: { main: colors.primary },
      text: { primary: colors.text, secondary: colors.muted },
      background: { default: colors.white, paper: colors.white },
      divider: colors.border,
      brand: {
        dark: colors.brandDark,
        darkAlt: colors.brandDarkAlt,
        green: colors.green,
        greenBright: colors.greenBright,
        heading: colors.heading,
        link: colors.link,
        muted: colors.muted,
        subtitle: colors.subtitle,
        submenu: colors.submenu,
        footer: colors.footer,
        footerLink: colors.footerLink,
        bgSoft: colors.bgSoft,
        bgPanel: colors.bgPanel,
        bgInput: colors.bgInput,
        border: colors.border,
        gradient: gradients.brand,
        gradientButton: gradients.button,
      },
    },
    customShadows: shadows,
    typography: {
      fontFamily,
      fontSize: 15,
      htmlFontSize: 16,
      body1: { fontSize: 15, lineHeight: 1.74 },
      body2: { fontSize: 14, lineHeight: 1.74 },
      h1: { ...heading, fontSize: 48 },
      h2: { ...heading, fontSize: 42 },
      h3: { ...heading, fontSize: 32 },
      h4: { ...heading, fontSize: 24 },
      h5: { ...heading, fontSize: 18 },
      h6: { ...heading, fontSize: 14 },
      button: { fontSize: 14, fontWeight: 400, textTransform: 'none', lineHeight: 1 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
${fontFaces}
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; overflow-x: clip; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { font-size: 15px; line-height: 1.74; color: ${colors.text}; overflow-x: clip; }
${direction === 'rtl' ? `body, h1, h2, h3, h4, h5, h6, a, p, button, input, select, textarea { font-family: ${fonts.arabic}; letter-spacing: 0; }` : ''}
h1, h2, h3, h4, h5, h6 { margin: 0; font-weight: 400; line-height: 1.42; color: ${colors.heading}; }
p { margin: 0; }
b, strong { font-weight: 700; }
ul, ol { margin: 0; padding: 0; list-style: none; }
img, svg, video { display: block; max-width: 100%; }
img { height: auto; }
a { color: ${colors.link}; text-decoration: none; transition: all 0.25s ${easing.standard}; }
a:hover, a:focus-visible { color: ${colors.primary}; }
mark { background: none; color: ${colors.brandDark}; }
button { font: inherit; }
:focus-visible { outline: 2px solid ${colors.primary}; outline-offset: 2px; }
::selection { background: ${colors.primary}; color: ${colors.white}; }
`,
      },
      MuiContainer: {
        defaultProps: { maxWidth: 'xl' },
        styleOverrides: {
          root: {
            paddingLeft: layout.gutter,
            paddingRight: layout.gutter,
            '@media (min-width: 544px)': { paddingLeft: layout.gutter, paddingRight: layout.gutter },
          },
          maxWidthXl: { '@media (min-width: 1200px)': { maxWidth: layout.containerWidth } },
        },
      },
      MuiButtonBase: {
        defaultProps: { disableRipple: true },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: layout.radius,
            minWidth: 0,
            fontSize: 14,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            transition: `all 0.25s ${easing.standard}`,
            '&:hover': { textDecoration: 'none' },
          },
        },
        variants: [
          {
            props: { variant: 'solid' },
            style: {
              height: 56,
              padding: '0 36px',
              color: colors.white,
              backgroundColor: colors.button,
              border: `1px solid ${colors.button}`,
              '&:hover, &:focus-visible': { color: colors.white, backgroundColor: colors.brandDark, borderColor: colors.brandDark },
            },
          },
          {
            props: { variant: 'gradient' },
            style: {
              padding: '14px 20px',
              color: colors.white,
              backgroundColor: colors.greenBright,
              backgroundImage: gradients.button,
              backgroundSize: '200% 100%',
              transition: 'all .2s ease-in-out',
              '&:hover, &:focus-visible': { color: colors.white, backgroundColor: colors.brandDarkAlt, backgroundPosition: '100% 0' },
            },
          },
          {
            props: { variant: 'textArrow' },
            style: {
              padding: 0,
              gap: 8,
              fontWeight: 500,
              color: colors.brandDark,
              borderRadius: 0,
              '&:hover, &:focus-visible': { color: colors.primary, backgroundColor: 'transparent' },
              '& .MuiButton-endIcon': { margin: 0, transition: `transform .3s ${easing.theme}` },
              '&:hover .MuiButton-endIcon': { transform: 'translateX(4px)' },
            },
          },
          {
            props: { variant: 'pill' },
            style: {
              height: 48,
              padding: '0 30px',
              fontWeight: 500,
              color: colors.heading,
              backgroundColor: colors.white,
              boxShadow: shadows.card,
              '& .MuiButton-startIcon': { margin: 0, marginRight: 14 },
              '&:hover, &:focus-visible': { color: colors.white, backgroundColor: colors.brandDark },
            },
          },
        ],
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { border: 0 } },
      },
    },
  });
}
