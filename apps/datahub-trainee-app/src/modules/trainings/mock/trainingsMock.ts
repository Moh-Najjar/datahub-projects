import { assertCanViewTraining, forbidden, invalid, notFound, requireManagedDepartment, requirePermission, visibleTrainings } from '@/core/api/mock/access';
import { recordActivity } from '@/core/api/mock/activityLog';
import { TRAINING_STATUSES, type DbTraining } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import { queryCollection } from '@/core/api/mock/mockUtils';
import type { ListParams, Paginated } from '@/core/api/types';
import { requireActor } from '@/core/auth/actor';
import { isDepartmentScoped, type TrainingActor } from '@/core/auth/trainingPolicy';
import type { CreateTrainingInput, ReorderInput, TrainingDto, TrainingFilters, TrainingOption, TrainingRosterEntry, UpdateTrainingInput } from '../types/training';

/*
 * Simulated Trainings backend — the rules of the original Training Portal's TrainingService:
 *  - a learner (Trainee / Employee / Intern) sees only PUBLISHED trainings they are ENROLLED in;
 *  - a DepartmentAdmin sees and manages only trainings of their own department (asking for another department is
 *    Forbidden); SuperAdmin everything;
 *  - create: the trainer is the signed-in user, the status starts as Draft and the training goes last in its department;
 *  - the list is ordered by the manual order (sortOrder), then newest first; reordering is department-scoped;
 *  - deleting a training removes its content, assignments, submissions and enrollments.
 * Added: optional start/end date and duration, and activity records (created, published).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function author(): TrainingActor {
  const actor = requireActor();
  requirePermission(actor, 'trainings.manage');
  return actor;
}

function toDto(training: DbTraining, actor: TrainingActor): TrainingDto {
  const database = db();
  const enrollments = database.enrollments.filter((e) => e.trainingId === training.id);
  const mine = enrollments.find((e) => e.userId === actor.userId);
  return {
    id: training.id,
    title: training.title,
    description: training.description,
    status: training.status,
    sortOrder: training.sortOrder,
    departmentId: training.departmentId,
    departmentName: database.departments.find((d) => d.id === training.departmentId)?.name ?? null,
    trainerId: training.trainerId,
    trainerName: database.users.find((u) => u.id === training.trainerId)?.fullName ?? null,
    startDate: training.startDate,
    endDate: training.endDate,
    durationHours: training.durationHours,
    materialCount: database.materials.filter((m) => m.trainingId === training.id).length,
    assignmentCount: database.assignments.filter((a) => a.trainingId === training.id).length,
    enrollmentCount: enrollments.length,
    completedCount: enrollments.filter((e) => e.status === 'completed').length,
    createdAt: training.createdAt,
    myEnrollment: mine ? { id: mine.id, status: mine.status, progress: mine.progress, completedAt: mine.completedAt } : null,
  };
}

interface Fields {
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  durationHours: number | null;
}

function cleanFields(input: Fields): Fields {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) invalid('title', 'field.required');
  if (title.length > 200) invalid('title', 'field.tooLong');
  if (!description) invalid('description', 'field.required');
  const startDate = input.startDate || null;
  const endDate = input.endDate || null;
  if (startDate && !ISO_DATE.test(startDate)) invalid('startDate', 'field.date');
  if (endDate && !ISO_DATE.test(endDate)) invalid('endDate', 'field.date');
  if (startDate && endDate && endDate < startDate) invalid('endDate', 'training.endBeforeStart');
  const durationHours = input.durationHours ?? null;
  if (durationHours !== null && (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 1000)) invalid('durationHours', 'training.durationInvalid');
  return { title, description, startDate, endDate, durationHours };
}

const byOrder = (a: DbTraining, b: DbTraining) => a.sortOrder - b.sortOrder || Date.parse(b.createdAt) - Date.parse(a.createdAt);

export const trainingsMock = {
  list(params: ListParams<TrainingFilters>): Paginated<TrainingDto> {
    const actor = requireActor();
    requirePermission(actor, 'dashboard.view');
    if (isDepartmentScoped(actor) && params.filters?.departmentId && params.filters.departmentId !== actor.departmentId) forbidden('training.outsideDepartment');
    const rows = visibleTrainings(actor).map((t) => toDto(t, actor));
    const order = new Map(db().trainings.map((t) => [t.id, t]));
    return queryCollection(rows, params, {
      searchFields: (t) => [t.title, t.description, t.trainerName, t.departmentName],
      matches: (t, f) => (!f.status || t.status === f.status) && (!f.departmentId || t.departmentId === f.departmentId),
      sorters: {
        title: (a, b) => a.title.localeCompare(b.title),
        status: (a, b) => TRAINING_STATUSES.indexOf(a.status) - TRAINING_STATUSES.indexOf(b.status),
        department: (a, b) => (a.departmentName ?? '').localeCompare(b.departmentName ?? ''),
        enrollments: (a, b) => a.enrollmentCount - b.enrollmentCount,
        createdAt: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
        order: (a, b) => byOrder(order.get(a.id)!, order.get(b.id)!),
      },
      defaultSort: (a, b) => byOrder(order.get(a.id)!, order.get(b.id)!),
    });
  },

  options(): TrainingOption[] {
    const actor = author();
    return visibleTrainings(actor)
      .sort(byOrder)
      .map((t) => ({ id: t.id, title: t.title, status: t.status, departmentId: t.departmentId, departmentName: db().departments.find((d) => d.id === t.departmentId)?.name ?? null }));
  },

  get(id: string): TrainingDto {
    const actor = requireActor();
    const training = db().trainings.find((t) => t.id === id) ?? notFound('training.notFound');
    assertCanViewTraining(actor, training);
    return toDto(training, actor);
  },

  create(input: CreateTrainingInput): TrainingDto {
    const actor = author();
    const database = db();
    requireManagedDepartment(actor, input.departmentId, 'training.outsideDepartment');
    if (!database.departments.some((d) => d.id === input.departmentId)) notFound('department.notFound');
    const fields = cleanFields(input);
    const inDepartment = database.trainings.filter((t) => t.departmentId === input.departmentId);
    const training: DbTraining = {
      id: newId('trn'),
      ...fields,
      status: 'draft',
      sortOrder: inDepartment.length ? Math.max(...inDepartment.map((t) => t.sortOrder)) + 1 : 0,
      departmentId: input.departmentId,
      trainerId: actor.userId,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    database.trainings.push(training);
    recordActivity(actor, 'training-created', { trainingId: training.id });
    commit();
    return toDto(training, actor);
  },

  update(id: string, input: UpdateTrainingInput): TrainingDto {
    const actor = author();
    const training = db().trainings.find((t) => t.id === id) ?? notFound('training.notFound');
    requireManagedDepartment(actor, training.departmentId, 'training.outsideDepartment');
    const fields = cleanFields(input);
    if (!TRAINING_STATUSES.includes(input.status)) invalid('status', 'training.statusInvalid');
    const publishing = training.status !== 'published' && input.status === 'published';
    Object.assign(training, fields, { status: input.status, updatedAt: new Date().toISOString() });
    if (publishing) recordActivity(actor, 'training-published', { trainingId: training.id });
    commit();
    return toDto(training, actor);
  },

  remove(id: string): void {
    const actor = author();
    const database = db();
    const training = database.trainings.find((t) => t.id === id) ?? notFound('training.notFound');
    requireManagedDepartment(actor, training.departmentId, 'training.outsideDepartment');
    const assignmentIds = new Set(database.assignments.filter((a) => a.trainingId === id).map((a) => a.id));
    const enrollmentIds = new Set(database.enrollments.filter((e) => e.trainingId === id).map((e) => e.id));
    database.submissions = database.submissions.filter((s) => !assignmentIds.has(s.assignmentId));
    database.assignments = database.assignments.filter((a) => a.trainingId !== id);
    database.materials = database.materials.filter((m) => m.trainingId !== id);
    database.enrollments = database.enrollments.filter((e) => e.trainingId !== id);
    database.evaluations.forEach((e) => {
      if (e.enrollmentId && enrollmentIds.has(e.enrollmentId)) e.enrollmentId = null;
    });
    database.trainings = database.trainings.filter((t) => t.id !== id);
    commit();
  },

  /** Sets the manual order: position in `orderedIds` becomes the sortOrder. Every training must be in the caller's scope. */
  reorder(input: ReorderInput): void {
    const actor = author();
    const database = db();
    const byId = new Map(database.trainings.map((t) => [t.id, t]));
    input.orderedIds.forEach((id) => {
      const training = byId.get(id) ?? notFound('training.notFound');
      requireManagedDepartment(actor, training.departmentId, 'training.outsideDepartment');
    });
    const now = new Date().toISOString();
    input.orderedIds.forEach((id, index) => {
      const training = byId.get(id)!;
      training.sortOrder = index;
      training.updatedAt = now;
    });
    commit();
  },

  /** The people enrolled in a training (staff only). */
  roster(trainingId: string): TrainingRosterEntry[] {
    const actor = author();
    const database = db();
    const training = database.trainings.find((t) => t.id === trainingId) ?? notFound('training.notFound');
    requireManagedDepartment(actor, training.departmentId, 'training.outsideDepartment');
    return database.enrollments
      .filter((e) => e.trainingId === trainingId)
      .map((e) => {
        const user = database.users.find((u) => u.id === e.userId);
        return { enrollmentId: e.id, userId: e.userId, userName: user?.fullName ?? '', userRole: user?.role ?? 'Employee', status: e.status, progress: e.progress, assignedAt: e.assignedAt, completedAt: e.completedAt } satisfies TrainingRosterEntry;
      })
      .sort((a, b) => a.userName.localeCompare(b.userName));
  },
};
