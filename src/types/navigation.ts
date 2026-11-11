import type { Locale } from '@/i18n/types';

export interface NavLink {
  label: string;
  /** Locale-neutral internal path, or an absolute external URL. */
  href: string;
  /**
   * Pin the link to a specific locale. The original's Arabic menu, for example,
   * links to English-only pages (Our Work Culture).
   */
  locale?: Locale;
}

export interface NavColumn {
  title: string;
  links: NavLink[];
  more: NavLink;
}

export type NavItem =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'dropdown'; label: string; href?: string; items: NavLink[] }
  | { kind: 'mega'; label: string; columns: NavColumn[] };
