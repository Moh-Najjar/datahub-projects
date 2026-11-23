import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Recruitment contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly these
 * shapes. Departments, positions and locations are Organization Management ids; hiring managers, recruiters and
 * interviewers are Employee Management ids. Dates are local `YYYY-MM-DD`, date-times `YYYY-MM-DDTHH:mm`, timestamps ISO.
 */

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export interface PersonName {
  first: Localized<string>;
  last: Localized<string>;
}

/** Same values as Employee Management's employment types (a hired candidate becomes an employee). */
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EDUCATION_LEVELS = ['none', 'high-school', 'diploma', 'bachelor', 'master', 'doctorate'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const CURRENCIES = ['JOD', 'USD', 'SAR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface ActorEvent {
  at: string;
  by: Localized<string>;
  note: string;
}

/* Requisitions ---------------------------------------------------------------------------------------- */

export const REQUISITION_STATUSES = ['draft', 'pending-approval', 'open', 'on-hold', 'closed', 'cancelled'] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export interface SalaryRange {
  min: number;
  max: number;
  currency: Currency;
}

export interface Requisition {
  id: string;
  /** e.g. REQ-2026-014 */
  number: string;
  title: Localized<string>;
  department: NamedRef;
  position: NamedRef;
  location: NamedRef;
  employmentType: EmploymentType;
  vacancies: number;
  hiringManager: NamedRef | null;
  recruiter: NamedRef | null;
  description: string;
  skills: string[];
  minExperienceYears: number;
  education: EducationLevel;
  salaryRange: SalaryRange | null;
  openingDate: string;
  closingDate: string | null;
  status: RequisitionStatus;
  createdAt: string;
  history: Array<ActorEvent & { from: RequisitionStatus | null; to: RequisitionStatus }>;
  /** Derived from the candidates and accepted offers of this requisition. */
  counts: { candidates: number; active: number; hired: number };
  /** Status changes the caller may make now (computed by the backend). */
  nextStatuses: RequisitionStatus[];
  can: { edit: boolean };
}

export interface RequisitionInput {
  title: Localized<string>;
  departmentId: string;
  positionId: string;
  locationId: string;
  employmentType: EmploymentType;
  vacancies: number;
  hiringManagerId: string | null;
  recruiterId: string | null;
  description: string;
  skills: string[];
  minExperienceYears: number;
  education: EducationLevel;
  salaryRange: SalaryRange | null;
  openingDate: string;
  closingDate: string | null;
}

export interface RequisitionFilters {
  status: RequisitionStatus;
  departmentId: string;
  locationId: string;
  employmentType: EmploymentType;
}

export type RequisitionSortField = 'number' | 'title.en' | 'title.ar' | 'openingDate' | 'closingDate' | 'vacancies' | 'status';

/** Short reference used on candidates, interviews and offers. */
export interface RequisitionRef {
  id: string;
  number: string;
  title: Localized<string>;
}

/* Candidates ------------------------------------------------------------------------------------------ */

export const CANDIDATE_STAGES = ['new', 'screening', 'shortlisted', 'interview', 'assessment', 'offer', 'hired', 'rejected'] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const CANDIDATE_SOURCES = ['careers-site', 'referral', 'job-board', 'linkedin', 'agency', 'university', 'other'] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const EXPERIENCE_BANDS = ['0-2', '3-5', '6-10', '10+'] as const;
export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];

export type CandidateEventType =
  | 'applied'
  | 'stage'
  | 'reopened'
  | 'interview-scheduled'
  | 'interview-updated'
  | 'interview-cancelled'
  | 'interview-completed'
  | 'interview-no-show'
  | 'feedback'
  | 'offer-created'
  | 'offer-sent'
  | 'offer-accepted'
  | 'offer-rejected'
  | 'offer-withdrawn'
  | 'offer-expired'
  | 'archived'
  | 'converted';

