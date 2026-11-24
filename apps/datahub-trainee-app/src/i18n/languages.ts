import type { Direction, Locale } from '@datahub/shared-types';

/** Shared with the other DataHub apps (types only). */
export type { Direction, Locale, Localized } from '@datahub/shared-types';

export const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];

/** English is the default language. */
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};

/** Where the language choice is remembered (the URL carries no language: this app sits behind a sign-in). */
export const LOCALE_STORAGE_KEY = 'datahub-trainee.language';

export const isLocale = (value: unknown): value is Locale => (LOCALES as readonly unknown[]).includes(value);
