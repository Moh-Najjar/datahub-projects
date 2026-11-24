import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActorKey } from '@/core/hooks/useActorKey';
import type { ListParams } from '@/core/api/types';
import { departmentsApi } from '../api/departmentsApi';
import type { DepartmentFilters, DepartmentInput } from '../types/department';

export const departmentKeys = {
  all: ['departments'] as const,
  list: (actor: string, params: ListParams<DepartmentFilters>) => ['departments', actor, 'list', params] as const,
  options: (actor: string) => ['departments', actor, 'options'] as const,
};

export function useDepartments(params: ListParams<DepartmentFilters>) {
  const actor = useActorKey();
  return useQuery({ queryKey: departmentKeys.list(actor, params), queryFn: ({ signal }) => departmentsApi.list(params, signal), placeholderData: keepPreviousData });
}

/** Departments for selects and filters (the caller's scope: DepartmentAdmin sees only their own). */
export function useDepartmentOptions(enabled = true) {
  const actor = useActorKey();
  return useQuery({ queryKey: departmentKeys.options(actor), queryFn: ({ signal }) => departmentsApi.options(signal), enabled, staleTime: 60_000 });
}

/** Department writes also change the counts and names shown by users and trainings. */
function useInvalidateDepartments() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: ['departments'] }), queryClient.invalidateQueries({ queryKey: ['users'] }), queryClient.invalidateQueries({ queryKey: ['trainings'] })]);
}

export function useCreateDepartment() {
  const invalidate = useInvalidateDepartments();
  return useMutation({ mutationFn: (input: DepartmentInput) => departmentsApi.create(input), onSuccess: invalidate });
}

export function useUpdateDepartment() {
  const invalidate = useInvalidateDepartments();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: DepartmentInput }) => departmentsApi.update(id, input), onSuccess: invalidate });
}

export function useDeleteDepartment() {
  const invalidate = useInvalidateDepartments();
  return useMutation({ mutationFn: (id: string) => departmentsApi.remove(id), onSuccess: invalidate });
}
