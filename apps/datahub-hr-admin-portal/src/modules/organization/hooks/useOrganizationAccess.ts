import { useAuth } from '@/core/context/authContext';

/**
 * What the signed-in role may do in Organization Management, from the EXISTING permission matrix:
 * `organization.departments.view` opens the module (router guard); `organization.departments.manage` shows create/edit/status/manager
 * actions. UI only — the backend must reject writes without `organization.departments.manage`.
 */
export function useOrganizationAccess() {
  const { can } = useAuth();
  return { canManage: can('organization.departments.manage') };
}
