import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { usersMock } from '../mock/usersMock';
import type { CreateUserInput, UpdateUserInput, UserDto, UserFilters } from '../types/user';

/** The ONLY data entry point of the Users module (today: the simulated backend; later: HTTP, same types). */
export const usersApi = {
  list: (params: ListParams<UserFilters>, signal?: AbortSignal): Promise<Paginated<UserDto>> => mockRequest(() => usersMock.list(params), { signal }),
  assignable: (signal?: AbortSignal): Promise<UserDto[]> => mockRequest(() => usersMock.assignable(), { signal }),
  get: (id: string, signal?: AbortSignal): Promise<UserDto> => mockRequest(() => usersMock.get(id), { signal }),
  create: (input: CreateUserInput): Promise<UserDto> => mockRequest(() => usersMock.create(input)),
  update: (id: string, input: UpdateUserInput): Promise<UserDto> => mockRequest(() => usersMock.update(id, input)),
  remove: (id: string): Promise<void> => mockRequest(() => usersMock.remove(id)),
};
