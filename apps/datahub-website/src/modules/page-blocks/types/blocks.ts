/**
 * Page documents generated from the original site's WPBakery markup by
 * `scripts/convert-pages.ts`. Rendered by `src/components/blocks`.
 *
 * Styles are the original's *computed* styles captured at three viewport widths:
 * `xl` (1440px), `md` (800px) and `xs` (390px). `md`/`xs` only contain values that differ.
 */
import type { RichText } from '@/core/types/content';

export type StyleMap = Record<string, string>;

export interface Responsive {
  xl: StyleMap;
  md?: StyleMap;
  xs?: StyleMap;
}

export interface ImageRef {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Separator {
  position: 'top' | 'bottom';
  viewBox: string;
  paths: string[];
  color: string;
  height: Responsive;
  /** Mirrored horizontally (WPBakery "flip" option). */
  flip?: boolean;
}

export interface RowNode {
  kind: 'row';
  /** Original element id (useful for debugging against the live site). */
  id?: string;
  /** Anchor id kept from the original (e.g. `industry-section-gov`). */
  anchor?: string;
  fullWidth: boolean;
  /** Stretch content to the full width (WPBakery "stretch row and content"). */
  stretchContent: boolean;
  style: Responsive;
  overlay?: Responsive;
  separators: Separator[];
  /** Columns are vertically centred / equal height. */
  align?: 'middle' | 'bottom' | 'stretch';
  /** Theme helper class "section-half-bg-01" (tinted left half). */
  halfBg?: boolean;
  columns: ColumnNode[];
}

/** Column widths in a 12-column grid per breakpoint (WPBakery sm/md/lg → 768/992/1200px). */
export interface ColumnWidths {
  xs?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface ColumnNode {
  kind: 'column';
  width: ColumnWidths;
  offset?: ColumnWidths;
  style: Responsive;
  children: Node[];
}

export type Node = RowNode | Block;

export interface TextStyle {
  style: Responsive;
}

export interface ButtonData {
  label: string;
  href?: string;
  variant: 'flat' | 'text' | 'outline' | 'gradient';
  icon?: 'arrow' | 'phone' | 'map' | 'download' | null;
  iconPosition?: 'left' | 'right';
  style: Responsive;
  newTab?: boolean;
}

export type Block =
  | { kind: 'spacer'; height: Responsive }
  | { kind: 'heading'; tag: string; text: RichText; style: Responsive; markStyle?: Responsive; link?: string }
  | { kind: 'text'; html: string; style: Responsive }
  | { kind: 'buttons'; buttons: ButtonData[]; align: string }
  | { kind: 'image'; image: ImageRef; href?: string; style: Responsive; imageStyle: Responsive; caption?: string }
  | {
      kind: 'box';
      variant: string;
      href?: string;
      image?: ImageRef;
      svg?: string;
      icon?: string;
      heading?: RichText;
      subHeading?: string;
      /** Sanitized HTML of the box text (paragraphs, bold). */
      textHtml?: string;
      button?: ButtonData;
      style: Responsive;
      parts: Record<string, Responsive>;
    }
  | {
      kind: 'list';
      variant: string;
      items: Array<{ title?: string; text?: string; href?: string; number?: string }>;
      style: Responsive;
      /** Grid columns when the list is laid out in columns. */
      columns?: Responsive;
      parts: Record<string, Responsive>;
    }
  | { kind: 'accordion'; items: Array<{ title: string; html: string }>; style: Responsive; parts: Record<string, Responsive> }
  | { kind: 'tabs'; tabs: Array<{ title: string; children: Node[] }>; parts: Record<string, Responsive> }
  | { kind: 'counter'; value: number; prefix: string; suffix: string; label: string; parts: Record<string, Responsive> }
  | { kind: 'grid'; columns: Responsive; gap: Responsive; children: Block[] }
  | { kind: 'slider'; perView: { xs: number; sm: number; md: number; lg: number }; autoplay: number; children: Block[] }
  | { kind: 'gallery'; images: ImageRef[]; columns: Responsive; gap: Responsive }
  | { kind: 'clients'; images: ImageRef[]; perView: { xs: number; sm: number; md: number; lg: number }; autoplay: number }
  | { kind: 'video'; poster: ImageRef; videoUrl: string }
  | { kind: 'gradation'; items: Array<{ heading: string; text: string }>; parts: Record<string, Responsive> }
  | { kind: 'separator'; style: Responsive }
  | { kind: 'blogGrid' }
  | {
      kind: 'contactForm';
      namePlaceholder?: string;
      emailPlaceholder?: string;
      messagePlaceholder?: string;
      inquiryPlaceholder?: string;
      inquiryOptions?: string[];
      submitLabel?: string;
      submitStyle?: Responsive;
    }
  | { kind: 'map'; label: string; /** Google Maps embed URL from the original. */ embedUrl: string; style: Responsive }
  | { kind: 'html'; html: string; style: Responsive };

export interface PageDocument {
  routeKey: string;
  locale: 'en' | 'ar';
  /** Source URL the document was generated from. */
  source: string;
  generatedAt: string;
  /** Theme page-title bar, on pages without a WPBakery hero (e.g. Careers). */
  titleBar?: { title: string; crumbs: Array<{ label: string; href?: string }> };
  rows: RowNode[];
}