export interface CandidateEvent extends ActorEvent {
  type: CandidateEventType;
  from: CandidateStage | null;
  to: CandidateStage | null;
  /** Interview / offer / employee id the event is about. */
  refId: string | null;
}

export interface CandidateSummary {
  id: string;
  /** e.g. CAN-0042 */
  number: string;
  name: PersonName;
  email: string;
}

export interface Candidate extends CandidateSummary {
  phone: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  experienceYears: number;
  education: EducationLevel;
  skills: string[];
  languages: string[];
  linkedinUrl: string;
  portfolioUrl: string;
  requisition: RequisitionRef;
  appliedAt: string;
  source: CandidateSource;
  recruiter: NamedRef | null;
  stage: CandidateStage;
  /** `null` when not given — or not visible to the caller (team scope never sees salaries). */
  expectedSalary: number | null;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  /** Employee Management id after conversion (hired candidates only). */
  employeeId: string | null;
  createdAt: string;
  /** Pipeline moves allowed now (valid transitions × caller's permissions). */
  nextStages: CandidateStage[];
  can: { edit: boolean; archive: boolean; reopen: boolean; schedule: boolean; offer: boolean; convert: boolean };
}

export interface CandidateInput {
  name: PersonName;
  email: string;
  phone: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  experienceYears: number;
  education: EducationLevel;
  skills: string[];
  languages: string[];
  linkedinUrl: string;
  portfolioUrl: string;
  requisitionId: string;
  appliedAt: string;
  source: CandidateSource;
  recruiterId: string | null;
  expectedSalary: number | null;
  notes: string;
}

export interface CandidateFilters {
  stage: CandidateStage;
  requisitionId: string;
  source: CandidateSource;
  experience: ExperienceBand;
  recruiterId: string;
  /** Archived candidates are excluded unless `'true'`. */
  archived: 'true';
}

export type CandidateSortField = 'number' | 'name.en' | 'name.ar' | 'appliedAt' | 'experienceYears' | 'stage';

/* Interviews ------------------------------------------------------------------------------------------ */

export const INTERVIEW_TYPES = ['phone', 'video', 'in-person', 'technical', 'hr', 'final'] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled', 'no-show'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const RECOMMENDATIONS = ['strong-hire', 'hire', 'hold', 'reject'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

/** Ratings use a 1–5 scale. */
export interface FeedbackRatings {
  overall: number;
  technical: number;
  communication: number;
  problemSolving: number;
  experience: number;
}

export interface InterviewFeedback extends FeedbackRatings {
  interviewer: NamedRef;
  strengths: string;
  improvements: string;
  recommendation: Recommendation;
  submittedAt: string;
  submittedBy: Localized<string>;
}

export interface FeedbackInput extends FeedbackRatings {
  interviewerId: string;
  strengths: string;
  improvements: string;
  recommendation: Recommendation;
}

export interface Interview {
  id: string;
  candidate: CandidateSummary;
  requisition: RequisitionRef;
  type: InterviewType;
  status: InterviewStatus;
  /** Local date-time `YYYY-MM-DDTHH:mm`. */
  start: string;
  durationMinutes: number;
  interviewers: NamedRef[];
  location: string;
  meetingLink: string;
  notes: string;
  cancelReason: string | null;
  createdAt: string;
  /** Feedback the caller may read (all for recruitment writers; only their own for a team-scoped interviewer). */
  feedback: InterviewFeedback[];
  /** Total feedback submitted (also when the caller may not read it). */
  feedbackCount: number;
  /** Interviewers (ids) who have not submitted feedback yet. */
  pendingFeedbackFrom: string[];
  can: { edit: boolean; cancel: boolean; complete: boolean; feedbackFor: string[] };
}

export interface InterviewInput {
  candidateId: string;
  type: InterviewType;
  start: string;
  durationMinutes: number;
  interviewerIds: string[];
  location: string;
  meetingLink: string;
  notes: string;
}

