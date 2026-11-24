import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useActorKey } from '@/core/hooks/useActorKey';
import { assignmentsApi, materialsApi, trainingsApi } from '../api/trainingsApi';
import type { CreateAssignmentInput, FileInput, FileMaterialInput, LinkMaterialInput, SubmissionInput, TextMaterialInput, UpdateAssignmentInput } from '../types/content';
import type { CreateTrainingInput, TrainingFilters, UpdateTrainingInput } from '../types/training';

/** Query keys: every key carries the training identity (`actor`), so "view as" never shows another user's data. */
export const trainingKeys = {
  all: ['trainings'] as const,
  list: (actor: string, params: ListParams<TrainingFilters>) => ['trainings', actor, 'list', params] as const,
  options: (actor: string) => ['trainings', actor, 'options'] as const,
  detail: (actor: string, id: string) => ['trainings', actor, 'detail', id] as const,
  roster: (actor: string, id: string) => ['trainings', actor, 'roster', id] as const,
  materials: (actor: string, id: string) => ['trainings', actor, 'materials', id] as const,
  assignments: (actor: string, id: string) => ['trainings', actor, 'assignments', id] as const,
  submissions: (actor: string, trainingId: string, assignmentId: string) => ['trainings', actor, 'submissions', trainingId, assignmentId] as const,
};

export function useTrainings(params: ListParams<TrainingFilters>) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.list(actor, params), queryFn: ({ signal }) => trainingsApi.list(params, signal), placeholderData: keepPreviousData });
}

/** Trainings in the caller's scope for selects and filters (SuperAdmin / DepartmentAdmin). */
export function useTrainingOptions(enabled = true) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.options(actor), queryFn: ({ signal }) => trainingsApi.options(signal), enabled });
}

export function useTraining(id: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.detail(actor, id ?? ''), queryFn: ({ signal }) => trainingsApi.get(id!, signal), enabled: !!id });
}

export function useTrainingRoster(id: string | undefined, enabled: boolean) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.roster(actor, id ?? ''), queryFn: ({ signal }) => trainingsApi.roster(id!, signal), enabled: !!id && enabled });
}

export function useMaterials(trainingId: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.materials(actor, trainingId ?? ''), queryFn: ({ signal }) => materialsApi.list(trainingId!, signal), enabled: !!trainingId });
}

export function useAssignments(trainingId: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.assignments(actor, trainingId ?? ''), queryFn: ({ signal }) => assignmentsApi.list(trainingId!, signal), enabled: !!trainingId });
}

export function useSubmissions(trainingId: string, assignmentId: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: trainingKeys.submissions(actor, trainingId, assignmentId ?? ''), queryFn: ({ signal }) => assignmentsApi.submissions(trainingId, assignmentId!, signal), enabled: !!assignmentId });
}

/** Writes in this module change trainings, and what other modules show about them (enrollments, dashboard, …). */
function useInvalidateTrainings() {
  const queryClient = useQueryClient();
  return () => Promise.all(['trainings', 'enrollments', 'dashboard', 'departments', 'certificates', 'rankings', 'evaluations'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useCreateTraining() {
  const invalidate = useInvalidateTrainings();
  return useMutation({ mutationFn: (input: CreateTrainingInput) => trainingsApi.create(input), onSuccess: invalidate });
}

export function useUpdateTraining() {
  const invalidate = useInvalidateTrainings();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateTrainingInput }) => trainingsApi.update(id, input), onSuccess: invalidate });
}

export function useDeleteTraining() {
  const invalidate = useInvalidateTrainings();
  return useMutation({ mutationFn: (id: string) => trainingsApi.remove(id), onSuccess: invalidate });
}

export function useReorderTrainings() {
  const invalidate = useInvalidateTrainings();
  return useMutation({ mutationFn: (orderedIds: string[]) => trainingsApi.reorder({ orderedIds }), onSuccess: invalidate });
}

/** Every content write: one mutation per original endpoint. */
export function useMaterialMutations(trainingId: string) {
  const invalidate = useInvalidateTrainings();
  const opts = { onSuccess: invalidate };
  return {
    addText: useMutation({ mutationFn: (input: TextMaterialInput) => materialsApi.addText(trainingId, input), ...opts }),
    addLinks: useMutation({ mutationFn: (input: LinkMaterialInput) => materialsApi.addLinks(trainingId, input), ...opts }),
    addFiles: useMutation({ mutationFn: (input: FileMaterialInput) => materialsApi.addFiles(trainingId, input), ...opts }),
    updateText: useMutation({ mutationFn: ({ id, input }: { id: string; input: TextMaterialInput }) => materialsApi.updateText(id, input), ...opts }),
    updateLinks: useMutation({ mutationFn: ({ id, input }: { id: string; input: LinkMaterialInput }) => materialsApi.updateLinks(id, input), ...opts }),
    renameFiles: useMutation({ mutationFn: ({ id, title }: { id: string; title: string }) => materialsApi.renameFiles(id, title), ...opts }),
    addFileItems: useMutation({ mutationFn: ({ id, files }: { id: string; files: FileInput[] }) => materialsApi.addFileItems(id, files), ...opts }),
    updateFileItem: useMutation({ mutationFn: ({ id, fileId, title }: { id: string; fileId: string; title: string | null }) => materialsApi.updateFileItem(id, fileId, title), ...opts }),
    deleteFileItem: useMutation({ mutationFn: ({ id, fileId }: { id: string; fileId: string }) => materialsApi.deleteFileItem(id, fileId), ...opts }),
    remove: useMutation({ mutationFn: (id: string) => materialsApi.remove(id), ...opts }),
    reorder: useMutation({ mutationFn: (orderedIds: string[]) => materialsApi.reorder(trainingId, { orderedIds }), ...opts }),
  };
}

export function useAssignmentMutations(trainingId: string) {
  const invalidate = useInvalidateTrainings();
  const opts = { onSuccess: invalidate };
  return {
    create: useMutation({ mutationFn: (input: CreateAssignmentInput) => assignmentsApi.create(trainingId, input), ...opts }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateAssignmentInput }) => assignmentsApi.update(id, input), ...opts }),
    remove: useMutation({ mutationFn: (id: string) => assignmentsApi.remove(id), ...opts }),
    addAttachments: useMutation({ mutationFn: ({ id, files }: { id: string; files: FileInput[] }) => assignmentsApi.addAttachments(id, files), ...opts }),
    deleteAttachment: useMutation({ mutationFn: ({ id, attachmentId }: { id: string; attachmentId: string }) => assignmentsApi.deleteAttachment(id, attachmentId), ...opts }),
    submit: useMutation({ mutationFn: ({ id, input }: { id: string; input: SubmissionInput }) => assignmentsApi.submit(trainingId, id, input), ...opts }),
    deleteSubmissionAttachment: useMutation({ mutationFn: ({ id, attachmentId }: { id: string; attachmentId: string }) => assignmentsApi.deleteSubmissionAttachment(trainingId, id, attachmentId), ...opts }),
  };
}
