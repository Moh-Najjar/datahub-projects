import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { LeaveScope } from '@/modules/leave/types/leave';

/**
 * What the signed-in role may do in Leave, from the EXISTING permission matrix:
 * - `hr.leave.view` → whole organization; `hr.leave.view.team` → own team (Department Manager); `hr.leave.view.own` (every
 *   role's self-service) → own requests and balances only ("My leave");
 * - `hr.leave.request` → submit own requests (no permission exists to request on behalf of someone else);
 * - `hr.leave.approve` / `hr.leave.approve.team` → decide requests (organization / team), never one's own;
 * - `hr.policies.manage` → create, edit, activate and deactivate leave types.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useLeaveAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: LeaveScope['kind'] = can('hr.leave.view') ? 'organization' : can('hr.leave.view.team') ? 'team' : 'own';
  const scope = useMemo<LeaveScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    /** Overview, all requests, balances, calendar and reports beyond the user's own leave. */
    canReadBeyondOwn: kind !== 'own',
    canRequest: can('hr.leave.request'),
    canApprove: can('hr.leave.approve') || can('hr.leave.approve.team'),
    canManagePolicies: can('hr.policies.manage'),
  };
}
