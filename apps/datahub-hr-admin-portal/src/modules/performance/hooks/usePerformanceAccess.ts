import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { PerformanceScope } from '@/modules/performance/types/performance';

/**
 * What the signed-in role may do in Performance (permission matrix):
 * - `hr.performance.view` → organization; `hr.performance.view.team` → the Department Manager's team (+ own);
 *   `hr.performance.view.own` (every role) → own goals, self-assessments, results and development plans;
 * - `hr.performance.manage` → goals, plans, manager reviews and reopening (organization);
 *   `hr.performance.review.team` → the same for the user's team;
 * - `hr.performance.config.manage` → cycles, templates, competencies and the rating scale.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function usePerformanceAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: PerformanceScope['kind'] = can('hr.performance.view') ? 'organization' : can('hr.performance.view.team') ? 'team' : 'own';
  const scope = useMemo<PerformanceScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    canReadBeyondOwn: kind !== 'own',
    /** Write goals, plans and manager reviews (organization or team). */
    canManage: can('hr.performance.manage') || can('hr.performance.review.team'),
    canReopen: can('hr.performance.manage'),
    canConfigure: can('hr.performance.config.manage'),
    canReadOrganization: can('organization.departments.view'),
  };
}
