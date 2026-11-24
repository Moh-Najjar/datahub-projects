import { forbidden, requirePermission, visibleTrainings } from '@/core/api/mock/access';
import type { DbEnrollment, DbTraining } from '@/core/api/mock/dbTypes';
import { db } from '@/core/api/mock/mockDatabase';
import { requireActor } from '@/core/auth/actor';
import { canManageDepartment, isDepartmentScoped, isLearnerRole, type TrainingActor } from '@/core/auth/trainingPolicy';
import { computeAssignmentStatus } from '@/core/utils/assignmentStatus';
import { NO_DASHBOARD_FILTERS, type ActivityDto, type DashboardDto, type DashboardFilters, type DeadlineDto, type LearnerDashboard, type ManagerDashboard } from '../types/dashboard';

/*
 * Simulated Dashboard backend. Every figure is computed from the same records the other pages show, so the numbers
 * always agree with the lists:
 *  - managers: the programme of their scope (SuperAdmin all; DepartmentAdmin their department);
 *  - learners: only their own enrollments.
 * Deadlines: assignments closing within 14 days that are still open, and published trainings ending within 30 days.
 * Manager filters: department (SuperAdmin only — a DepartmentAdmin is always limited to their own; another department is
 * FORBIDDEN) narrows trainings, enrollments and activity; period keeps enrollments assigned within the last N days.
 */

const DAY = 86_400_000;
const ASSIGNMENT_WINDOW_DAYS = 14;
const TRAINING_WINDOW_DAYS = 30;

