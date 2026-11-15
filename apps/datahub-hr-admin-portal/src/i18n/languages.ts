import type { Direction, Locale } from '@datahub/shared-types';

/** Shared with the other DataHub apps (types only). */
export type { Direction, Locale } from '@datahub/shared-types';

export const LANGUAGES = ['en', 'ar'] as const satisfies readonly Locale[];

/** English by default; Arabic is available from the language switch. */
export const DEFAULT_LANGUAGE: Locale = 'en';

export const LANGUAGE_DIRECTION: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};

/**
 * BCP 47 tags used for number and date formatting. Arabic keeps Latin digits (0–9) in tables and IDs
 * (`-u-nu-latn`), as agreed for this product; English uses day/month/year dates.
 */
export const FORMAT_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  ar: 'ar-JO-u-nu-latn',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ar';
}
