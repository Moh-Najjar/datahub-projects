import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { useAuth } from '@/core/context/authContext';
import { settingsKeys } from '@/modules/settings';
import { usersApi } from '@/modules/users/api/usersApi';
import type { AccountStatus, UserFilters, UserInput, UsersCaller, UserUpdate } from '@/modules/users/types/users';

/*
 * Server state of Users & Roles (keys hold the caller). Account writes invalidate `['users']`, the audit log and the
 * employees module (linked accounts). A role-permission change affects every module's access and scope, so it
 * invalidates EVERY query: each module refetches with the permissions in force.
 */

export const userKeys = {
  all: ['users'] as const,
  list: (c: UsersCaller, p: ListParams<UserFilters>) => ['users', 'list', c.userId, c.role, p] as const,
  detail: (c: UsersCaller, id: string) => ['users', 'detail', c.userId, c.role, id] as const,
  roles: (c: UsersCaller) => ['users', 'roles', c.userId, c.role] as const,
  matrix: (c: UsersCaller) => ['users', 'matrix', c.userId, c.role] as const,
};

export function useUsersCaller(): UsersCaller {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const en = user?.name.en ?? '';
  const ar = user?.name.ar ?? '';
  return useMemo(() => ({ userId, role, name: { en, ar } }), [userId, role, en, ar]);
}

export function useUsers(params: ListParams<UserFilters>) {
  const caller = useUsersCaller();
  return useQuery({ queryKey: userKeys.list(caller, params), queryFn: ({ signal }) => usersApi.getUsers(params, caller, signal), placeholderData: keepPreviousData });
}

export function useUser(id: string) {
  const caller = useUsersCaller();
  return useQuery({ queryKey: userKeys.detail(caller, id), queryFn: ({ signal }) => usersApi.getUserById(id, caller, signal) });
}

export function useRoles() {
  const caller = useUsersCaller();
  return useQuery({ queryKey: userKeys.roles(caller), queryFn: ({ signal }) => usersApi.getRoles(caller, signal) });
}

export function usePermissionMatrix() {
  const caller = useUsersCaller();
  return useQuery({ queryKey: userKeys.matrix(caller), queryFn: ({ signal }) => usersApi.getPermissionMatrix(caller, signal) });
}

function useAccountInvalidate() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: userKeys.all }), client.invalidateQueries({ queryKey: settingsKeys.all }), client.invalidateQueries({ queryKey: ['employees'] })]);
}

export function useCreateUser() {
  const caller = useUsersCaller();
  const invalidate = useAccountInvalidate();
  return useMutation({ mutationFn: ({ input, reason }: { input: UserInput; reason: string }) => usersApi.createUser(input, reason, caller), onSuccess: () => invalidate() });
}

export function useUpdateUser(id: string) {
  const caller = useUsersCaller();
  const invalidate = useAccountInvalidate();
  return useMutation({ mutationFn: ({ input, reason }: { input: UserUpdate; reason: string }) => usersApi.updateUser(id, input, reason, caller), onSuccess: () => invalidate() });
}

export function useUserRole(id: string) {
  const caller = useUsersCaller();
  const invalidate = useAccountInvalidate();
  return useMutation({ mutationFn: ({ role, reason }: { role: Role; reason: string }) => usersApi.updateUserRole(id, role, reason, caller), onSuccess: () => invalidate() });
}

export function useUserStatus(id: string) {
  const caller = useUsersCaller();
  const invalidate = useAccountInvalidate();
  return useMutation({ mutationFn: ({ status, reason }: { status: AccountStatus; reason: string }) => usersApi.updateUserStatus(id, status, reason, caller), onSuccess: () => invalidate() });
}

export function useLinkEmployee(id: string) {
  const caller = useUsersCaller();
  const invalidate = useAccountInvalidate();
  return useMutation({ mutationFn: ({ employeeId, reason }: { employeeId: string | null; reason: string }) => usersApi.linkEmployee(id, employeeId, reason, caller), onSuccess: () => invalidate() });
}
