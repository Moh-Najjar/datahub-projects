import { z } from 'zod';
import {
  CANDIDATE_SOURCES,
  CURRENCIES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  INTERVIEW_TYPES,
  RECOMMENDATIONS,
  type CandidateInput,
  type FeedbackInput,
  type InterviewInput,
  type OfferInput,
  type RequisitionInput,
} from '@/modules/recruitment/types/recruitment';
import { isDate, isDateTime } from '@/modules/recruitment/utils/pipeline';

/*
 * Recruitment form schemas. Messages are reasons translated by the UI (`recruitment:validation.*`); the simulated
 * backend validates payloads with the same rules. Rules that need stored data (duplicates, transitions, scope, dates
 * relative to today, organization references) are checked by the backend only and come back as `fieldErrors`.
 */

const ARABIC = /[؀-ۿ]/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const URL_RE = /^https:\/\/[^\s]+\.[^\s]+$/;
const text = (max: number) => z.string().trim().max(max, 'tooLong');
const required = (max: number) => z.string().trim().min(1, 'required').max(max, 'tooLong');
const optionalUrl = z.string().trim().max(200, 'tooLong').refine((v) => v === '' || URL_RE.test(v), 'invalidUrl');
/** Comma-separated list in the form → array. */
export const splitList = (v: string) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))];
const list = (max: number) => z.string().refine((v) => splitList(v).length <= max, 'tooMany').refine((v) => splitList(v).every((s) => s.length <= 40), 'tooLong');
const wholeNumber = (min: number, max: number) => z.number({ error: 'required' }).int('wholeNumber').min(min, 'range').max(max, 'range');
const optionalMoney = z.number().optional();

/* Requisition ------------------------------------------------------------------------------------------ */

export const requisitionFormSchema = z
  .object({
    titleEn: required(80),
    titleAr: required(80).regex(ARABIC, 'arabicRequired'),
    departmentId: z.string().min(1, 'required'),
    positionId: z.string().min(1, 'required'),
    locationId: z.string().min(1, 'required'),
    employmentType: z.enum(EMPLOYMENT_TYPES, { error: 'required' }),
    vacancies: wholeNumber(1, 50),
    hiringManagerId: z.string(),
    recruiterId: z.string(),
    description: required(2000),
    skills: list(15),
    minExperienceYears: wholeNumber(0, 40),
    education: z.enum(EDUCATION_LEVELS),
    hasSalaryRange: z.boolean(),
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    currency: z.enum(CURRENCIES),
    openingDate: z.string().refine(isDate, 'invalidDate'),
    closingDate: z.string().refine((v) => v === '' || isDate(v), 'invalidDate'),
  })
  .superRefine((v, ctx) => {
    if (v.closingDate && isDate(v.openingDate) && v.closingDate < v.openingDate) ctx.addIssue({ code: 'custom', path: ['closingDate'], message: 'closingBeforeOpening' });
    if (v.hasSalaryRange) {
      const money = (path: 'salaryMin' | 'salaryMax', value: number | undefined) => {
        if (value === undefined || Number.isNaN(value)) ctx.addIssue({ code: 'custom', path: [path], message: 'required' });
        else if (value <= 0 || value > 1_000_000) ctx.addIssue({ code: 'custom', path: [path], message: 'range' });
      };
      money('salaryMin', v.salaryMin);
      money('salaryMax', v.salaryMax);
      if (v.salaryMin !== undefined && v.salaryMax !== undefined && v.salaryMax < v.salaryMin) ctx.addIssue({ code: 'custom', path: ['salaryMax'], message: 'salaryMaxBelowMin' });
    }
  });
export type RequisitionFormValues = z.input<typeof requisitionFormSchema>;

export function toRequisitionInput(v: z.output<typeof requisitionFormSchema>): RequisitionInput {
  return {
    title: { en: v.titleEn, ar: v.titleAr },
    departmentId: v.departmentId,
    positionId: v.positionId,
    locationId: v.locationId,
    employmentType: v.employmentType,
    vacancies: v.vacancies,
    hiringManagerId: v.hiringManagerId || null,
    recruiterId: v.recruiterId || null,
    description: v.description,
    skills: splitList(v.skills),
    minExperienceYears: v.minExperienceYears,
    education: v.education,
    salaryRange: v.hasSalaryRange ? { min: v.salaryMin ?? 0, max: v.salaryMax ?? 0, currency: v.currency } : null,
    openingDate: v.openingDate,
    closingDate: v.closingDate || null,
  };
}

