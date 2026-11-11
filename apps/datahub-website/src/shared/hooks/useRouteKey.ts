import { useMatches } from 'react-router-dom';
import type { RouteHandle } from '@/i18n/useAlternateHref';
import type { RouteKey } from '@/shared/config/routes';

/** `handle` of every page route (set by the router). */
export interface PageHandle extends RouteHandle {
  routeKey: RouteKey;
}

/** Route key of the deepest matched page route (set in the router's `handle`). */
export function useRouteKey(): RouteKey | undefined {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle as PageHandle | undefined;
    if (handle?.routeKey) return handle.routeKey;
  }
  return undefined;
}
