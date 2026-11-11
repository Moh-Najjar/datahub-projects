import { useLocation, useMatches } from 'react-router-dom';
import { localizePath, stripLocale } from '@/i18n/paths';
import { LOCALES, type Locale } from '@/i18n/types';

export interface RouteHandle {
  /** Locales in which the original site publishes this page. */
  locales?: readonly Locale[];
}

/**
 * Where the language switcher should send the user for `target`.
 * Like WPML on the original: the same page when a translation exists,
 * otherwise the homepage of the target language.
 */
export function useAlternateHref() {
  const { pathname, hash } = useLocation();
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.locales)?.handle as
    | RouteHandle
    | undefined;
  const available = handle?.locales ?? LOCALES;
  const neutral = stripLocale(pathname);

  return (target: Locale) => (available.includes(target) ? localizePath(neutral, target) + hash : localizePath('/', target));
}
