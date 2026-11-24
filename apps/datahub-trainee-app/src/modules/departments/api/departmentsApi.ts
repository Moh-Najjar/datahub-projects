import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { departmentsMock } from '../mock/departmentsMock';
import type { DepartmentDto, DepartmentFilters, DepartmentInput, DepartmentOption } from '../types/department';

/**
 * The ONLY data entry point of the Departments module. Today it calls the simulated backend; a real backend replaces
 * these bodies with HTTP calls returning the same types — no hook or component changes.
 */
export const departmentsApi = {
  list: (params: ListParams<DepartmentFilters>, signal?: AbortSignal): Promise<Paginated<DepartmentDto>> => mockRequest(() => departmentsMock.list(params), { signal }),
  options: (signal?: AbortSignal): Promise<DepartmentOption[]> => mockRequest(() => departmentsMock.options(), { signal }),
  create: (input: DepartmentInput): Promise<DepartmentDto> => mockRequest(() => departmentsMock.create(input)),
  update: (id: string, input: DepartmentInput): Promise<DepartmentDto> => mockRequest(() => departmentsMock.update(id, input)),
  remove: (id: string): Promise<void> => mockRequest(() => departmentsMock.remove(id)),
};
