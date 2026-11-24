import { useMemo, useState, type ReactNode } from 'react';
import { BreadcrumbContext, type BreadcrumbContextValue } from './breadcrumbContext';

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [tail, setTail] = useState<string | undefined>();
  const value = useMemo<BreadcrumbContextValue>(() => ({ tail, setTail }), [tail]);
  return <BreadcrumbContext value={value}>{children}</BreadcrumbContext>;
}
