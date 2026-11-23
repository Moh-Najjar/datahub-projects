import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { EmployeeScope } from '@/modules/employees/types/employee';

/**
 * What the signed-in role may do in Employee Management, from the EXISTING permission matrix:
 * - `organization.employees.view` → whole organization; `hr.employees.view.team` → own team only (Department Manager);
 * - `hr.employees.view.personal` → personal details and identity documents (the API returns `personal: null` otherwise);
 * - `organization.employees.manage` → create / edit / activate / deactivate;
 * - documents (the profile's Documents tab) come from Documents Management, with its own permissions.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useEmployeeAccess() {
  const { can, user } = useAuth();
  const orgWide = can('organization.employees.view');
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const scope = useMemo<EmployeeScope>(() => (orgWide ? { kind: 'organization', role } : { kind: 'team', userId, role }), [orgWide, userId, role]);
  return {
    scope,
    canManage: can('organization.employees.manage'),
    canReadPersonal: can('hr.employees.view.personal'),
  };
}
