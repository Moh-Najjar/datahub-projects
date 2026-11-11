export const LOCALES = ['en', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};

/** A value provided for every supported locale. */
export type Localized<T> = Record<Locale, T>;
