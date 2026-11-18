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
  /**
   * DataHub Workspace (central staff sign-in + application launcher; DataHub's own copy). `{name}`-style placeholders
   * are filled with `fill()` from `@/i18n`.
   */
  workspace: {
    name: string;
    pageTitle: string;
    switchLanguage: string;
    login: {
      title: string;
      subtitle: string;
      prototype: string;
      username: string;
      password: string;
      showPassword: string;
      hidePassword: string;
      submit: string;
      submitting: string;
      usernameRequired: string;
      passwordRequired: string;
      invalid: string;
      generic: string;
      signInRequired: string;
      signedOut: string;
      demoTitle: string;
      demoHint: string;
      backToSite: string;
    };
    home: {
      title: string;
      subtitle: string;
      open: string;
      empty: string;
      accessDenied: string;
      sessionNote: string;
    };
    header: {
      signOut: string;
      viewSite: string;
    };
    apps: Record<'hr-admin' | 'blogs-admin', { name: string; description: string }>;
    roles: Record<'system-admin' | 'hr-admin' | 'hr-manager' | 'department-manager' | 'employee' | 'recruiter' | 'payroll-officer' | 'blogs-admin', string>;
  };
}

/** Fills `{key}` placeholders: `fill('Hello {name}', { name: 'Sam' })`. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Interface strings per locale. The values live in `locales/en.json` and `locales/ar.json`. */
export const UI: Localized<UiStrings> = { en, ar };
