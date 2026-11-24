import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActorKey } from '@/core/hooks/useActorKey';
import { evaluationsApi } from '../api/evaluationsApi';
import type { CreateEvaluationInput, UpdateEvaluationInput } from '../types/evaluation';

export const evaluationKeys = {
  all: ['evaluations'] as const,
  forUser: (actor: string, userId: string) => ['evaluations', actor, 'user', userId] as const,
};

export function useEvaluations(userId: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: evaluationKeys.forUser(actor, userId ?? ''), queryFn: ({ signal }) => evaluationsApi.listForUser(userId!, signal), enabled: !!userId });
}

/** An evaluation changes the rankings, the dashboard activity and the person's history. */
function useInvalidateEvaluations() {
  const queryClient = useQueryClient();
  return () => Promise.all(['evaluations', 'rankings', 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useCreateEvaluation(userId: string) {
  const invalidate = useInvalidateEvaluations();
  return useMutation({ mutationFn: (input: CreateEvaluationInput) => evaluationsApi.create(userId, input), onSuccess: invalidate });
}

export function useUpdateEvaluation() {
  const invalidate = useInvalidateEvaluations();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateEvaluationInput }) => evaluationsApi.update(id, input), onSuccess: invalidate });
}

export function useDeleteEvaluation() {
  const invalidate = useInvalidateEvaluations();
  return useMutation({ mutationFn: (id: string) => evaluationsApi.remove(id), onSuccess: invalidate });
}
