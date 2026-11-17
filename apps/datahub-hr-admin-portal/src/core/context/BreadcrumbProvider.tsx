import { useMemo, useState, type ReactNode } from 'react';
import { BreadcrumbContext, type Crumb } from './breadcrumbContext';

/** Holds the extra breadcrumbs of the current page (see `useBreadcrumbs`). */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<readonly Crumb[]>([]);
  const value = useMemo(() => ({ trail, setTrail }), [trail]);
  return <BreadcrumbContext value={value}>{children}</BreadcrumbContext>;
}
