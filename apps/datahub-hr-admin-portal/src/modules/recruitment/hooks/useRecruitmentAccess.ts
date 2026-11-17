import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { RecruitmentScope } from '@/modules/recruitment/types/recruitment';

/**
 * What the signed-in role may do in Recruitment (permission matrix):
 * - `recruitment:read` → organization; `recruitment:read:team` → Department Manager's requisitions (read-only,
 *   no salaries or offers; they may submit their own interview feedback);
 * - `recruitment:write` → requisitions, candidates, pipeline, interviews and offers;
 * - `recruitment:write` + `employees:write` → convert a hired candidate into an employee.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useRecruitmentAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: RecruitmentScope['kind'] = can('recruitment:read') ? 'organization' : 'team';
  const scope = useMemo<RecruitmentScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    canManage: can('recruitment:write'),
    canSeeOffers: kind === 'organization',
    canConvert: can('recruitment:write') && can('employees:write'),
    /** Organization structure for filters / forms. */
    canReadOrganization: can('organization:read'),
  };
}