export function requisitionToForm(r: RequisitionInput): RequisitionFormValues {
  return {
    titleEn: r.title?.en ?? '',
    titleAr: r.title?.ar ?? '',
    departmentId: r.departmentId ?? '',
    positionId: r.positionId ?? '',
    locationId: r.locationId ?? '',
    employmentType: r.employmentType,
    vacancies: r.vacancies,
    hiringManagerId: r.hiringManagerId ?? '',
    recruiterId: r.recruiterId ?? '',
    description: r.description ?? '',
    skills: (r.skills ?? []).join(', '),
    minExperienceYears: r.minExperienceYears,
    education: r.education,
    hasSalaryRange: Boolean(r.salaryRange),
    salaryMin: r.salaryRange?.min,
    salaryMax: r.salaryRange?.max,
    currency: r.salaryRange?.currency ?? 'JOD',
    openingDate: r.openingDate ?? '',
    closingDate: r.closingDate ?? '',
  };
}

/* Candidate -------------------------------------------------------------------------------------------- */

export const candidateFormSchema = z.object({
  firstNameEn: required(40),
  lastNameEn: required(40),
  firstNameAr: text(40).refine((v) => v === '' || ARABIC.test(v), 'arabicRequired'),
  lastNameAr: text(40).refine((v) => v === '' || ARABIC.test(v), 'arabicRequired'),
  email: z.string().trim().min(1, 'required').max(120, 'tooLong').regex(EMAIL, 'invalidEmail'),
  phone: z.string().trim().min(1, 'required').regex(PHONE, 'invalidPhone'),
  location: text(80),
  currentTitle: text(80),
  currentCompany: text(80),
  experienceYears: wholeNumber(0, 50),
  education: z.enum(EDUCATION_LEVELS),
  skills: list(20),
  languages: list(8),
  linkedinUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  requisitionId: z.string().min(1, 'required'),
  appliedAt: z.string().refine(isDate, 'invalidDate'),
  source: z.enum(CANDIDATE_SOURCES),
  recruiterId: z.string(),
  expectedSalary: z
    .number()
    .optional()
    .refine((v) => v === undefined || Number.isNaN(v) || (v > 0 && v <= 1_000_000), 'range'),
  notes: text(1000),
});
export type CandidateFormValues = z.input<typeof candidateFormSchema>;

export function toCandidateInput(v: z.output<typeof candidateFormSchema>): CandidateInput {
  return {
    name: { first: { en: v.firstNameEn, ar: v.firstNameAr }, last: { en: v.lastNameEn, ar: v.lastNameAr } },
    email: v.email.toLowerCase(),
    phone: v.phone,
    location: v.location,
    currentTitle: v.currentTitle,
    currentCompany: v.currentCompany,
    experienceYears: v.experienceYears,
    education: v.education,
    skills: splitList(v.skills),
    languages: splitList(v.languages),
    linkedinUrl: v.linkedinUrl,
    portfolioUrl: v.portfolioUrl,
    requisitionId: v.requisitionId,
    appliedAt: v.appliedAt,
    source: v.source,
    recruiterId: v.recruiterId || null,
    expectedSalary: v.expectedSalary === undefined || Number.isNaN(v.expectedSalary) ? null : v.expectedSalary,
    notes: v.notes,
  };
}

export function candidateToForm(c: CandidateInput): CandidateFormValues {
  return {
    firstNameEn: c.name?.first.en ?? '',
    lastNameEn: c.name?.last.en ?? '',
    firstNameAr: c.name?.first.ar ?? '',
    lastNameAr: c.name?.last.ar ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    location: c.location ?? '',
    currentTitle: c.currentTitle ?? '',
    currentCompany: c.currentCompany ?? '',
    experienceYears: c.experienceYears,
    education: c.education,
    skills: (c.skills ?? []).join(', '),
    languages: (c.languages ?? []).join(', '),
    linkedinUrl: c.linkedinUrl ?? '',
    portfolioUrl: c.portfolioUrl ?? '',
    requisitionId: c.requisitionId ?? '',
    appliedAt: c.appliedAt ?? '',
    source: c.source,
    recruiterId: c.recruiterId ?? '',
    expectedSalary: c.expectedSalary ?? undefined,
    notes: c.notes ?? '',
  };
}

