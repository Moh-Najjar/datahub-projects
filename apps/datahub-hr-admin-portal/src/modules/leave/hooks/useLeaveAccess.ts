import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { LeaveScope } from '@/modules/leave/types/leave';

/**
 * What the signed-in role may do in Leave, from the EXISTING permission matrix:
 * - `leave:read` → whole organization; `leave:read:team` → own team (Department Manager); `leave:read:own` (every
 *   role's self-service) → own requests and balances only ("My leave");
 * - `leave:request` → submit own requests (no permission exists to request on behalf of someone else);
 * - `leave:approve` / `leave:approve:team` → decide requests (organization / team), never one's own;
 * - `leave:manage-policies` → create, edit, activate and deactivate leave types.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useLeaveAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: LeaveScope['kind'] = can('leave:read') ? 'organization' : can('leave:read:team') ? 'team' : 'own';
  const scope = useMemo<LeaveScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    /** Overview, all requests, balances, calendar and reports beyond the user's own leave. */
    canReadBeyondOwn: kind !== 'own',
    canRequest: can('leave:request'),
    canApprove: can('leave:approve') || can('leave:approve:team'),
    canManagePolicies: can('leave:manage-policies'),
  };
}
