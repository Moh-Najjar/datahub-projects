import { createContext, use } from 'react';
import type { Direction, Locale, Localized } from './types';

export interface LocaleContextValue {
  locale: Locale;
  dir: Direction;
  isRtl: boolean;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = use(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>.');
  return ctx;
}

/** Picks the value for the active locale from a `Localized<T>` record. */
export function useLocalized<T>(value: Localized<T>): T {
  return value[useLocale().locale];
}
