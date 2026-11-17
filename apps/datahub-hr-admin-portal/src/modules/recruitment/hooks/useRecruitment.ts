import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { employeeKeys, type EmployeeInput } from '@/modules/employees';
import { organizationKeys } from '@/modules/organization';
import { recruitmentApi } from '@/modules/recruitment/api/recruitmentApi';
import type {
  CandidateFilters,
  CandidateInput,
  CandidateStage,
  FeedbackInput,
  InterviewFilters,
  InterviewInput,
  OfferFilters,
  OfferInput,
  OfferStatus,
  RecruitmentScope,
  RequisitionFilters,
  RequisitionInput,
  RequisitionStatus,
} from '@/modules/recruitment/types/recruitment';
import { useRecruitmentAccess } from './useRecruitmentAccess';

/**
 * Query keys: `['recruitment', <resource>, scope, …]` — the scope is part of every read key, so team-scoped data is
 * never served from an organization-wide cache entry.
 */
export const recruitmentKeys = {
  all: ['recruitment'] as const,
  summary: (scope: RecruitmentScope) => [...recruitmentKeys.all, 'summary', scope] as const,
  requisitions: (scope: RecruitmentScope, params: ListParams<RequisitionFilters>) => [...recruitmentKeys.all, 'requisitions', 'list', scope, params] as const,
  requisition: (scope: RecruitmentScope, id: string) => [...recruitmentKeys.all, 'requisitions', 'detail', scope, id] as const,
  candidates: (scope: RecruitmentScope, params: ListParams<CandidateFilters>) => [...recruitmentKeys.all, 'candidates', 'list', scope, params] as const,
  candidate: (scope: RecruitmentScope, id: string) => [...recruitmentKeys.all, 'candidates', 'detail', scope, id] as const,
  history: (scope: RecruitmentScope, id: string) => [...recruitmentKeys.all, 'candidates', 'history', scope, id] as const,
  interviews: (scope: RecruitmentScope, params: ListParams<InterviewFilters>) => [...recruitmentKeys.all, 'interviews', 'list', scope, params] as const,
  interview: (scope: RecruitmentScope, id: string) => [...recruitmentKeys.all, 'interviews', 'detail', scope, id] as const,
  offers: (scope: RecruitmentScope, params: ListParams<OfferFilters>) => [...recruitmentKeys.all, 'offers', 'list', scope, params] as const,
  offer: (scope: RecruitmentScope, id: string) => [...recruitmentKeys.all, 'offers', 'detail', scope, id] as const,
  staff: (scope: RecruitmentScope, search: string) => [...recruitmentKeys.all, 'staff', scope, search] as const,
  conversion: (scope: RecruitmentScope, candidateId: string) => [...recruitmentKeys.all, 'conversion', scope, candidateId] as const,
};


/* Queries ------------------------------------------------------------------------------------------- */

export function useRecruitmentSummary() {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.summary(scope), queryFn: ({ signal }) => recruitmentApi.getRecruitmentSummary(scope, signal), staleTime: 60_000 });
}

export function useRequisitions(params: ListParams<RequisitionFilters>, enabled = true) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.requisitions(scope, params), queryFn: ({ signal }) => recruitmentApi.getRequisitions(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useRequisition(id: string) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.requisition(scope, id), queryFn: ({ signal }) => recruitmentApi.getRequisitionById(id, scope, signal) });
}

export function useCandidates(params: ListParams<CandidateFilters>, enabled = true) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.candidates(scope, params), queryFn: ({ signal }) => recruitmentApi.getCandidates(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useCandidate(id: string) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.candidate(scope, id), queryFn: ({ signal }) => recruitmentApi.getCandidateById(id, scope, signal) });
}

export function useCandidateHistory(id: string) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.history(scope, id), queryFn: ({ signal }) => recruitmentApi.getCandidateHistory(id, scope, signal) });
}

export function useInterviews(params: ListParams<InterviewFilters>, enabled = true) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.interviews(scope, params), queryFn: ({ signal }) => recruitmentApi.getInterviews(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useInterview(id: string) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.interview(scope, id), queryFn: ({ signal }) => recruitmentApi.getInterviewById(id, scope, signal) });
}

export function useOffers(params: ListParams<OfferFilters>, enabled = true) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.offers(scope, params), queryFn: ({ signal }) => recruitmentApi.getOffers(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useOffer(id: string) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.offer(scope, id), queryFn: ({ signal }) => recruitmentApi.getOfferById(id, scope, signal) });
}

