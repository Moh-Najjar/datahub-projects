import type { Localized } from './languages';
import ar from './locales/ar.json';
import en from './locales/en.json';

/**
 * Interface strings shared across the site (header, footer, form, buttons).
 * Page-specific copy lives in `src/content` (generated) and `modules/home/data`.
 */
export interface UiStrings {
  siteName: string;
  skipToContent: string;
  openMenu: string;
  closeMenu: string;
  toggleSubmenu: string;
  languageName: string;
  /** Label used in the footer language bar, e.g. "العربية (Arabic)". */
  languageBarLabel: string;
  consultation: {
    heading: string;
    callLabel: string;
    emailLabel: string;
  };
  appointment: {
    title: string;
    description: string;
    name: string;
    email: string;
    inquiry: string;
    inquiryOptions: string[];
    submit: string;
    sending: string;
  };
  validation: {
    required: string;
    email: string;
    summary: string;
  };
  submission: {
    notConfigured: string;
    success: string;
    failure: string;
  };
  footer: {
    connect: string;
    phone: string;
    copyright: string;
  };
  readMore: string;
  viewAll: string;
  discoverNow: string;
  playVideo: string;
  closeVideo: string;
  notFound: {
    title: string;
    text: string;
    backHome: string;
  };
  /** Products page (DataHub's own copy, not from the original site). */
  products: {
    title: string;
    breadcrumbHome: string;
    introHeading: string;
    introText: string;
    status: {
      available: string;
      inDevelopment: string;
      comingSoon: string;
    };
    loading: string;
    error: string;
  };
}

/** Interface strings per locale. The values live in `locales/en.json` and `locales/ar.json`. */
export const UI: Localized<UiStrings> = { en, ar };
