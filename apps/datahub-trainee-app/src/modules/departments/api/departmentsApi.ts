import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { departmentsMock } from '../mock/departmentsMock';
import type { DepartmentDto, DepartmentFilters, DepartmentInput, DepartmentOption } from '../types/department';
import { usesMockData } from '@/core/config/api';
import { departmentsHttpApi } from './departmentsHttp';

/**
 * The ONLY data entry point of the Departments module: the real backend (departmentsHttp.ts) or the simulated one —
 * same types, so hooks and components don't know which runs.
 */
const mockDepartmentsApi = {
  list: (params: ListParams<DepartmentFilters>, signal?: AbortSignal): Promise<Paginated<DepartmentDto>> => mockRequest(() => departmentsMock.list(params), { signal }),
  options: (signal?: AbortSignal): Promise<DepartmentOption[]> => mockRequest(() => departmentsMock.options(), { signal }),
  create: (input: DepartmentInput): Promise<DepartmentDto> => mockRequest(() => departmentsMock.create(input)),
  update: (id: string, input: DepartmentInput): Promise<DepartmentDto> => mockRequest(() => departmentsMock.update(id, input)),
  remove: (id: string): Promise<void> => mockRequest(() => departmentsMock.remove(id)),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const departmentsApi: typeof mockDepartmentsApi = usesMockData ? mockDepartmentsApi : departmentsHttpApi;
