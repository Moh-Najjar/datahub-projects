import { backendTrainingStatus, enrollmentStatusOf, trainingStatusOf } from '@/core/api/academyStatus';
import { createdId, http } from '@/core/api/http';
import { queryCollection } from '@/core/api/listing';
import { asRaw, bool, listOf, num, str, type Raw } from '@/core/api/read';
import { currentTrainingPermissions } from '@/core/auth/apiIdentity';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { TRAINING_STATUSES, type Role } from '@/core/domain/training';
import type { CreateTrainingInput, MyEnrollment, ReorderInput, TrainingDto, TrainingFilters, TrainingOption, TrainingRosterEntry, UpdateTrainingInput } from '../types/training';

/*
 * Trainings on the real backend (`/api/v1/academy/trainings…`). Staff read every training (drafts included) and the app
 * searches / filters / sorts / pages them; learners read their own (`/academy/me/trainings` + `/me/enrollments`).
 * - The backend has no start / end date and no trainer on a training (2026-11-24): those stay empty here.
 * - Status changes use the dedicated endpoints: publish (`POST …/{id}/publish`), archive (`POST …/{id}/archive`);
 *   back to draft through `PUT` with `status`.
 * - `PUT` replaces the record, so updates start from the current one (fields the form doesn't show are kept).
 * - Create needs a `code`: derived from the title, made unique with a short suffix.
 * Response fields are read tolerantly (Swagger has no response models).
 */

const BASE = '/api/v1/academy/trainings';
const LANGUAGE = 'en';

function myEnrollmentOf(o: Raw | undefined): MyEnrollment | null {
  if (!o) return null;
  return { id: str(o, 'id', 'enrollmentId') ?? '', status: enrollmentStatusOf(str(o, 'status')), progress: Math.round(num(o, 'progressPercentage', 'progress') ?? 0), completedAt: str(o, 'completedAtUtc', 'completedAt') };
}

export function toTrainingDto(o: Raw, mine?: Raw): TrainingDto {
  return {
    id: str(o, 'id', 'trainingId') ?? '',
    title: str(o, 'title', 'name') ?? '',
    description: str(o, 'description') ?? '',
    status: trainingStatusOf(str(o, 'status')),
    sortOrder: num(o, 'sortOrder') ?? 0,
    departmentId: str(o, 'departmentId') ?? '',
    departmentName: str(o, 'departmentName', 'department'),
    trainerId: str(o, 'trainerId', 'trainerUserId'),
    trainerName: str(o, 'trainerName'),
    startDate: str(o, 'startDate'),
    endDate: str(o, 'endDate'),
    durationHours: num(o, 'estimatedDurationHours', 'durationHours'),
    materialCount: num(o, 'materialCount') ?? 0,
    assignmentCount: num(o, 'assignmentCount') ?? 0,
    enrollmentCount: num(o, 'enrollmentCount') ?? 0,
    completedCount: num(o, 'completedEnrollmentCount', 'completedCount') ?? 0,
    createdAt: str(o, 'createdAtUtc', 'createdAt') ?? new Date(0).toISOString(),
    myEnrollment: myEnrollmentOf(mine ?? (o.myEnrollment ? asRaw(o.myEnrollment) : undefined)),
  };
}

const staffList = async (signal?: AbortSignal) => listOf(await http.get(BASE, { query: { includeDrafts: true, languageCode: LANGUAGE }, signal }));

/** Learners: their trainings, each with their own enrollment. */
async function learnerList(signal?: AbortSignal): Promise<TrainingDto[]> {
  const [trainings, enrollments] = await Promise.all([http.get('/api/v1/academy/me/trainings', { signal }).then(listOf), http.get('/api/v1/academy/me/enrollments', { signal }).then(listOf)]);
  return trainings.map((t) => toTrainingDto(t, enrollments.find((e) => str(e, 'trainingId') === str(t, 'id', 'trainingId'))));
}

/** Staff (people who manage trainings) read every training; everyone else reads their own. */
const isStaff = () => currentTrainingPermissions().includes('trainings.manage');

const all = async (signal?: AbortSignal): Promise<TrainingDto[]> => (isStaff() ? (await staffList(signal)).map((t) => toTrainingDto(t)) : learnerList(signal));

async function getOne(id: string, signal?: AbortSignal): Promise<TrainingDto> {
  if (!isStaff()) {
    const mine = (await learnerList(signal)).find((t) => t.id === id);
    if (!mine) throw new ApiError('NOT_FOUND', 'training.notFound');
    return mine;
  }
  return toTrainingDto(asRaw(await http.get(`${BASE}/${id}`, { query: { languageCode: LANGUAGE }, signal })));
}