export const stageMoveSchema = z.object({ note: text(300) });
export type StageMoveValues = z.input<typeof stageMoveSchema>;

/* Interview -------------------------------------------------------------------------------------------- */

export const interviewFormSchema = z
  .object({
    candidateId: z.string().min(1, 'required'),
    type: z.enum(INTERVIEW_TYPES),
    start: z.string().refine(isDateTime, 'invalidDateTime'),
    durationMinutes: wholeNumber(15, 480),
    interviewerIds: z.array(z.string()).min(1, 'interviewerRequired').max(5, 'tooMany'),
    location: text(160),
    meetingLink: optionalUrl,
    notes: text(1000),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'video' && !v.meetingLink) ctx.addIssue({ code: 'custom', path: ['meetingLink'], message: 'meetingLinkRequired' });
    if (v.type === 'in-person' && !v.location) ctx.addIssue({ code: 'custom', path: ['location'], message: 'locationRequired' });
  });
export type InterviewFormValues = z.input<typeof interviewFormSchema>;

export const toInterviewInput = (v: z.output<typeof interviewFormSchema>): InterviewInput => ({ ...v, interviewerIds: [...new Set(v.interviewerIds)] });

export const cancelSchema = z.object({ reason: z.string().trim().min(1, 'reasonRequired').max(300, 'tooLong') });
export type CancelValues = z.input<typeof cancelSchema>;

const rating = z.number({ error: 'ratingRequired' }).int('ratingRequired').min(1, 'ratingRequired').max(5, 'ratingRequired');
export const feedbackFormSchema = z.object({
  interviewerId: z.string().min(1, 'required'),
  overall: rating,
  technical: rating,
  communication: rating,
  problemSolving: rating,
  experience: rating,
  strengths: required(1000),
  improvements: required(1000),
  recommendation: z.enum(RECOMMENDATIONS, { error: 'required' }),
});
export type FeedbackFormValues = z.input<typeof feedbackFormSchema>;

/* Offer ------------------------------------------------------------------------------------------------ */

export const offerFormSchema = z
  .object({
    candidateId: z.string().min(1, 'required'),
    departmentId: z.string().min(1, 'required'),
    positionId: z.string().min(1, 'required'),
    locationId: z.string().min(1, 'required'),
    salary: z.number({ error: 'required' }).positive('range').max(1_000_000, 'range'),
    currency: z.enum(CURRENCIES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    startDate: z.string().refine(isDate, 'invalidDate'),
    expiryDate: z.string().refine(isDate, 'invalidDate'),
    benefits: text(1000),
  })
  .superRefine((v, ctx) => {
    if (isDate(v.startDate) && isDate(v.expiryDate) && v.expiryDate > v.startDate) ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'expiryAfterStart' });
  });
export type OfferFormValues = z.input<typeof offerFormSchema>;
export const toOfferInput = (v: z.output<typeof offerFormSchema>): OfferInput => ({ ...v });

export const responseSchema = z.object({ note: text(300) });

/* Server-side validation (simulated backend) ---------------------------------------------------------- */

export type FieldErrors = Record<string, string[]>;

function issues(result: z.ZodSafeParseResult<unknown>): FieldErrors | undefined {
  if (result.success) return undefined;
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] = [...(errors[field] ?? []), issue.message];
  }
  return errors;
}

export const validateRequisitionInput = (r: RequisitionInput) => issues(requisitionFormSchema.safeParse(requisitionToForm(r)));
export const validateCandidateInput = (c: CandidateInput) => issues(candidateFormSchema.safeParse(candidateToForm(c)));
export const validateInterviewInput = (i: InterviewInput) =>
  issues(interviewFormSchema.safeParse({ candidateId: i.candidateId ?? '', type: i.type, start: i.start ?? '', durationMinutes: i.durationMinutes, interviewerIds: i.interviewerIds ?? [], location: i.location ?? '', meetingLink: i.meetingLink ?? '', notes: i.notes ?? '' }));
export const validateFeedbackInput = (f: FeedbackInput) => issues(feedbackFormSchema.safeParse(f));
export const validateOfferInput = (o: OfferInput) => issues(offerFormSchema.safeParse(o));
export const validateReason = (reason: string) => issues(cancelSchema.safeParse({ reason: reason ?? '' }));
