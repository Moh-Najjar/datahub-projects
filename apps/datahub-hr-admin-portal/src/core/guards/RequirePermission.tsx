import type { ReactNode } from 'react';
import type { Permission } from '@/core/config/permissions';
import { useAuth } from '@/core/context/authContext';

/**
 * Renders `children` only if the user has ANY of `anyOf`; otherwise `fallback` (the router passes the
 * access-denied page). This hides UI — it does not protect data; the backend must refuse the request too.
 */
export function RequirePermission({ anyOf, fallback, children }: { anyOf: readonly Permission[]; fallback: ReactNode; children: ReactNode }) {
  const { canAny } = useAuth();
  return canAny(anyOf) ? children : fallback;
}
