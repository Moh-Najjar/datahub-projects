/**
 * @datahub/shared-i18n — translation resources shared by DataHub applications (English + Arabic).
 *
 * This package only provides *resources* and a framework-free lookup. Each app keeps its own
 * platform integration (React context on the web, expo-localization + I18nManager on mobile).
 *
 * Conventions:
 * - Every key exists in both languages (enforced by the `Messages` type).
 * - Keep shared resources to strings that are genuinely common to several apps;
 *   app-specific copy stays in the app.
 * - Write layout-neutral text: direction (LTR/RTL) is handled by the app, never with
 *   embedded control characters.
 */
import type { Locale, Localized } from '@datahub/shared-types';

export interface Messages {
  /** Language names, written in their own language (for language switchers). */
  language: Localized<string>;
  organization: {
    name: string;
  };
}

export const messages: Localized<Messages> = {
  en: {
    language: { en: 'English', ar: 'العربية' },
    organization: { name: 'Datahub Analytics' },
  },
  ar: {
    language: { en: 'English', ar: 'العربية' },
    organization: { name: 'داتا هب أناليتكس' },
  },
};

/** Messages for a locale. */
export const getMessages = (locale: Locale): Messages => messages[locale];
