import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import * as mock from '@/modules/users/mock/usersMock';
import type { AccountStatus, PermissionMatrix, RoleSummary, UserDetails, UserFilters, UserInput, UsersCaller, UserSummary, UserUpdate } from '@/modules/users/types/users';

/*
 * Users & Roles API service — the module's only data entry point (MOCK: `mock/usersMock.ts`, in memory). Every call
 * requires `identity.users.manage`; the real backend derives the caller from the token and enforces the same rules.
 */

type Signal = AbortSignal | undefined;

export const usersApi = {
  getUsers: (params: ListParams<UserFilters>, caller: UsersCaller, signal?: Signal): Promise<Paginated<UserSummary>> => mockRequest(() => mock.listUsers(params, caller), { signal }),
  getUserById: (id: string, caller: UsersCaller, signal?: Signal): Promise<UserDetails> => mockRequest(() => mock.getUser(id, caller), { signal }),
  createUser: (input: UserInput, reason: string, caller: UsersCaller): Promise<UserDetails> => mockRequest(() => mock.createUser(input, reason, caller)),
  updateUser: (id: string, input: UserUpdate, reason: string, caller: UsersCaller): Promise<UserDetails> => mockRequest(() => mock.updateUser(id, input, reason, caller)),
  updateUserRole: (id: string, role: Role, reason: string, caller: UsersCaller): Promise<UserDetails> => mockRequest(() => mock.updateUserRole(id, role, reason, caller)),
  updateUserStatus: (id: string, status: AccountStatus, reason: string, caller: UsersCaller): Promise<UserDetails> => mockRequest(() => mock.updateUserStatus(id, status, reason, caller)),
  linkEmployee: (id: string, employeeId: string | null, reason: string, caller: UsersCaller): Promise<UserDetails> => mockRequest(() => mock.linkEmployee(id, employeeId, reason, caller)),

  getRoles: (caller: UsersCaller, signal?: Signal): Promise<RoleSummary[]> => mockRequest(() => mock.listRoles(caller), { signal }),
  getPermissionMatrix: (caller: UsersCaller, signal?: Signal): Promise<PermissionMatrix> => mockRequest(() => mock.permissionMatrix(caller), { signal }),
};