export interface InterviewFilters {
  status: InterviewStatus;
  type: InterviewType;
  candidateId: string;
  requisitionId: string;
  from: string;
  to: string;
}

export type InterviewSortField = 'start' | 'status' | 'type';

/* Offers ---------------------------------------------------------------------------------------------- */

export const OFFER_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface Offer {
  id: string;
  /** e.g. OFF-2026-007 */
  number: string;
  candidate: CandidateSummary;
  requisition: RequisitionRef;
  position: NamedRef;
  department: NamedRef;
  location: NamedRef;
  /** Monthly gross salary. */
  salary: number;
  currency: Currency;
  employmentType: EmploymentType;
  startDate: string;
  expiryDate: string;
  benefits: string;
  status: OfferStatus;
  createdAt: string;
  sentAt: string | null;
  respondedAt: string | null;
  history: Array<ActorEvent & { from: OfferStatus | null; to: OfferStatus }>;
  nextStatuses: OfferStatus[];
  can: { edit: boolean };
}

export interface OfferInput {
  candidateId: string;
  positionId: string;
  departmentId: string;
  locationId: string;
  salary: number;
  currency: Currency;
  employmentType: EmploymentType;
  startDate: string;
  expiryDate: string;
  benefits: string;
}

export interface OfferFilters {
  status: OfferStatus;
  requisitionId: string;
  candidateId: string;
}

export type OfferSortField = 'number' | 'salary' | 'startDate' | 'expiryDate' | 'status';

/* Overview -------------------------------------------------------------------------------------------- */

export const FUNNEL_STEPS = ['applied', 'screened', 'interviewed', 'offered', 'hired'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface ActivityItem {
  at: string;
  type: CandidateEventType;
  candidate: CandidateSummary;
  requisition: RequisitionRef;
  to: CandidateStage | null;
  by: Localized<string>;
}

export interface RecruitmentSummary {
  /** Remaining vacancies of open requisitions. */
  openPositions: number;
  openRequisitions: number;
  /** Candidates not archived. */
  totalCandidates: number;
  newCandidates: number;
  inInterview: number;
  /** Offers sent and awaiting the candidate's answer. */
  pendingOffers: number;
  hired: number;
  byStage: Record<CandidateStage, number>;
  /** Last six months, oldest first. */
  monthly: Array<{ month: string; applications: number; interviews: number; offers: number; hires: number }>;
  /** Requisitions with the most candidates (up to 8). */
  byRequisition: Array<{ requisition: RequisitionRef; total: number; active: number; hired: number }>;
  /** Candidates that reached each step (from the stage history). */
  funnel: Array<{ step: FunnelStep; count: number }>;
  recent: ActivityItem[];
}

/* Staff & conversion ---------------------------------------------------------------------------------- */

/** Employee option for hiring manager, recruiter and interviewer fields. */
export interface StaffOption {
  id: string;
  name: Localized<string>;
  employeeNumber: string;
  department: NamedRef;
  position: NamedRef;
}

/**
 * Pre-filled employee values for converting a hired candidate (Employee Management fields). HR completes and confirms
 * them; Employee Management's own rules validate the result.
 */
export interface ConversionDraft {
  candidateId: string;
  offerId: string;
  employeeNumber: string;
  name: PersonName;
  workEmail: string;
  personalEmail: string;
  phone: string;
  hireDate: string;
  employmentType: EmploymentType;
  departmentId: string;
  positionId: string;
  locationId: string;
  managerId: string | null;
}

/* Scope ----------------------------------------------------------------------------------------------- */

/**
 * Who is asking: `organization` (recruitment.jobs.view) or `team` (hr.recruitment.view.team — the departments the user
 * manages and requisitions where they are the hiring manager, read-only, no salaries/offers). The real backend
 * derives it from the token.
 */
export interface RecruitmentScope {
  kind: 'organization' | 'team';
  userId: string;
  role: Role;
}