export function useStaffOptions(search: string, enabled = true) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.staff(scope, search), queryFn: ({ signal }) => recruitmentApi.getStaffOptions(search, scope, signal), placeholderData: keepPreviousData, enabled, staleTime: 60_000 });
}

export function useConversionDraft(candidateId: string, enabled = true) {
  const { scope } = useRecruitmentAccess();
  return useQuery({ queryKey: recruitmentKeys.conversion(scope, candidateId), queryFn: ({ signal }) => recruitmentApi.getConversionDraft(candidateId, scope, signal), enabled, staleTime: 0 });
}

/* Mutations ----------------------------------------------------------------------------------------- */

/** Recruitment records are interlinked (counts, pipeline, history): any write refreshes the whole module. */
function useInvalidate(alsoEmployees = false) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: recruitmentKeys.all }),
      // Converting a candidate creates an employee: refresh the directory and department counts too.
      alsoEmployees ? client.invalidateQueries({ queryKey: employeeKeys.all }) : undefined,
      alsoEmployees ? client.invalidateQueries({ queryKey: organizationKeys.all }) : undefined,
    ]);
}

function useWrite<TVars, TResult>(fn: (vars: TVars, scope: RecruitmentScope) => Promise<TResult>, alsoEmployees = false) {
  const { scope } = useRecruitmentAccess();
  const invalidate = useInvalidate(alsoEmployees);
  return useMutation({ mutationFn: (vars: TVars) => fn(vars, scope), onSuccess: invalidate });
}

export const useCreateRequisition = () => useWrite((input: RequisitionInput, s) => recruitmentApi.createRequisition(input, s));
export const useUpdateRequisition = () => useWrite(({ id, input }: { id: string; input: RequisitionInput }, s) => recruitmentApi.updateRequisition(id, input, s));
export const useUpdateRequisitionStatus = () => useWrite(({ id, status, note }: { id: string; status: RequisitionStatus; note: string }, s) => recruitmentApi.updateRequisitionStatus(id, status, note, s));

export const useCreateCandidate = () => useWrite((input: CandidateInput, s) => recruitmentApi.createCandidate(input, s));
export const useUpdateCandidate = () => useWrite(({ id, input }: { id: string; input: CandidateInput }, s) => recruitmentApi.updateCandidate(id, input, s));
export const useUpdateCandidateStage = () => useWrite(({ id, stage, note }: { id: string; stage: CandidateStage; note: string }, s) => recruitmentApi.updateCandidateStage(id, stage, note, s));
export const useReopenCandidate = () => useWrite(({ id, note }: { id: string; note: string }, s) => recruitmentApi.reopenCandidate(id, note, s));
export const useArchiveCandidate = () => useWrite((id: string, s) => recruitmentApi.archiveCandidate(id, s));

export const useCreateInterview = () => useWrite((input: InterviewInput, s) => recruitmentApi.createInterview(input, s));
export const useUpdateInterview = () => useWrite(({ id, input }: { id: string; input: InterviewInput }, s) => recruitmentApi.updateInterview(id, input, s));
export const useCancelInterview = () => useWrite(({ id, reason }: { id: string; reason: string }, s) => recruitmentApi.cancelInterview(id, reason, s));
export const useUpdateInterviewStatus = () => useWrite(({ id, status }: { id: string; status: 'completed' | 'no-show' }, s) => recruitmentApi.updateInterviewStatus(id, status, s));
export const useSubmitFeedback = () => useWrite(({ id, input }: { id: string; input: FeedbackInput }, s) => recruitmentApi.submitInterviewFeedback(id, input, s));

export const useCreateOffer = () => useWrite((input: OfferInput, s) => recruitmentApi.createOffer(input, s));
export const useUpdateOffer = () => useWrite(({ id, input }: { id: string; input: OfferInput }, s) => recruitmentApi.updateOffer(id, input, s));
export const useUpdateOfferStatus = () => useWrite(({ id, status, note }: { id: string; status: OfferStatus; note: string }, s) => recruitmentApi.updateOfferStatus(id, status, note, s));

export const useConvertCandidate = () => useWrite(({ candidateId, input }: { candidateId: string; input: EmployeeInput }, s) => recruitmentApi.convertCandidateToEmployee(candidateId, input, s), true);
