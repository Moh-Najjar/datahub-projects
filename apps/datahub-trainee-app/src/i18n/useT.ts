import { UI, type UiStrings } from './index';
import { useLocale } from './LocaleContext';

/** The interface strings of the active language. */
export function useT(): UiStrings {
  return UI[useLocale().locale];
}
