import { enrollmentStatusOf, trainingStatusOf } from '@/core/api/academyStatus';
import { emptyIfForbidden, http } from '@/core/api/http';
import { arr, asRaw, listOf, num, str, token, type Raw } from '@/core/api/read';
import { currentTrainingPermissions } from '@/core/auth/apiIdentity';
import { ACTIVITY_TYPES, type ActivityType } from '@/core/domain/training';
import type { ActivityDto, DashboardDto, DashboardFilters, DeadlineDto, LearnerDashboard, ManagerDashboard, TrainingProgressEntry } from '../types/dashboard';

/*
 * Dashboard on the real backend.
 * - Managers: `GET /api/v1/academy/dashboard` (verified 2026-11-24: `trainingCount`, `publishedTrainingCount`,
 *   `enrollmentCount`, `activeEnrollmentCount`, `completedEnrollmentCount`, `completionRate`, `enrollmentStatuses[]`,
 *   `trainingProgress[]`, `upcomingDeadlines[]` — the list items' fields are read tolerantly). It takes no filters, so the
 *   dashboard's department / period filters are not offered with the real backend. "Active trainees" shows the backend's
 *   active enrollment count.
 * - Learners: computed from their own enrollments and trainings (`/academy/me/…`); deadlines from the dashboard
 *   endpoint when it answers for them.
 * - Activity: `GET /api/v1/academy/recent-activity?limit=` (event types mapped to the app's; unknown ones are skipped).
 */

const A = '/api/v1/academy';

function deadlineOf(o: Raw, i: number): DeadlineDto {
  const kind = token(str(o, 'kind', 'type')).includes('assignment') ? 'assignment' : 'training';
  return {
    id: str(o, 'id') ?? `deadline-${i}`,
    kind,
    title: str(o, 'title', 'name') ?? '',
    trainingId: str(o, 'trainingId') ?? '',
    trainingTitle: str(o, 'trainingTitle', 'trainingName') ?? str(o, 'title') ?? '',
    dueAt: str(o, 'dueAtUtc', 'dueAt', 'closesAtUtc', 'endsAtUtc') ?? new Date(0).toISOString(),
  };
}

function progressOf(o: Raw): TrainingProgressEntry {
  return {
    trainingId: str(o, 'trainingId', 'id') ?? '',
    title: str(o, 'title', 'trainingTitle', 'name') ?? '',
    status: trainingStatusOf(str(o, 'status')),
    endDate: str(o, 'endDate', 'endsAtUtc'),
    enrollments: num(o, 'enrollmentCount', 'enrollments') ?? 0,
    completed: num(o, 'completedCount', 'completedEnrollmentCount', 'completed') ?? 0,
    averageProgress: num(o, 'averageProgress', 'averageProgressPercentage', 'progress') ?? 0,
  };
}

function breakdownOf(items: Raw[]) {
  const out = { assigned: 0, inProgress: 0, completed: 0 };
  for (const item of items) {
    const status = enrollmentStatusOf(str(item, 'status', 'name'));
    const count = num(item, 'count', 'value', 'total') ?? 0;
    if (status === 'completed') out.completed += count;
    else if (status === 'in-progress') out.inProgress += count;
    else out.assigned += count;
  }
  return out;
}

async function managerDashboard(signal?: AbortSignal): Promise<ManagerDashboard> {
  const d = asRaw(await http.get(`${A}/dashboard`, { signal }));
  const deadlines = arr(d, 'upcomingDeadlines', 'deadlines').map(deadlineOf).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const rate = num(d, 'completionRate') ?? 0;
  return {
    kind: 'manager',
    scopeDepartmentName: str(d, 'departmentName', 'scopeDepartmentName'),
    stats: {
      totalTrainings: num(d, 'trainingCount') ?? 0,
      publishedTrainings: num(d, 'publishedTrainingCount') ?? 0,
      totalEnrollments: num(d, 'enrollmentCount') ?? 0,
      activeTrainees: num(d, 'activeTraineeCount', 'activeEnrollmentCount') ?? 0,
      completedEnrollments: num(d, 'completedEnrollmentCount') ?? 0,
      // 0–1 or 0–100: the app shows percentages.
      completionRate: rate <= 1 && rate > 0 ? rate * 100 : rate,
      dueSoon: deadlines.length,
    },
    statusBreakdown: breakdownOf(arr(d, 'enrollmentStatuses', 'statusBreakdown')),
    trainingProgress: arr(d, 'trainingProgress').map(progressOf).sort((a, b) => b.enrollments - a.enrollments).slice(0, 5),
    deadlines: deadlines.slice(0, 6),
  };
}

