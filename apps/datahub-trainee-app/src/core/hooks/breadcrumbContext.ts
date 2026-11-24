import { createContext, use, useEffect } from 'react';

/*
 * Breadcrumbs = Home › the navigation item of the current page › an optional detail label. Pages that show a record
 * (a training, a person) set the last label with `useBreadcrumbTail(name)` once they have loaded it.
 */

export interface BreadcrumbContextValue {
  tail: string | undefined;
  setTail: (label: string | undefined) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = use(BreadcrumbContext);
  if (!ctx) throw new Error('Breadcrumbs must be used inside <BreadcrumbProvider>.');
  return ctx;
}

/** Sets the last breadcrumb for as long as the calling page is mounted. */
export function useBreadcrumbTail(label: string | undefined): void {
  const { setTail } = useBreadcrumbContext();
  useEffect(() => {
    setTail(label);
    return () => setTail(undefined);
  }, [label, setTail]);
}
