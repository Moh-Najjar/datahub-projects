import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { stripLocale } from '@/i18n/paths';

const normalize = (p: string) => (p.endsWith('/') ? p : `${p}/`);

/**
 * Returns a predicate telling whether a locale-neutral href points at the current page.
 * Hash fragments and external URLs never count as active.
 */
export function useIsActive() {
  const { pathname } = useLocation();
  const current = normalize(stripLocale(pathname));

  return useCallback(
    (href: string | undefined) => {
      if (!href || !href.startsWith('/') || href.includes('#')) return false;
      return normalize(href) === current;
    },
    [current],
  );
}
