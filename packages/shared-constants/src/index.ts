/**
 * @datahub/shared-constants — constants shared by DataHub applications.
 * Never put environment-specific values or secrets here (use each app's environment config).
 *
 * Constant sets are `as const` objects plus a derived union type rather than TypeScript `enum`s:
 * they are erasable (required by the website's `erasableSyntaxOnly`) and tree-shake well on every platform.
 */
import type { Direction, Locale } from '@datahub/shared-types';

/** Supported locales, in display order. */
export const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];

export const DEFAULT_LOCALE: Locale = 'en';

/** Text direction per locale. */
export const LOCALE_DIRECTION = {
  en: 'ltr',
  ar: 'rtl',
} as const satisfies Record<Locale, Direction>;

/** BCP 47 tags used with `Intl` APIs. Arabic keeps Latin digits, as the company's Arabic content does. */
export const INTL_LOCALE = {
  en: 'en-US',
  ar: 'ar-u-nu-latn',
} as const satisfies Record<Locale, string>;

/** The organisation behind all DataHub applications. */
export const ORGANIZATION = {
  name: 'Datahub Analytics',
  website: 'https://datahubanalytics.com',
} as const;
