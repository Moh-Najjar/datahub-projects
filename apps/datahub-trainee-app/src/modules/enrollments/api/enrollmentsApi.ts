import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { enrollmentsMock } from '../mock/enrollmentsMock';
import type { CreateEnrollmentInput, EnrollmentDto, EnrollmentFilters, UpdateEnrollmentProgressInput, UpdateEnrollmentStatusInput } from '../types/enrollment';

/** The ONLY data entry point of the Enrollments module (today: the simulated backend; later: HTTP, same types). */
export const enrollmentsApi = {
  list: (params: ListParams<EnrollmentFilters>, signal?: AbortSignal): Promise<Paginated<EnrollmentDto>> => mockRequest(() => enrollmentsMock.list(params), { signal }),
  listForUser: (userId: string, signal?: AbortSignal): Promise<EnrollmentDto[]> => mockRequest(() => enrollmentsMock.listForUser(userId), { signal }),
  create: (input: CreateEnrollmentInput): Promise<EnrollmentDto> => mockRequest(() => enrollmentsMock.create(input)),
  updateStatus: (id: string, input: UpdateEnrollmentStatusInput): Promise<EnrollmentDto> => mockRequest(() => enrollmentsMock.updateStatus(id, input)),
  updateProgress: (id: string, input: UpdateEnrollmentProgressInput): Promise<EnrollmentDto> => mockRequest(() => enrollmentsMock.updateProgress(id, input)),
  remove: (id: string): Promise<void> => mockRequest(() => enrollmentsMock.remove(id)),
};
