import type { Locale } from '@/i18n/languages';

/** Countries offered for locations (ISO 3166-1 alpha-2). Display names come from the browser (`Intl.DisplayNames`). */
export const LOCATION_COUNTRIES = ['JO', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'EG', 'LB', 'IQ', 'PS', 'GB', 'US'] as const;

const cache = new Map<Locale, Intl.DisplayNames>();

/** Localized country name, falling back to the code. */
export function countryName(code: string, language: Locale): string {
  let names = cache.get(language);
  if (!names) {
    names = new Intl.DisplayNames([language], { type: 'region' });
    cache.set(language, names);
  }
  return names.of(code) ?? code;
}
