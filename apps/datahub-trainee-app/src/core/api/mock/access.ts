import { ApiError } from '@/core/api/types';
import { actorCan, canManageDepartment, isDepartmentScoped, isLearnerRole, type TrainingActor, type TrainingPermission } from '@/core/auth/trainingPolicy';
import { db } from './mockDatabase';
import type { DbTraining, DbUser } from './dbTypes';

/*
 * Authorization helpers of the SIMULATED backend. They apply the training business policy
 * (`core/auth/trainingPolicy.ts`) the way the original Training Portal's services did: FORBIDDEN for anything
 * outside the caller's role or department. A real backend enforces the same rules from the access token.
 */

export function forbidden(reason: string): never {
  throw new ApiError('FORBIDDEN', reason);
}

export function notFound(reason: string): never {
  throw new ApiError('NOT_FOUND', reason);
}

export function conflict(reason: string): never {
  throw new ApiError('CONFLICT', reason);
}

export function invalid(field: string, reason: string): never {
  throw new ApiError('VALIDATION', reason, { [field]: [reason] });
}

export function requirePermission(actor: TrainingActor, permission: TrainingPermission): void {
  if (!actorCan(actor, permission)) forbidden('permission.denied');
}

/** A DepartmentAdmin may only act inside their own department; SuperAdmin anywhere. */
export function requireManagedDepartment(actor: TrainingActor, departmentId: string | null, reason: string): void {
  if (!canManageDepartment(actor, departmentId)) forbidden(reason);
}

export function enrolled(userId: string, trainingId: string): boolean {
  return db().enrollments.some((e) => e.userId === userId && e.trainingId === trainingId);
}

/** Can the actor see this training? Managers: their scope. Learners: enrolled AND published (original rule). */
export function assertCanViewTraining(actor: TrainingActor, training: DbTraining): void {
  if (actor.role === 'SuperAdmin') return;
  if (isDepartmentScoped(actor)) return requireManagedDepartment(actor, training.departmentId, 'training.outsideDepartment');
  if (isLearnerRole(actor.role)) {
    if (!enrolled(actor.userId, training.id)) forbidden('training.notEnrolled');
    if (training.status !== 'published') forbidden('training.notPublished');
    return;
  }
  forbidden('permission.denied');
}

/** Trainings the actor can see. */
export function visibleTrainings(actor: TrainingActor): DbTraining[] {
  const database = db();
  if (actor.role === 'SuperAdmin') return database.trainings;
  if (isDepartmentScoped(actor)) return database.trainings.filter((t) => canManageDepartment(actor, t.departmentId));
  return database.trainings.filter((t) => t.status === 'published' && enrolled(actor.userId, t.id));
}

/** DepartmentAdmin may see a user of their department, or one enrolled in a training of their department. */
export function canSeeUser(actor: TrainingActor, user: DbUser): boolean {
  if (actor.role === 'SuperAdmin') return true;
  if (!isDepartmentScoped(actor)) return actor.userId === user.id;
  if (user.departmentId === actor.departmentId) return true;
  const database = db();
  return database.enrollments.some((e) => e.userId === user.id && database.trainings.find((t) => t.id === e.trainingId)?.departmentId === actor.departmentId);
}
