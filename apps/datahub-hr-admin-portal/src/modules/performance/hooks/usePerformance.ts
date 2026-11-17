import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { performanceApi } from '@/modules/performance/api/performanceApi';
import type {
  CompetencyFilters,
  CompetencyInput,
  CycleFilters,
  CycleInput,
  CycleStatus,
  GoalFilters,
  GoalInput,
  GoalProgressInput,
  ManagerReviewInput,
  PerformanceScope,
  PlanActivity,
  PlanFilters,
  PlanInput,
  RatingLevel,
  RecordStatus,
  ReviewFilters,
  ReviewState,
  SelfAssessmentInput,
  TemplateInput,
} from '@/modules/performance/types/performance';
import { usePerformanceAccess } from './usePerformanceAccess';

/**
 * Query keys: `['performance', <resource>, scope, …]` — the scope is part of every read key, so team or own-only data
 * is never served from an organization-wide cache entry.
 */
export const performanceKeys = {
  all: ['performance'] as const,
  summary: (s: PerformanceScope) => [...performanceKeys.all, 'summary', s] as const,
  cycles: (s: PerformanceScope, p: ListParams<CycleFilters>) => [...performanceKeys.all, 'cycles', 'list', s, p] as const,
  cycle: (s: PerformanceScope, id: string) => [...performanceKeys.all, 'cycles', 'detail', s, id] as const,
  participants: (s: PerformanceScope, id: string, p: ListParams<{ state: ReviewState }>) => [...performanceKeys.all, 'cycles', 'participants', s, id, p] as const,
  goals: (s: PerformanceScope, p: ListParams<GoalFilters>) => [...performanceKeys.all, 'goals', 'list', s, p] as const,
  goal: (s: PerformanceScope, id: string) => [...performanceKeys.all, 'goals', 'detail', s, id] as const,
  reviews: (s: PerformanceScope, p: ListParams<ReviewFilters>) => [...performanceKeys.all, 'reviews', 'list', s, p] as const,
  review: (s: PerformanceScope, id: string) => [...performanceKeys.all, 'reviews', 'detail', s, id] as const,
  competencies: (s: PerformanceScope, p: ListParams<CompetencyFilters>) => [...performanceKeys.all, 'competencies', s, p] as const,
  templates: (s: PerformanceScope) => [...performanceKeys.all, 'templates', s] as const,
  scale: (s: PerformanceScope) => [...performanceKeys.all, 'scale', s] as const,
  plans: (s: PerformanceScope, p: ListParams<PlanFilters>) => [...performanceKeys.all, 'plans', 'list', s, p] as const,
  plan: (s: PerformanceScope, id: string) => [...performanceKeys.all, 'plans', 'detail', s, id] as const,
  history: (s: PerformanceScope, employeeId: string) => [...performanceKeys.all, 'history', s, employeeId] as const,
  options: (s: PerformanceScope, search: string, purpose: string) => [...performanceKeys.all, 'options', s, purpose, search] as const,
};

/* Queries ------------------------------------------------------------------------------------------- */

export function usePerformanceSummary() {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.summary(scope), queryFn: ({ signal }) => performanceApi.getPerformanceSummary(scope, signal), staleTime: 60_000 });
}
export function useReviewCycles(params: ListParams<CycleFilters>, enabled = true) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.cycles(scope, params), queryFn: ({ signal }) => performanceApi.getReviewCycles(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useReviewCycle(id: string) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.cycle(scope, id), queryFn: ({ signal }) => performanceApi.getReviewCycleById(id, scope, signal) });
}
export function useCycleParticipants(id: string, params: ListParams<{ state: ReviewState }>) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.participants(scope, id, params), queryFn: ({ signal }) => performanceApi.getCycleParticipants(id, params, scope, signal), placeholderData: keepPreviousData });
}
export function useGoals(params: ListParams<GoalFilters>, enabled = true) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.goals(scope, params), queryFn: ({ signal }) => performanceApi.getGoals(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useGoal(id: string, enabled = true) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.goal(scope, id), queryFn: ({ signal }) => performanceApi.getGoalById(id, scope, signal), enabled });
}
export function useReviews(params: ListParams<ReviewFilters>, enabled = true) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.reviews(scope, params), queryFn: ({ signal }) => performanceApi.getReviews(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useReview(id: string) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.review(scope, id), queryFn: ({ signal }) => performanceApi.getReviewById(id, scope, signal) });
}
export function useCompetencies(params: ListParams<CompetencyFilters>) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.competencies(scope, params), queryFn: ({ signal }) => performanceApi.getCompetencies(params, scope, signal), placeholderData: keepPreviousData });
}
export function useReviewTemplates() {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.templates(scope), queryFn: ({ signal }) => performanceApi.getReviewTemplates(scope, signal) });
}
export function useRatingScale() {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.scale(scope), queryFn: ({ signal }) => performanceApi.getRatingScale(scope, signal), staleTime: 5 * 60_000 });
}
export function usePlans(params: ListParams<PlanFilters>, enabled = true) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.plans(scope, params), queryFn: ({ signal }) => performanceApi.getDevelopmentPlans(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function usePlan(id: string) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.plan(scope, id), queryFn: ({ signal }) => performanceApi.getDevelopmentPlanById(id, scope, signal) });
}
export function usePerformanceHistory(employeeId: string) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.history(scope, employeeId), queryFn: ({ signal }) => performanceApi.getEmployeePerformanceHistory(employeeId, scope, signal), enabled: Boolean(employeeId) });
}
export function useEmployeeOptions(search: string, purpose: 'manage' | 'participants', enabled = true) {
  const { scope } = usePerformanceAccess();
  return useQuery({ queryKey: performanceKeys.options(scope, search, purpose), queryFn: ({ signal }) => performanceApi.getEmployeeOptions(search, purpose, scope, signal), placeholderData: keepPreviousData, enabled, staleTime: 60_000 });
}

