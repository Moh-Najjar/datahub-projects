import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import arAuth from './locales/ar/auth.json';
import arCommon from './locales/ar/common.json';
import arDashboard from './locales/ar/dashboard.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import { DEFAULT_LANGUAGE, isLocale, LANGUAGE_DIRECTION, LANGUAGES, type Locale } from './languages';

/*
 * i18next setup. Translations are bundled (no network requests), one namespace per module:
 * `locales/<lang>/<namespace>.json`. Add a namespace here and in `i18next.d.ts` when a module needs one.
 */
export const resources = {
  en: { common: enCommon, auth: enAuth, dashboard: enDashboard },
  ar: { common: arCommon, auth: arAuth, dashboard: arDashboard },
} as const;

export const NAMESPACES = ['common', 'auth', 'dashboard'] as const;

const STORAGE_KEY = 'datahub-hr-admin.language';

/** Saved choice, if any. Storage can be unavailable (private mode, blocked site data). */
function readStoredLanguage(): Locale | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function applyDocumentLanguage(language: Locale) {
  document.documentElement.lang = language;
  document.documentElement.dir = LANGUAGE_DIRECTION[language];
}

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage() ?? DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  ns: NAMESPACES,
  defaultNS: 'common',
  // Resources are bundled, so initialise synchronously: the first render already has translations.
  initAsync: false,
  interpolation: { escapeValue: false }, // React escapes output.
});

applyDocumentLanguage(currentLanguage());
i18n.on('languageChanged', (language) => {
  if (isLocale(language)) applyDocumentLanguage(language);
});

/** The active language, normalised to a supported `Locale`. */
export function currentLanguage(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

/** Switch language, remember the choice and update `<html lang dir>`. */
export async function changeLanguage(language: Locale): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The choice just won't persist across reloads.
  }
  await i18n.changeLanguage(language);
}

export default i18n;
