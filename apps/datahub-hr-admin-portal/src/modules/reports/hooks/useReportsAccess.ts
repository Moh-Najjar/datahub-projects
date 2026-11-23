import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { ReportsCaller } from '@/modules/reports/types/reports';
import { reportAccess } from '@/modules/reports/utils/access';

/**
 * The signed-in user's reporting access (tabs, categories, scopes), derived from the permission matrix. UI only — the
 * reports API applies the same rules on every call and the real backend must derive them from the token.
 */
export function useReportsAccess() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const caller = useMemo<ReportsCaller>(() => ({ userId, role }), [userId, role]);
  const access = useMemo(() => reportAccess(caller), [caller]);
  return { caller, access };
}
