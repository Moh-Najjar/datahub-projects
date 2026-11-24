import { requirePermission } from '@/core/api/mock/access';
import type { DbEvaluation } from '@/core/api/mock/dbTypes';
import { db } from '@/core/api/mock/mockDatabase';
import { queryCollection } from '@/core/api/mock/mockUtils';
import type { ListParams, Paginated } from '@/core/api/types';
import { requireActor } from '@/core/auth/actor';
import { EVALUABLE_ROLES, isDepartmentScoped } from '@/core/auth/trainingPolicy';
import { compareRanking, evaluationMaxTotal, evaluationTotal, latestEvaluation } from '@/core/utils/scoring';
import type { RankingEntryDto, RankingFilters } from '../types/ranking';

/*
 * Simulated Rankings backend — the original ranking rules (see core/utils/scoring.ts):
 *  - ranked people: ACTIVE Trainee / Employee / Intern users; a DepartmentAdmin sees those of their department and
 *    those enrolled in one of its trainings;
 *  - each person's score is their MOST RECENT evaluation's total (a DepartmentAdmin only counts evaluations of their
 *    own department context: the enrollment's training department, else the person's own);
 *  - order: people with an evaluation first, then higher latest total, then name.
 * The position is the rank in that scoped order; filters and search narrow the view without renumbering it.
 */

export const rankingsMock = {
  list(params: ListParams<RankingFilters>): Paginated<RankingEntryDto> {
    const actor = requireActor();
    requirePermission(actor, 'rankings.view');
    const database = db();
    const scopedDepartment = isDepartmentScoped(actor) ? actor.departmentId : null;

    let users = database.users.filter((u) => u.isActive && EVALUABLE_ROLES.includes(u.role));
    if (scopedDepartment) {
      users = users.filter((u) => u.departmentId === scopedDepartment || database.enrollments.some((e) => e.userId === u.id && database.trainings.find((t) => t.id === e.trainingId)?.departmentId === scopedDepartment));
    }

    const contextOf = (evaluation: DbEvaluation): string | null => {
      const enrollment = evaluation.enrollmentId ? database.enrollments.find((e) => e.id === evaluation.enrollmentId) : undefined;
      const training = enrollment ? database.trainings.find((t) => t.id === enrollment.trainingId) : undefined;
      return training ? training.departmentId : (database.users.find((u) => u.id === evaluation.userId)?.departmentId ?? null);
    };

    const entries: RankingEntryDto[] = users.map((user) => {
      const evaluations = database.evaluations.filter((e) => e.userId === user.id && (!scopedDepartment || contextOf(e) === scopedDepartment));
      const latest = latestEvaluation(evaluations);
      return {
        position: null,
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: database.departments.find((d) => d.id === user.departmentId)?.name ?? null,
        latestTotal: latest ? evaluationTotal(latest.categories) : null,
        latestMaxTotal: latest ? evaluationMaxTotal(latest.categories) : null,
        latestEvaluatedAt: latest?.evaluatedAt ?? null,
        evaluationCount: evaluations.length,
      };
    });

    entries.sort(compareRanking);
    entries.forEach((entry, index) => {
      entry.position = entry.latestTotal !== null ? index + 1 : null;
    });

    // Filters/search keep the scoped order (no custom sort: the ranking order is a business rule).
    return queryCollection(entries, { ...params, sortBy: undefined }, {
      searchFields: (e) => [e.userName, e.departmentName],
      matches: (e, f) => (!f.departmentId || e.departmentId === f.departmentId) && (!f.role || e.role === f.role),
    });
  },
};