async function learnerDashboard(signal?: AbortSignal): Promise<LearnerDashboard> {
  // Enrollments refused (403) → an empty dashboard rather than an error.
  const [enrollments, trainings] = await Promise.all([emptyIfForbidden(http.get(`${A}/me/enrollments`, { signal })).then(listOf), http.get(`${A}/me/trainings`, { signal }).then(listOf)]);
  const mine = enrollments.map((e) => ({
    trainingId: str(e, 'trainingId') ?? '',
    status: enrollmentStatusOf(str(e, 'status')),
    progress: Math.round(num(e, 'progressPercentage', 'progress') ?? 0),
    title: str(e, 'trainingTitle', 'trainingName') ?? str(trainings.find((t) => str(t, 'id', 'trainingId') === str(e, 'trainingId')) ?? {}, 'title') ?? '',
    endDate: str(e, 'dueAtUtc', 'dueAt'),
  }));
  const completed = mine.filter((e) => e.status === 'completed').length;
  const deadlines = await http
    .get(`${A}/dashboard`, { signal })
    .then((d) => arr(asRaw(d), 'upcomingDeadlines', 'deadlines').map(deadlineOf))
    .catch(() => [] as DeadlineDto[]);
  return {
    kind: 'learner',
    stats: {
      enrolled: mine.length,
      inProgress: mine.filter((e) => e.status === 'in-progress').length,
      completed,
      averageProgress: mine.length ? mine.reduce((n, e) => n + e.progress, 0) / mine.length : 0,
      certificates: completed,
    },
    current: mine.filter((e) => e.status !== 'completed').sort((a, b) => b.progress - a.progress).slice(0, 5),
    deadlines: deadlines.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 6),
  };
}

/** `TrainingCreated` / `training_created` → `training-created` when it is one of the app's event types. */
function activityTypeOf(value: string | null): ActivityType | null {
  const t = token(value);
  return ACTIVITY_TYPES.find((type) => token(type) === t) ?? (t === 'enrolled' || t === 'enrollmentcreated' ? 'trainee-enrolled' : t === 'progressupdated' ? 'progress-updated' : null);
}

export const dashboardHttpApi = {
  // The real backend's dashboard takes no filters (see above).
  get(_filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardDto> {
    return currentTrainingPermissions().includes('trainings.manage') ? managerDashboard(signal) : learnerDashboard(signal);
  },
  async recentActivity(limit: number, _departmentId: string | null, signal?: AbortSignal): Promise<ActivityDto[]> {
    // Learners may not be allowed to read the activity feed (403): then it is simply empty.
    const rows = listOf(await emptyIfForbidden(http.get(`${A}/recent-activity`, { query: { limit }, signal })));
    return rows.flatMap((o, i) => {
      const type = activityTypeOf(str(o, 'type', 'activityType', 'eventType'));
      if (!type) return [];
      return [
        {
          id: str(o, 'id') ?? `activity-${i}`,
          type,
          at: str(o, 'occurredAtUtc', 'createdAtUtc', 'at', 'timestamp') ?? new Date(0).toISOString(),
          actorName: str(o, 'actorName', 'actorDisplayName', 'performedByName') ?? '',
          trainingId: str(o, 'trainingId'),
          trainingTitle: str(o, 'trainingTitle', 'trainingName'),
          userName: str(o, 'userName', 'userDisplayName', 'traineeName'),
          progress: num(o, 'progress', 'progressPercentage'),
        },
      ];
    });
  },
};
