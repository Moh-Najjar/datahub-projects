import { conflict, forbidden, invalid, notFound, requireManagedDepartment, requirePermission } from '@/core/api/mock/access';
import { recordActivity } from '@/core/api/mock/activityLog';
import type { DbEnrollment, DbTraining, DbUser } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import { queryCollection } from '@/core/api/mock/mockUtils';
import type { ListParams, Paginated } from '@/core/api/types';
import { requireActor } from '@/core/auth/actor';
import { DEPARTMENT_ASSIGNABLE_ROLES, canManageDepartment, type TrainingActor } from '@/core/auth/trainingPolicy';
import { ENROLLMENT_STATUSES } from '@/core/api/mock/dbTypes';
import { clampProgress, withProgress, withStatus } from '@/core/utils/enrollmentRules';
import type { CreateEnrollmentInput, EnrollmentDto, EnrollmentFilters, UpdateEnrollmentProgressInput, UpdateEnrollmentStatusInput } from '../types/enrollment';

/*
 * Simulated Enrollments backend — the rules of the original Training Portal's EnrollmentService:
 *  - only SuperAdmin and DepartmentAdmin manage enrollments; a DepartmentAdmin works only on trainings of their
 *    own department, and only enrolls Intern / Trainee / Employee users;
 *  - one enrollment per user and training (a second one is a Conflict);
 *  - setting the status Completed stamps the completion date, any other status clears it.
 * Added: progress 0–100 kept consistent with the status (see core/utils/enrollmentRules.ts), and activity records.
 */

function manager(): TrainingActor {
  const actor = requireActor();
  requirePermission(actor, 'enrollments.manage');
  return actor;
}

function trainingOf(enrollment: DbEnrollment): DbTraining {
  return db().trainings.find((t) => t.id === enrollment.trainingId) ?? notFound('training.notFound');
}

function toDto(enrollment: DbEnrollment): EnrollmentDto {
  const database = db();
  const training = database.trainings.find((t) => t.id === enrollment.trainingId);
  const user = database.users.find((u) => u.id === enrollment.userId);
  return {
    id: enrollment.id,
    trainingId: enrollment.trainingId,
    trainingTitle: training?.title ?? '',
    departmentId: training?.departmentId ?? '',
    departmentName: database.departments.find((d) => d.id === training?.departmentId)?.name ?? null,
    userId: enrollment.userId,
    userName: user?.fullName ?? '',
    userRole: user?.role ?? 'Employee',
    assignedByUserId: enrollment.assignedByUserId,
    assignedByUserName: database.users.find((u) => u.id === enrollment.assignedByUserId)?.fullName ?? null,
    status: enrollment.status,
    progress: enrollment.progress,
    assignedAt: enrollment.assignedAt,
    completedAt: enrollment.completedAt,
  };
}

/** Enrollments in the caller's scope: SuperAdmin all; DepartmentAdmin those of trainings in their department. */
function scoped(actor: TrainingActor): DbEnrollment[] {
  return db().enrollments.filter((e) => canManageDepartment(actor, trainingOf(e).departmentId));
}

function find(actor: TrainingActor, id: string): DbEnrollment {
  const enrollment = db().enrollments.find((e) => e.id === id) ?? notFound('enrollment.notFound');
  requireManagedDepartment(actor, trainingOf(enrollment).departmentId, 'enrollment.outsideDepartment');
  return enrollment;
}

/** Applies a new status/progress and records the right activity entry. */
function apply(actor: TrainingActor, enrollment: DbEnrollment, next: Pick<DbEnrollment, 'status' | 'progress' | 'completedAt'>): void {
  const before = { status: enrollment.status, progress: enrollment.progress };
  enrollment.status = next.status;
  enrollment.progress = next.progress;
  enrollment.completedAt = next.completedAt;
  if (before.status !== 'completed' && next.status === 'completed') {
    recordActivity(actor, 'enrollment-completed', { trainingId: enrollment.trainingId, userId: enrollment.userId, progress: 100 });
  } else if (before.progress !== next.progress) {
    recordActivity(actor, 'progress-updated', { trainingId: enrollment.trainingId, userId: enrollment.userId, progress: next.progress });
  }
}