const average = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Every upcoming deadline, soonest first (lists show the first `DEADLINE_LIST`; managers also see the total). */
function allDeadlines(trainings: readonly DbTraining[], keep: (training: DbTraining, kind: 'training' | 'assignment', assignmentId?: string) => boolean, now: number): DeadlineDto[] {
  const database = db();
  const out: DeadlineDto[] = [];
  for (const training of trainings) {
    if (training.status !== 'published') continue;
    if (training.endDate && keep(training, 'training')) {
      const due = Date.parse(`${training.endDate}T23:59:59`);
      if (due >= now && due - now <= TRAINING_WINDOW_DAYS * DAY) out.push({ id: `training-${training.id}`, kind: 'training', title: training.title, trainingId: training.id, trainingTitle: training.title, dueAt: training.endDate });
    }
    for (const assignment of database.assignments.filter((a) => a.trainingId === training.id)) {
      const closes = Date.parse(assignment.closesAt);
      if (computeAssignmentStatus(assignment.opensAt, assignment.closesAt, now) === 'open' && closes - now <= ASSIGNMENT_WINDOW_DAYS * DAY && keep(training, 'assignment', assignment.id)) {
        out.push({ id: `assignment-${assignment.id}`, kind: 'assignment', title: assignment.title, trainingId: training.id, trainingTitle: training.title, dueAt: assignment.closesAt });
      }
    }
  }
  return out.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

const DEADLINE_LIST = 6;

/** The department the manager asked for, checked against their scope (null = their whole scope). */
function filterDepartment(actor: TrainingActor, departmentId: string | null): string | null {
  if (!departmentId) return null;
  if (!canManageDepartment(actor, departmentId)) forbidden('department.outsideScope');
  return departmentId;
}

function managerDashboard(actor: TrainingActor, filters: DashboardFilters, now: number): ManagerDashboard {
  const database = db();
  const departmentId = filterDepartment(actor, filters.departmentId);
  const trainings = visibleTrainings(actor).filter((t) => !departmentId || t.departmentId === departmentId);
  const trainingIds = new Set(trainings.map((t) => t.id));
  const since = filters.period === 'all' ? -Infinity : now - Number(filters.period) * DAY;
  const enrollments = database.enrollments.filter((e) => trainingIds.has(e.trainingId) && Date.parse(e.assignedAt) >= since);
  const completed = enrollments.filter((e) => e.status === 'completed');
  const activeUsers = new Set(enrollments.filter((e) => e.status !== 'completed' && database.users.find((u) => u.id === e.userId)?.isActive).map((e) => e.userId));

  const trainingProgress = trainings
    .map((t) => {
      const rows = enrollments.filter((e) => e.trainingId === t.id);
      return { trainingId: t.id, title: t.title, status: t.status, endDate: t.endDate, enrollments: rows.length, completed: rows.filter((e) => e.status === 'completed').length, averageProgress: average(rows.map((e) => e.progress)) };
    })
    .filter((row) => row.enrollments > 0)
    .sort((a, b) => b.enrollments - a.enrollments || a.title.localeCompare(b.title))
    .slice(0, 5);
  const upcoming = allDeadlines(trainings, () => true, now);

  return {
    kind: 'manager',
    scopeDepartmentName: isDepartmentScoped(actor) ? (database.departments.find((d) => d.id === actor.departmentId)?.name ?? null) : null,
    stats: {
      totalTrainings: trainings.length,
      publishedTrainings: trainings.filter((t) => t.status === 'published').length,
      totalEnrollments: enrollments.length,
      activeTrainees: activeUsers.size,
      completedEnrollments: completed.length,
      completionRate: enrollments.length ? (completed.length / enrollments.length) * 100 : 0,
      dueSoon: upcoming.length,
    },
    statusBreakdown: { assigned: enrollments.filter((e) => e.status === 'assigned').length, inProgress: enrollments.filter((e) => e.status === 'in-progress').length, completed: completed.length },
    trainingProgress,
    deadlines: upcoming.slice(0, DEADLINE_LIST),
  };
}

function learnerDashboard(actor: TrainingActor, now: number): LearnerDashboard {
  const database = db();
  const mine: DbEnrollment[] = database.enrollments.filter((e) => e.userId === actor.userId && database.trainings.find((t) => t.id === e.trainingId)?.status === 'published');
  const byTraining = new Map(mine.map((e) => [e.trainingId, e]));
  const trainings = visibleTrainings(actor);

  return {
    kind: 'learner',
    stats: {
      enrolled: mine.length,
      inProgress: mine.filter((e) => e.status === 'in-progress').length,
      completed: mine.filter((e) => e.status === 'completed').length,
      averageProgress: average(mine.map((e) => e.progress)),
      certificates: mine.filter((e) => e.status === 'completed').length,
    },
    current: mine
      .filter((e) => e.status !== 'completed')
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5)
      .map((e) => {
        const training = database.trainings.find((t) => t.id === e.trainingId)!;
        return { trainingId: training.id, title: training.title, status: e.status, progress: e.progress, endDate: training.endDate };
      }),
    // Only unfinished trainings, and assignments they have not submitted yet.
    deadlines: allDeadlines(
      trainings,
      (training, kind, assignmentId) => {
        const enrollment = byTraining.get(training.id);
        if (!enrollment || enrollment.status === 'completed') return false;
        return kind === 'training' || !database.submissions.some((s) => s.assignmentId === assignmentId && s.userId === actor.userId);
      },
      now,
    ).slice(0, DEADLINE_LIST),
  };
}

export const dashboardMock = {
  /** Filters apply to managers; learners always see their own trainings. */
  get(filters: DashboardFilters = NO_DASHBOARD_FILTERS, now: number = Date.now()): DashboardDto {
    const actor = requireActor();
    requirePermission(actor, 'dashboard.view');
    return isLearnerRole(actor.role) ? learnerDashboard(actor, now) : managerDashboard(actor, filters, now);
  },

  /** Newest first. Managers: events of their scope; learners: events about themselves. */
  recentActivity(limit: number, departmentId: string | null = null): ActivityDto[] {
    const actor = requireActor();
    requirePermission(actor, 'dashboard.view');
    const department = isLearnerRole(actor.role) ? null : filterDepartment(actor, departmentId);
    return db()
      .activities.filter((a) => (isLearnerRole(actor.role) ? a.userId === actor.userId : canManageDepartment(actor, a.departmentId) && (!department || a.departmentId === department)))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, Math.max(1, limit))
      .map((a) => ({ id: a.id, type: a.type, at: a.at, actorName: a.actorName, trainingId: a.trainingId, trainingTitle: a.trainingTitle, userName: a.userName, progress: a.progress }));
  },
};
