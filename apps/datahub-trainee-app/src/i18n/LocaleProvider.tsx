import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { LocaleContext, type LocaleContextValue } from './LocaleContext';
import { DEFAULT_LOCALE, LOCALE_DIRECTION, LOCALE_STORAGE_KEY, isLocale, type Locale } from './languages';

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

interface LocaleProviderProps {
  /** Forces the language (tests); otherwise the stored choice, else English. */
  initialLocale?: Locale;
  children: ReactNode;
}

/** Provides the active locale, remembers the user's choice and keeps `<html lang dir>` in sync with it. */
export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts until reload.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir: LOCALE_DIRECTION[locale], isRtl: LOCALE_DIRECTION[locale] === 'rtl', setLocale }),
    [locale, setLocale],
  );

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = value.dir;
  }, [locale, value.dir]);

  return <LocaleContext value={value}>{children}</LocaleContext>;
}