const codeOf = (title: string) => `${title.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'TRAINING'}-${Date.now().toString(36).toUpperCase()}`;

export const trainingsHttpApi = {
  async list(params: ListParams<TrainingFilters>, signal?: AbortSignal): Promise<Paginated<TrainingDto>> {
    return queryCollection(await all(signal), params, {
      searchFields: (t) => [t.title, t.description, t.trainerName, t.departmentName],
      matches: (t, f) => (!f.status || t.status === f.status) && (!f.departmentId || t.departmentId === f.departmentId),
      sorters: {
        title: (a, b) => a.title.localeCompare(b.title),
        status: (a, b) => TRAINING_STATUSES.indexOf(a.status) - TRAINING_STATUSES.indexOf(b.status),
        department: (a, b) => (a.departmentName ?? '').localeCompare(b.departmentName ?? ''),
        enrollments: (a, b) => a.enrollmentCount - b.enrollmentCount,
        createdAt: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
        order: (a, b) => a.sortOrder - b.sortOrder,
      },
      defaultSort: (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
    });
  },
  async options(signal?: AbortSignal): Promise<TrainingOption[]> {
    return (await all(signal)).map((t) => ({ id: t.id, title: t.title, status: t.status, departmentId: t.departmentId, departmentName: t.departmentName }));
  },
  get: getOne,
  async create(input: CreateTrainingInput): Promise<TrainingDto> {
    const id = createdId(
      await http.post(BASE, {
        code: codeOf(input.title),
        title: input.title.trim(),
        description: input.description.trim(),
        departmentId: input.departmentId || null,
        estimatedDurationHours: input.durationHours,
        isMandatory: false,
        requiresEvaluation: false,
        sortOrder: 0,
        languageCode: LANGUAGE,
      }),
    );
    return getOne(id);
  },
  async update(id: string, input: UpdateTrainingInput): Promise<TrainingDto> {
    const current = asRaw(await http.get(`${BASE}/${id}`, { query: { languageCode: LANGUAGE } }));
    const before = trainingStatusOf(str(current, 'status'));
    await http.put(`${BASE}/${id}`, {
      categoryId: str(current, 'categoryId'),
      departmentId: str(current, 'departmentId'),
      status: input.status === 'draft' ? backendTrainingStatus.draft : (str(current, 'status') ?? backendTrainingStatus[before]),
      trainingType: str(current, 'trainingType'),
      difficultyLevel: str(current, 'difficultyLevel'),
      estimatedDurationHours: input.durationHours,
      passingScore: num(current, 'passingScore'),
      isMandatory: bool(current, 'isMandatory') ?? false,
      requiresEvaluation: bool(current, 'requiresEvaluation') ?? false,
      sortOrder: num(current, 'sortOrder') ?? 0,
      languageCode: LANGUAGE,
      title: input.title.trim(),
      description: input.description.trim(),
      objectives: str(current, 'objectives'),
    });
    if (input.status !== before && input.status === 'published') await http.post(`${BASE}/${id}/publish`);
    if (input.status !== before && input.status === 'archived') await http.post(`${BASE}/${id}/archive`);
    return getOne(id);
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
  async reorder(input: ReorderInput): Promise<void> {
    await http.put(`${BASE}/order`, { trainingIds: input.orderedIds });
  },
  async roster(id: string, signal?: AbortSignal): Promise<TrainingRosterEntry[]> {
    const rows = listOf(await http.get('/api/v1/academy/enrollments', { query: { trainingId: id }, signal }));
    return rows.map((o) => ({
      enrollmentId: str(o, 'id', 'enrollmentId') ?? '',
      userId: str(o, 'userId') ?? '',
      userName: str(o, 'userDisplayName', 'userName', 'displayName', 'traineeName') ?? '',
      userRole: (str(o, 'userRole', 'participantType') ?? 'Employee') as Role,
      status: enrollmentStatusOf(str(o, 'status')),
      progress: Math.round(num(o, 'progressPercentage', 'progress') ?? 0),
      assignedAt: str(o, 'assignedAtUtc', 'enrolledAtUtc', 'createdAtUtc') ?? new Date(0).toISOString(),
      completedAt: str(o, 'completedAtUtc', 'completedAt'),
    }));
  },
};
