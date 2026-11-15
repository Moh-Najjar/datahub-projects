import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { LocaleContext, type LocaleContextValue } from './LocaleContext';
import { LOCALE_DIRECTION, type Locale } from './languages';

interface LocaleProviderProps {
  locale: Locale;
  children: ReactNode;
}

/** Provides the active locale and keeps `<html lang dir>` in sync with it. */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir: LOCALE_DIRECTION[locale], isRtl: LOCALE_DIRECTION[locale] === 'rtl' }),
    [locale],
  );

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = value.dir;
  }, [locale, value.dir]);

  return <LocaleContext value={value}>{children}</LocaleContext>;
}
