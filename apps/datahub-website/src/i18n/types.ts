import type { Direction, Locale } from '@datahub/shared-types';

/** Shared with the other DataHub apps (types only). */
export type { Direction, Locale, Localized } from '@datahub/shared-types';

export const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};
