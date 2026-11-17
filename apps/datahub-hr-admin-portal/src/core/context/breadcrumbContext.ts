import { createContext, use, useEffect } from 'react';

/** One breadcrumb after the page's navigation item (e.g. Employees › Dana Yousef › Edit). */
export interface Crumb {
  label: string;
  /** Omit for the current page (the last crumb). */
  to?: string;
}

export interface BreadcrumbContextValue {
  trail: readonly Crumb[];
  setTrail: (trail: readonly Crumb[]) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue>({ trail: [], setTrail: () => undefined });

export function useBreadcrumbTrail(): readonly Crumb[] {
  return use(BreadcrumbContext).trail;
}

/**
 * Pages with sub-pages (details, edit) publish their extra breadcrumbs here; the trail is cleared when the
 * page unmounts. Pass a stable key (e.g. JSON of the labels) to avoid re-publishing identical trails.
 */
export function useBreadcrumbs(trail: readonly Crumb[]): void {
  const { setTrail } = use(BreadcrumbContext);
  const key = JSON.stringify(trail);
  useEffect(() => {
    setTrail(JSON.parse(key) as Crumb[]);
    return () => setTrail([]);
  }, [key, setTrail]);
}
