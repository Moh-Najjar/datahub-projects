import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { PerformanceScope } from '@/modules/performance/types/performance';

/**
 * What the signed-in role may do in Performance (permission matrix):
 * - `performance:read` → organization; `performance:read:team` → the Department Manager's team (+ own);
 *   `performance:read:own` (every role) → own goals, self-assessments, results and development plans;
 * - `performance:write` → goals, plans, manager reviews and reopening (organization);
 *   `performance:review:team` → the same for the user's team;
 * - `performance:manage-config` → cycles, templates, competencies and the rating scale.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function usePerformanceAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: PerformanceScope['kind'] = can('performance:read') ? 'organization' : can('performance:read:team') ? 'team' : 'own';
  const scope = useMemo<PerformanceScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    canReadBeyondOwn: kind !== 'own',
    /** Write goals, plans and manager reviews (organization or team). */
    canManage: can('performance:write') || can('performance:review:team'),
    canReopen: can('performance:write'),
    canConfigure: can('performance:manage-config'),
    canReadOrganization: can('organization:read'),
  };
}
