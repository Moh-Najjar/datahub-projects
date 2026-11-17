import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import type { EmployeeInput } from '@/modules/employees';
import * as mock from '@/modules/recruitment/mock/recruitmentMock';
import type {
  Candidate,
  CandidateEvent,
  CandidateFilters,
  CandidateInput,
  CandidateStage,
  ConversionDraft,
  FeedbackInput,
  Interview,
  InterviewFilters,
  InterviewInput,
  Offer,
  OfferFilters,
  OfferInput,
  OfferStatus,
  RecruitmentScope,
  RecruitmentSummary,
  Requisition,
  RequisitionFilters,
  RequisitionInput,
  RequisitionStatus,
  StaffOption,
} from '@/modules/recruitment/types/recruitment';

/*
 * Recruitment API service — the ONLY entry point to recruitment data. Every call runs against the SIMULATED backend
 * (`mock/`); with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented before
 * the contract exists). Publishing, invitations and offers are SIMULATED: nothing is e-mailed or sent.
 *
 * `scope` exists only because the mock has no token: the real backend must derive it from the signed-in user.
 */

type Signal = AbortSignal | undefined;

export const recruitmentApi = {
  getRecruitmentSummary: (scope: RecruitmentScope, signal?: Signal): Promise<RecruitmentSummary> => mockRequest(() => mock.summary(scope), { signal }),

  /* Requisitions */
  getRequisitions: (params: ListParams<RequisitionFilters>, scope: RecruitmentScope, signal?: Signal): Promise<Paginated<Requisition>> => mockRequest(() => mock.listRequisitions(params, scope), { signal }),
  getRequisitionById: (id: string, scope: RecruitmentScope, signal?: Signal): Promise<Requisition> => mockRequest(() => mock.getRequisition(id, scope), { signal }),
  createRequisition: (input: RequisitionInput, scope: RecruitmentScope): Promise<Requisition> => mockRequest(() => mock.createRequisition(input, scope)),
  updateRequisition: (id: string, input: RequisitionInput, scope: RecruitmentScope): Promise<Requisition> => mockRequest(() => mock.updateRequisition(id, input, scope)),
  updateRequisitionStatus: (id: string, status: RequisitionStatus, note: string, scope: RecruitmentScope): Promise<Requisition> => mockRequest(() => mock.updateRequisitionStatus(id, status, note, scope)),

  /* Candidates and pipeline */
  getCandidates: (params: ListParams<CandidateFilters>, scope: RecruitmentScope, signal?: Signal): Promise<Paginated<Candidate>> => mockRequest(() => mock.listCandidates(params, scope), { signal }),
  getCandidateById: (id: string, scope: RecruitmentScope, signal?: Signal): Promise<Candidate> => mockRequest(() => mock.getCandidate(id, scope), { signal }),
  createCandidate: (input: CandidateInput, scope: RecruitmentScope): Promise<Candidate> => mockRequest(() => mock.createCandidate(input, scope)),
  updateCandidate: (id: string, input: CandidateInput, scope: RecruitmentScope): Promise<Candidate> => mockRequest(() => mock.updateCandidate(id, input, scope)),
  updateCandidateStage: (id: string, stage: CandidateStage, note: string, scope: RecruitmentScope): Promise<Candidate> => mockRequest(() => mock.updateCandidateStage(id, stage, note, scope)),
  /** Explicit reopening of a rejected candidate (back to the stage they were rejected from). */
  reopenCandidate: (id: string, note: string, scope: RecruitmentScope): Promise<Candidate> => mockRequest(() => mock.reopenCandidate(id, note, scope)),
  archiveCandidate: (id: string, scope: RecruitmentScope): Promise<Candidate> => mockRequest(() => mock.archiveCandidate(id, scope)),
  getCandidateHistory: (id: string, scope: RecruitmentScope, signal?: Signal): Promise<CandidateEvent[]> => mockRequest(() => mock.candidateHistory(id, scope), { signal }),

  /* Interviews (simulated scheduling — no invitations or calendar events are sent) */
  getInterviews: (params: ListParams<InterviewFilters>, scope: RecruitmentScope, signal?: Signal): Promise<Paginated<Interview>> => mockRequest(() => mock.listInterviews(params, scope), { signal }),
  getInterviewById: (id: string, scope: RecruitmentScope, signal?: Signal): Promise<Interview> => mockRequest(() => mock.getInterview(id, scope), { signal }),
  createInterview: (input: InterviewInput, scope: RecruitmentScope): Promise<Interview> => mockRequest(() => mock.createInterview(input, scope)),
  updateInterview: (id: string, input: InterviewInput, scope: RecruitmentScope): Promise<Interview> => mockRequest(() => mock.updateInterview(id, input, scope)),
  cancelInterview: (id: string, reason: string, scope: RecruitmentScope): Promise<Interview> => mockRequest(() => mock.cancelInterview(id, reason, scope)),
  updateInterviewStatus: (id: string, status: 'completed' | 'no-show', scope: RecruitmentScope): Promise<Interview> => mockRequest(() => mock.updateInterviewStatus(id, status, scope)),
  submitInterviewFeedback: (id: string, input: FeedbackInput, scope: RecruitmentScope): Promise<Interview> => mockRequest(() => mock.submitInterviewFeedback(id, input, scope)),

  /* Offers (simulated — "send" records the status; nothing is e-mailed) */
  getOffers: (params: ListParams<OfferFilters>, scope: RecruitmentScope, signal?: Signal): Promise<Paginated<Offer>> => mockRequest(() => mock.listOffers(params, scope), { signal }),
  getOfferById: (id: string, scope: RecruitmentScope, signal?: Signal): Promise<Offer> => mockRequest(() => mock.getOffer(id, scope), { signal }),
  createOffer: (input: OfferInput, scope: RecruitmentScope): Promise<Offer> => mockRequest(() => mock.createOffer(input, scope)),
  updateOffer: (id: string, input: OfferInput, scope: RecruitmentScope): Promise<Offer> => mockRequest(() => mock.updateOffer(id, input, scope)),
  updateOfferStatus: (id: string, status: OfferStatus, note: string, scope: RecruitmentScope): Promise<Offer> => mockRequest(() => mock.updateOfferStatus(id, status, note, scope)),

  /* Staff options and hire-to-employee conversion */
  getStaffOptions: (search: string, scope: RecruitmentScope, signal?: Signal): Promise<StaffOption[]> => mockRequest(() => mock.staffOptions(search, scope), { signal }),
  getConversionDraft: (candidateId: string, scope: RecruitmentScope, signal?: Signal): Promise<ConversionDraft> => mockRequest(() => mock.conversionDraft(candidateId, scope), { signal }),
  /** Creates the Employee Management record (once) and links it to the candidate. */
  convertCandidateToEmployee: (candidateId: string, input: EmployeeInput, scope: RecruitmentScope): Promise<Candidate> => mockRequest(() => mock.convertCandidateToEmployee(candidateId, input, scope)),
};
