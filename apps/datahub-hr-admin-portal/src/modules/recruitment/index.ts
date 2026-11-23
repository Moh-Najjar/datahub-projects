/*
 * Public API of Recruitment Management for other modules (pure re-exports). Reports & Analytics reads recruitment data
 * through the module's own API service (same rules, same scoping: offers and salaries never reach team scope).
 */
export { recruitmentApi } from './api/recruitmentApi';
export type { Candidate, CandidateEvent, CandidateSource, CandidateStage, Interview, Offer, RecruitmentScope, RecruitmentSummary, Requisition } from './types/recruitment';
/** For System Settings (read-only reference of the pipeline's fixed stages, sources and interview types). */
export { CANDIDATE_SOURCES, CANDIDATE_STAGES, INTERVIEW_TYPES } from './types/recruitment';