/* Mutations ----------------------------------------------------------------------------------------- */

/** Performance records are interlinked (goals ↔ reviews ↔ cycle progress ↔ overview): any write refreshes the module. */
function useWrite<TVars, TResult>(fn: (vars: TVars, scope: PerformanceScope) => Promise<TResult>) {
  const { scope } = usePerformanceAccess();
  const client = useQueryClient();
  return useMutation({ mutationFn: (vars: TVars) => fn(vars, scope), onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.all }) });
}

export const useCreateCycle = () => useWrite((input: CycleInput, s) => performanceApi.createReviewCycle(input, s));
export const useUpdateCycle = () => useWrite(({ id, input }: { id: string; input: CycleInput }, s) => performanceApi.updateReviewCycle(id, input, s));
export const useUpdateCycleStatus = () => useWrite(({ id, status, note }: { id: string; status: CycleStatus; note: string }, s) => performanceApi.updateReviewCycleStatus(id, status, note, s));
export const useAssignParticipants = () => useWrite(({ id, add, remove }: { id: string; add: string[]; remove: string[] }, s) => performanceApi.assignCycleParticipants(id, { add, remove }, s));

export const useCreateGoal = () => useWrite((input: GoalInput, s) => performanceApi.createGoal(input, s));
export const useUpdateGoal = () => useWrite(({ id, input }: { id: string; input: GoalInput }, s) => performanceApi.updateGoal(id, input, s));
export const useUpdateGoalProgress = () => useWrite(({ id, input }: { id: string; input: GoalProgressInput }, s) => performanceApi.updateGoalProgress(id, input, s));

export const useSubmitSelfAssessment = () => useWrite(({ id, input }: { id: string; input: SelfAssessmentInput }, s) => performanceApi.submitSelfAssessment(id, input, s));
export const useSubmitManagerReview = () => useWrite(({ id, input }: { id: string; input: ManagerReviewInput }, s) => performanceApi.submitManagerReview(id, input, s));
export const useReopenReview = () => useWrite(({ id, part }: { id: string; part: 'self' | 'manager' }, s) => performanceApi.reopenReview(id, part, s));

export const useCreateCompetency = () => useWrite((input: CompetencyInput, s) => performanceApi.createCompetency(input, s));
export const useUpdateCompetency = () => useWrite(({ id, input }: { id: string; input: CompetencyInput }, s) => performanceApi.updateCompetency(id, input, s));
export const useUpdateCompetencyStatus = () => useWrite(({ id, status }: { id: string; status: RecordStatus }, s) => performanceApi.updateCompetencyStatus(id, status, s));
export const useCreateTemplate = () => useWrite((input: TemplateInput, s) => performanceApi.createReviewTemplate(input, s));
export const useUpdateTemplate = () => useWrite(({ id, input }: { id: string; input: TemplateInput }, s) => performanceApi.updateReviewTemplate(id, input, s));
export const useUpdateRatingScale = () => useWrite((levels: RatingLevel[], s) => performanceApi.updateRatingScale(levels, s));

export const useCreatePlan = () => useWrite((input: PlanInput, s) => performanceApi.createDevelopmentPlan(input, s));
export const useUpdatePlan = () => useWrite(({ id, input }: { id: string; input: PlanInput }, s) => performanceApi.updateDevelopmentPlan(id, input, s));
export const useUpdatePlanActivities = () => useWrite(({ id, changes }: { id: string; changes: Array<{ id: string; status: PlanActivity['status'] }> }, s) => performanceApi.updatePlanActivities(id, changes, s));
