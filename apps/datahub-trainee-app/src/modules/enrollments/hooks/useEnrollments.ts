import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useActorKey } from '@/core/hooks/useActorKey';
import { enrollmentsApi } from '../api/enrollmentsApi';
import type { CreateEnrollmentInput, EnrollmentFilters, UpdateEnrollmentProgressInput, UpdateEnrollmentStatusInput } from '../types/enrollment';

export const enrollmentKeys = {
  all: ['enrollments'] as const,
  list: (actor: string, params: ListParams<EnrollmentFilters>) => ['enrollments', actor, 'list', params] as const,
  forUser: (actor: string, userId: string) => ['enrollments', actor, 'user', userId] as const,
};

export function useEnrollments(params: ListParams<EnrollmentFilters>, enabled = true) {
  const actor = useActorKey();
  return useQuery({ queryKey: enrollmentKeys.list(actor, params), queryFn: ({ signal }) => enrollmentsApi.list(params, signal), placeholderData: keepPreviousData, enabled });
}

/** One person's enrollments (for linking an evaluation to a training). */
export function useEnrollmentsOfUser(userId: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: enrollmentKeys.forUser(actor, userId ?? ''), queryFn: ({ signal }) => enrollmentsApi.listForUser(userId!, signal), enabled: !!userId });
}

/** An enrollment change shows up in trainings (counts, rosters), certificates, the dashboard and rankings. */
function useInvalidateEnrollments() {
  const queryClient = useQueryClient();
  return () => Promise.all(['enrollments', 'trainings', 'certificates', 'dashboard', 'rankings', 'evaluations'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useCreateEnrollment() {
  const invalidate = useInvalidateEnrollments();
  return useMutation({ mutationFn: (input: CreateEnrollmentInput) => enrollmentsApi.create(input), onSuccess: invalidate });
}

export function useUpdateEnrollmentStatus() {
  const invalidate = useInvalidateEnrollments();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateEnrollmentStatusInput }) => enrollmentsApi.updateStatus(id, input), onSuccess: invalidate });
}

export function useUpdateEnrollmentProgress() {
  const invalidate = useInvalidateEnrollments();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateEnrollmentProgressInput }) => enrollmentsApi.updateProgress(id, input), onSuccess: invalidate });
}

export function useDeleteEnrollment() {
  const invalidate = useInvalidateEnrollments();
  return useMutation({ mutationFn: (id: string) => enrollmentsApi.remove(id), onSuccess: invalidate });
}
