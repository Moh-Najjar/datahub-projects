import { createContext, use } from 'react';
import type { Direction, Locale } from './languages';

export interface LocaleContextValue {
  locale: Locale;
  dir: Direction;
  isRtl: boolean;
  setLocale: (locale: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = use(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>.');
  return ctx;
}
