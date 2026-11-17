import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { EmployeeScope } from '@/modules/employees/types/employee';

/**
 * What the signed-in role may do in Employee Management, from the EXISTING permission matrix:
 * - `employees:read` → whole organization; `employees:read:team` → own team only (Department Manager);
 * - `employees:read:personal` → personal details and identity documents (the API returns `personal: null` otherwise);
 * - `employees:write` → create / edit / activate / deactivate;
 * - `documents:read` / `documents:write` → the Documents tab / simulated upload.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useEmployeeAccess() {
  const { can, user } = useAuth();
  const orgWide = can('employees:read');
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const scope = useMemo<EmployeeScope>(() => (orgWide ? { kind: 'organization', role } : { kind: 'team', userId, role }), [orgWide, userId, role]);
  return {
    scope,
    canManage: can('employees:write'),
    canReadPersonal: can('employees:read:personal'),
    canReadDocuments: can('documents:read'),
    canUploadDocuments: can('documents:write'),
  };
}
