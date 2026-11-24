import { backendEnrollmentStatus, enrollmentStatusOf } from '@/core/api/academyStatus';
import { createdId, http } from '@/core/api/http';
import { queryCollection } from '@/core/api/listing';
import { listOf, num, str, type Raw } from '@/core/api/read';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import type { Role } from '@/core/domain/training';
import type { CreateEnrollmentInput, EnrollmentDto, EnrollmentFilters, UpdateEnrollmentProgressInput, UpdateEnrollmentStatusInput } from '../types/enrollment';

/*
 * Enrollments on the real backend: `/api/v1/academy/enrollments` (filters `search`, `trainingId`, `userId`, `status` on
 * the server; sorting and paging here). Status: `PUT /enrollments/{id}`; progress: `PUT /enrollments/{id}/progress`.
 * Completing an enrollment also issues its certificate (`POST /enrollments/{id}/certificate`), like the original portal
 * where a completed training always has a certificate. Response fields are read tolerantly (no documented model).
 */

const BASE = '/api/v1/academy/enrollments';

export function toEnrollmentDto(o: Raw): EnrollmentDto {
  return {
    id: str(o, 'id', 'enrollmentId') ?? '',
    trainingId: str(o, 'trainingId') ?? '',
    trainingTitle: str(o, 'trainingTitle', 'trainingName', 'title') ?? '',
    departmentId: str(o, 'departmentId') ?? '',
    departmentName: str(o, 'departmentName', 'department'),
    userId: str(o, 'userId') ?? '',
    userName: str(o, 'userDisplayName', 'userName', 'displayName', 'traineeName') ?? '',
    userRole: (str(o, 'userRole', 'participantType') ?? 'Employee') as Role,
    assignedByUserId: str(o, 'assignedByUserId', 'createdByUserId') ?? '',
    assignedByUserName: str(o, 'assignedByUserName', 'createdByUserName'),
    status: enrollmentStatusOf(str(o, 'status')),
    progress: Math.round(num(o, 'progressPercentage', 'progress') ?? 0),
    assignedAt: str(o, 'assignedAtUtc', 'enrolledAtUtc', 'createdAtUtc', 'assignedAt') ?? new Date(0).toISOString(),
    completedAt: str(o, 'completedAtUtc', 'completedAt'),
  };
}

async function fetchAll(query: Record<string, string | undefined>, signal?: AbortSignal): Promise<EnrollmentDto[]> {
  return listOf(await http.get(BASE, { query, signal })).map(toEnrollmentDto);
}

async function byId(id: string, hint: Partial<Record<'trainingId' | 'userId', string>> = {}): Promise<EnrollmentDto> {
  const found = (await fetchAll(hint)).find((e) => e.id === id);
  if (!found) throw new ApiError('NOT_FOUND', 'enrollment.notFound');
  return found;
}

export const enrollmentsHttpApi = {
  async list(params: ListParams<EnrollmentFilters>, signal?: AbortSignal): Promise<Paginated<EnrollmentDto>> {
    const f = params.filters ?? {};
    const rows = await fetchAll({ search: params.search, trainingId: f.trainingId, userId: f.userId, status: f.status ? backendEnrollmentStatus[f.status] : undefined }, signal);
    return queryCollection(rows, { ...params, search: undefined, filters: undefined }, {
      searchFields: () => [],
      sorters: {
        user: (a, b) => a.userName.localeCompare(b.userName),
        training: (a, b) => a.trainingTitle.localeCompare(b.trainingTitle),
        status: (a, b) => a.status.localeCompare(b.status),
        progress: (a, b) => a.progress - b.progress,
        assignedAt: (a, b) => a.assignedAt.localeCompare(b.assignedAt),
        completedAt: (a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
      },
      defaultSort: (a, b) => b.assignedAt.localeCompare(a.assignedAt),
    });
  },
  listForUser: (userId: string, signal?: AbortSignal): Promise<EnrollmentDto[]> => fetchAll({ userId }, signal),
  async create(input: CreateEnrollmentInput): Promise<EnrollmentDto> {
    const id = createdId(await http.post(BASE, { trainingId: input.trainingId, userId: input.userId }));
    return byId(id, { trainingId: input.trainingId });
  },
  async updateStatus(id: string, input: UpdateEnrollmentStatusInput): Promise<EnrollmentDto> {
    const completed = input.status === 'completed';
    await http.put(`${BASE}/${id}`, { status: backendEnrollmentStatus[input.status], completedAtUtc: completed ? new Date().toISOString() : null });
    if (completed) {
      // The certificate of a completed training (already issued → the backend refuses; that is fine).
      await http.post(`${BASE}/${id}/certificate`).catch(() => undefined);
    }
    return byId(id);
  },
  async updateProgress(id: string, input: UpdateEnrollmentProgressInput): Promise<EnrollmentDto> {
    await http.put(`${BASE}/${id}/progress`, { progressPercentage: input.progress });
    return byId(id);
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};
