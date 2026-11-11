import { getLocales } from 'expo-localization';
import type { Direction, Locale } from '@datahub/shared-types';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_DIRECTION: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' };

/**
 * The device's preferred supported language (Arabic or English).
 *
 * Layout direction follows the device automatically: `supportsRTL` in app.json lets React Native
 * mirror the UI when the device language is RTL. An in-app language switch (when it is built) must
 * call `I18nManager.forceRTL(isRtl)` and then reload the app — RN applies direction changes only on restart.
 */
export function getDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return SUPPORTED_LOCALES.find((l) => l === code) ?? DEFAULT_LOCALE;
}
