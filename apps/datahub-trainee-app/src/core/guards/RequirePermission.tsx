import type { ReactNode } from 'react';
import { useAuth } from '@/core/auth/authContext';
import type { TrainingPermission } from '@/core/auth/trainingPolicy';

interface RequirePermissionProps {
  /** Allowed when the user holds ANY of these business permissions. */
  anyOf: readonly TrainingPermission[];
  /** What to show instead (the access-denied page; passed in because core never imports modules). */
  fallback: ReactNode;
  children: ReactNode;
}

/** Protects a route by business permission, so a manually typed URL cannot open an unauthorized page. UI only. */
export function RequirePermission({ anyOf, fallback, children }: RequirePermissionProps) {
  const { can } = useAuth();
  return anyOf.some(can) ? children : fallback;
}
