import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { RecruitmentScope } from '@/modules/recruitment/types/recruitment';

/**
 * What the signed-in role may do in Recruitment (permission matrix):
 * - `recruitment.jobs.view` → organization; `hr.recruitment.view.team` → Department Manager's requisitions (read-only,
 *   no salaries or offers; they may submit their own interview feedback);
 * - `recruitment.jobs.manage` → requisitions, candidates, pipeline, interviews and offers;
 * - `recruitment.jobs.manage` + `organization.employees.manage` → convert a hired candidate into an employee.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useRecruitmentAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: RecruitmentScope['kind'] = can('recruitment.jobs.view') ? 'organization' : 'team';
  const scope = useMemo<RecruitmentScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    canManage: can('recruitment.jobs.manage'),
    canSeeOffers: kind === 'organization',
    canConvert: can('recruitment.jobs.manage') && can('organization.employees.manage'),
    /** Organization structure for filters / forms. */
    canReadOrganization: can('organization.departments.view'),
  };
}