const ENROLLABLE = DEPARTMENT_ASSIGNABLE_ROLES;

export const enrollmentsMock = {
  list(params: ListParams<EnrollmentFilters>): Paginated<EnrollmentDto> {
    const actor = manager();
    const rows = scoped(actor).map(toDto);
    return queryCollection(rows, params, {
      searchFields: (e) => [e.userName, e.trainingTitle, e.assignedByUserName],
      matches: (e, f) => (!f.trainingId || e.trainingId === f.trainingId) && (!f.userId || e.userId === f.userId) && (!f.status || e.status === f.status),
      sorters: {
        user: (a, b) => a.userName.localeCompare(b.userName),
        training: (a, b) => a.trainingTitle.localeCompare(b.trainingTitle),
        status: (a, b) => ENROLLMENT_STATUSES.indexOf(a.status) - ENROLLMENT_STATUSES.indexOf(b.status),
        progress: (a, b) => a.progress - b.progress,
        assignedAt: (a, b) => Date.parse(a.assignedAt) - Date.parse(b.assignedAt),
        completedAt: (a, b) => Date.parse(a.completedAt ?? '0') - Date.parse(b.completedAt ?? '0'),
      },
      // Original order: newest assignment first.
      defaultSort: (a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt),
    });
  },

  /** One person's enrollments in the caller's scope (the evaluation form links an evaluation to one of them). */
  listForUser(userId: string): EnrollmentDto[] {
    const actor = manager();
    return scoped(actor)
      .filter((e) => e.userId === userId)
      .map(toDto)
      .sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt));
  },

  create(input: CreateEnrollmentInput): EnrollmentDto {
    const actor = manager();
    const database = db();
    const training: DbTraining = database.trainings.find((t) => t.id === input.trainingId) ?? notFound('training.notFound');
    const user: DbUser = database.users.find((u) => u.id === input.userId) ?? notFound('user.notFound');
    requireManagedDepartment(actor, training.departmentId, 'enrollment.trainingOutsideDepartment');
    if (!ENROLLABLE.includes(user.role)) forbidden('enrollment.userRole');
    if (database.enrollments.some((e) => e.trainingId === training.id && e.userId === user.id)) conflict('enrollment.duplicate');
    const enrollment: DbEnrollment = { id: newId('enr'), trainingId: training.id, userId: user.id, assignedByUserId: actor.userId, status: 'assigned', progress: 0, assignedAt: new Date().toISOString(), completedAt: null };
    database.enrollments.push(enrollment);
    recordActivity(actor, 'trainee-enrolled', { trainingId: training.id, userId: user.id });
    commit();
    return toDto(enrollment);
  },

  updateStatus(id: string, input: UpdateEnrollmentStatusInput): EnrollmentDto {
    const actor = manager();
    const enrollment = find(actor, id);
    if (!ENROLLMENT_STATUSES.includes(input.status)) invalid('status', 'enrollment.statusInvalid');
    apply(actor, enrollment, withStatus(enrollment, input.status, new Date().toISOString()));
    commit();
    return toDto(enrollment);
  },

  updateProgress(id: string, input: UpdateEnrollmentProgressInput): EnrollmentDto {
    const actor = manager();
    const enrollment = find(actor, id);
    if (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 100) invalid('progress', 'enrollment.progressInvalid');
    apply(actor, enrollment, withProgress(enrollment, clampProgress(input.progress), new Date().toISOString()));
    commit();
    return toDto(enrollment);
  },

  remove(id: string): void {
    const actor = manager();
    const enrollment = find(actor, id);
    const database = db();
    database.enrollments = database.enrollments.filter((e) => e.id !== enrollment.id);
    database.evaluations.forEach((e) => {
      if (e.enrollmentId === enrollment.id) e.enrollmentId = null;
    });
    commit();
  },
};
