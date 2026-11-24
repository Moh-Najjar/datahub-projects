import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useActorKey } from '@/core/hooks/useActorKey';
import { usersApi } from '../api/usersApi';
import type { CreateUserInput, UpdateUserInput, UserFilters } from '../types/user';

export const userKeys = {
  all: ['users'] as const,
  list: (actor: string, params: ListParams<UserFilters>) => ['users', actor, 'list', params] as const,
  assignable: (actor: string) => ['users', actor, 'assignable'] as const,
  detail: (actor: string, id: string) => ['users', actor, 'detail', id] as const,
};

export function useUsers(params: ListParams<UserFilters>) {
  const actor = useActorKey();
  return useQuery({ queryKey: userKeys.list(actor, params), queryFn: ({ signal }) => usersApi.list(params, signal), placeholderData: keepPreviousData });
}

/** Active Intern / Trainee / Employee users (the enrollment picker). */
export function useAssignableUsers(enabled = true) {
  const actor = useActorKey();
  return useQuery({ queryKey: userKeys.assignable(actor), queryFn: ({ signal }) => usersApi.assignable(signal), enabled });
}

export function useUser(id: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: userKeys.detail(actor, id ?? ''), queryFn: ({ signal }) => usersApi.get(id!, signal), enabled: !!id });
}

/** A user change shows up in enrollments, rankings, evaluations, trainings (trainer) and the dashboard. */
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => Promise.all(['users', 'enrollments', 'rankings', 'evaluations', 'trainings', 'dashboard', 'certificates', 'departments'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: (input: CreateUserInput) => usersApi.create(input), onSuccess: invalidate });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => usersApi.update(id, input), onSuccess: invalidate });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: (id: string) => usersApi.remove(id), onSuccess: invalidate });
}
