import '@mui/material/styles';
import '@mui/material/Button';

/** Extra palette entries used by the DataHub theme. */
interface BrandPalette {
  dark: string;
  darkAlt: string;
  green: string;
  greenBright: string;
  heading: string;
  link: string;
  muted: string;
  subtitle: string;
  submenu: string;
  footer: string;
  footerLink: string;
  bgSoft: string;
  bgPanel: string;
  bgInput: string;
  border: string;
  gradient: string;
  gradientButton: string;
}

interface CustomShadows {
  card: string;
  submenu: string;
  mega: string;
  stickyHeader: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    brand: BrandPalette;
  }
  interface PaletteOptions {
    brand?: BrandPalette;
  }
  interface Theme {
    customShadows: CustomShadows;
  }
  interface ThemeOptions {
    customShadows?: CustomShadows;
  }
  interface BreakpointOverrides {
    xs: true;
    sm: true;
    md: true;
    lg: true;
    xl: true;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    /** Mitech flat button (#0f56d5 → #004493). */
    solid: true;
    /** WPBakery green → blue gradient button. */
    gradient: true;
    /** "View All →" text link. */
    textArrow: true;
    /** White shadowed pill with an icon (industries). */
    pill: true;
  }
}
