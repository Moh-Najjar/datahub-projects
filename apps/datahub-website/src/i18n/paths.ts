import { DEFAULT_LOCALE, type Locale } from './languages';

/** URL prefix for each locale. English lives at the root, Arabic under `/ar`. */
const PREFIX: Record<Locale, string> = { en: '', ar: '/ar' };

const isExternal = (href: string) => /^(https?:|mailto:|tel:|#)/.test(href);

/** Returns the locale encoded in a pathname. */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/ar' || pathname.startsWith('/ar/') ? 'ar' : DEFAULT_LOCALE;
}

/** Removes the locale prefix: `/ar/about-us/` → `/about-us/`. */
export function stripLocale(pathname: string): string {
  if (localeFromPath(pathname) === 'ar') {
    const rest = pathname.slice(3);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname;
}

/** Prefixes an internal, locale-neutral path for the given locale. */
export function localizePath(href: string, locale: Locale): string {
  if (isExternal(href)) return href;
  const prefix = PREFIX[locale];
  if (!prefix) return href;
  return href === '/' ? `${prefix}/` : `${prefix}${href}`;
}
