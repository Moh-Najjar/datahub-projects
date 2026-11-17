import { useAuth } from '@/core/context/authContext';

/**
 * What the signed-in role may do in Organization Management, from the EXISTING permission matrix:
 * `organization:read` opens the module (router guard); `organization:write` shows create/edit/status/manager
 * actions. UI only — the backend must reject writes without `organization:write`.
 */
export function useOrganizationAccess() {
  const { can } = useAuth();
  return { canManage: can('organization:write') };
}
