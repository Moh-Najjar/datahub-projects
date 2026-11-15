import { useTranslation } from 'react-i18next';
import { DEFAULT_LANGUAGE, isLocale, LANGUAGE_DIRECTION, type Direction, type Locale } from './languages';

/** The active language and its text direction; re-renders when the language changes. */
export function useLanguage(): { language: Locale; direction: Direction } {
  const { i18n } = useTranslation();
  const language = isLocale(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  return { language, direction: LANGUAGE_DIRECTION[language] };
}
