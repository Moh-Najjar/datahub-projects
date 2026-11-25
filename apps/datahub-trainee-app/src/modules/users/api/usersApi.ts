import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { usersMock } from '../mock/usersMock';
import { ROLES } from '@/core/domain/training';
import type { CreateUserInput, RoleOption, UpdateUserInput, UserDto, UserFilters } from '../types/user';
import { usesMockData } from '@/core/config/api';
import { usersHttpApi } from './usersHttp';

/** The ONLY data entry point of the Users module (the real backend over HTTP, or the simulated one — same types). */
const mockUsersApi = {
  list: (params: ListParams<UserFilters>, signal?: AbortSignal): Promise<Paginated<UserDto>> => mockRequest(() => usersMock.list(params), { signal }),
  assignable: (signal?: AbortSignal): Promise<UserDto[]> => mockRequest(() => usersMock.assignable(), { signal }),
  get: (id: string, signal?: AbortSignal): Promise<UserDto> => mockRequest(() => usersMock.get(id), { signal }),
  create: (input: CreateUserInput): Promise<UserDto> => mockRequest(() => usersMock.create(input)),
  update: (id: string, input: UpdateUserInput): Promise<UserDto> => mockRequest(() => usersMock.update(id, input)),
  remove: (id: string): Promise<void> => mockRequest(() => usersMock.remove(id)),
  /** The choices of the user form's Role field: the app roles (labels translated by the UI). */
  roleOptions: (signal?: AbortSignal): Promise<RoleOption[]> => mockRequest(() => ROLES.map((value) => ({ value, label: null })), { signal }),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const usersApi: typeof mockUsersApi = usesMockData ? mockUsersApi : usersHttpApi;
