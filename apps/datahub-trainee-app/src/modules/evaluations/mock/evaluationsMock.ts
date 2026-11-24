import { canSeeUser, forbidden, invalid, notFound, requireManagedDepartment, requirePermission } from '@/core/api/mock/access';
import { recordActivity } from '@/core/api/mock/activityLog';
import type { DbEvaluation, DbUser } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import { requireActor } from '@/core/auth/actor';
import { EVALUABLE_ROLES, isDepartmentScoped, type TrainingActor } from '@/core/auth/trainingPolicy';
import { MAX_SCORE, MIN_SCORE } from '@/core/config/evaluationDefaults';
import { evaluationMaxTotal, evaluationTotal } from '@/core/utils/scoring';
import type { CreateEvaluationInput, EvaluationCategoryInput, EvaluationDto, UpdateEvaluationInput } from '../types/evaluation';

/*
 * Simulated Evaluations backend — the rules of the original Training Portal's EvaluationService:
 *  - only SuperAdmin and DepartmentAdmin evaluate, and only Trainee / Employee / Intern users can be evaluated;
 *  - an evaluation has a date and one or more categories, each with a name (≤ 200), criteria (≤ 1000) and a score
 *    from 1 to 10; its total is the sum and its maximum is categories × 10;
 *  - it may be linked to one of the person's enrollments (it must belong to them);
 *  - a DepartmentAdmin works in the "department context" of an evaluation: the enrollment's training department when
 *    linked, otherwise the person's own department — and may view a person only in their department or enrolled in
 *    one of their department's trainings.
 */

function manager(): TrainingActor {
  const actor = requireActor();
  requirePermission(actor, 'evaluations.manage');
  return actor;
}

function evaluable(userId: string): DbUser {
  const user = db().users.find((u) => u.id === userId) ?? notFound('user.notFound');
  if (!EVALUABLE_ROLES.includes(user.role)) invalid('userId', 'evaluation.userNotEvaluable');
  return user;
}

/** The department an evaluation belongs to: its enrollment's training, else the person's own department. */
function departmentContext(evaluation: DbEvaluation, user: DbUser | undefined): string | null {
  const database = db();
  const enrollment = evaluation.enrollmentId ? database.enrollments.find((e) => e.id === evaluation.enrollmentId) : undefined;
  const training = enrollment ? database.trainings.find((t) => t.id === enrollment.trainingId) : undefined;
  return training ? training.departmentId : (user?.departmentId ?? null);
}

function toDto(evaluation: DbEvaluation): EvaluationDto {
  const database = db();
  const user = database.users.find((u) => u.id === evaluation.userId);
  const enrollment = evaluation.enrollmentId ? database.enrollments.find((e) => e.id === evaluation.enrollmentId) : undefined;
  const training = enrollment ? database.trainings.find((t) => t.id === enrollment.trainingId) : undefined;
  const departmentId = departmentContext(evaluation, user);
  return {
    id: evaluation.id,
    userId: evaluation.userId,
    userName: user?.fullName ?? '',
    evaluatedByUserId: evaluation.evaluatedByUserId,
    evaluatedByUserName: database.users.find((u) => u.id === evaluation.evaluatedByUserId)?.fullName ?? null,
    enrollmentId: evaluation.enrollmentId,
    trainingId: training?.id ?? null,
    trainingTitle: training?.title ?? null,
    departmentName: database.departments.find((d) => d.id === departmentId)?.name ?? null,
    evaluatedAt: evaluation.evaluatedAt,
    total: evaluationTotal(evaluation.categories),
    maxTotal: evaluationMaxTotal(evaluation.categories),
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
    categories: evaluation.categories,
  };
}

function cleanCategories(categories: readonly EvaluationCategoryInput[]): DbEvaluation['categories'] {
  if (categories.length === 0) invalid('categories', 'evaluation.categoriesRequired');
  return categories.map((c) => {
    const categoryName = c.categoryName.trim();
    const criteria = (c.criteria ?? '').trim();
    if (!categoryName || categoryName.length > 200) invalid('categories', 'evaluation.categoryInvalid');
    if (criteria.length > 1000) invalid('categories', 'evaluation.categoryInvalid');
    if (!Number.isInteger(c.score) || c.score < MIN_SCORE || c.score > MAX_SCORE) invalid('categories', 'evaluation.scoreInvalid');
    return { id: newId('evc'), categoryName, criteria, score: c.score };
  });
}

function cleanDate(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) invalid('evaluatedAt', 'field.date');
  return new Date(time).toISOString();
}

export const evaluationsMock = {
  /** A person's evaluations, newest first (a DepartmentAdmin: only people they may see). */
  listForUser(userId: string): EvaluationDto[] {
    const actor = manager();
    const user = evaluable(userId);
    if (!canSeeUser(actor, user)) forbidden('evaluation.userOutsideDepartment');
    return db()
      .evaluations.filter((e) => e.userId === userId)
      .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt))
      .map(toDto);
  },

  create(userId: string, input: CreateEvaluationInput): EvaluationDto {
    const actor = manager();
    const database = db();
    const user = evaluable(userId);
    const enrollment = input.enrollmentId ? (database.enrollments.find((e) => e.id === input.enrollmentId) ?? notFound('enrollment.notFound')) : null;
    if (enrollment && enrollment.userId !== userId) invalid('enrollmentId', 'evaluation.enrollmentMismatch');
    if (isDepartmentScoped(actor)) {
      const departmentId = enrollment ? database.trainings.find((t) => t.id === enrollment.trainingId)?.departmentId : user.departmentId;
      requireManagedDepartment(actor, departmentId ?? null, 'evaluation.outsideDepartment');
    }
    const evaluatedAt = cleanDate(input.evaluatedAt);
    const categories = cleanCategories(input.categories);
    const evaluation: DbEvaluation = { id: newId('evl'), userId, evaluatedByUserId: actor.userId, enrollmentId: enrollment?.id ?? null, evaluatedAt, createdAt: new Date().toISOString(), updatedAt: null, categories };
    database.evaluations.push(evaluation);
    recordActivity(actor, 'evaluation-submitted', { trainingId: enrollment?.trainingId ?? null, userId });
    commit();
    return toDto(evaluation);
  },

  update(evaluationId: string, input: UpdateEvaluationInput): EvaluationDto {
    const actor = manager();
    const database = db();
    const evaluation = database.evaluations.find((e) => e.id === evaluationId) ?? notFound('evaluation.notFound');
    const user = database.users.find((u) => u.id === evaluation.userId);
    requireManagedDepartment(actor, departmentContext(evaluation, user), 'evaluation.outsideDepartment');
    evaluation.evaluatedAt = cleanDate(input.evaluatedAt);
    evaluation.categories = cleanCategories(input.categories);
    evaluation.updatedAt = new Date().toISOString();
    commit();
    return toDto(evaluation);
  },

  remove(evaluationId: string): void {
    const actor = manager();
    const database = db();
    const evaluation = database.evaluations.find((e) => e.id === evaluationId) ?? notFound('evaluation.notFound');
    const user = database.users.find((u) => u.id === evaluation.userId);
    requireManagedDepartment(actor, departmentContext(evaluation, user), 'evaluation.outsideDepartment');
    database.evaluations = database.evaluations.filter((e) => e.id !== evaluation.id);
    commit();
  },
};
