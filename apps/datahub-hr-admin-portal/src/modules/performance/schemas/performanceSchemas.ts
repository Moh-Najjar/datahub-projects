import { z } from 'zod';
import {
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  PLAN_STATUSES,
  PRIORITIES,
  type CompetencyInput,
  type CycleInput,
  type GoalInput,
  type GoalProgressInput,
  type ManagerReviewInput,
  type PlanInput,
  type SelfAssessmentInput,
  type TemplateInput,
} from '@/modules/performance/types/performance';
import { isDate } from '@/modules/performance/utils/rules';

/*
 * Performance form schemas. Messages are reasons translated by the UI (`performance:validation.*`); the simulated
 * backend validates payloads with the same rules. Rules that need stored data (overlapping cycles, the rating scale,
 * scope, status) are checked by the backend only and come back as `fieldErrors`.
 */

const ARABIC = /[؀-ۿ]/;
const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const text = (max: number) => z.string().trim().max(max, 'tooLong');
const required = (max: number) => z.string().trim().min(1, 'required').max(max, 'tooLong');
const date = z.string().refine(isDate, 'invalidDate');

/* Cycle -------------------------------------------------------------------------------------------------- */

export const cycleFormSchema = z
  .object({
    nameEn: required(80),
    nameAr: required(80).regex(ARABIC, 'arabicRequired'),
    description: text(500),
    startDate: date,
    endDate: date,
    periodStart: date,
    periodEnd: date,
    selfAssessmentDeadline: date,
    managerReviewDeadline: date,
    templateId: z.string().min(1, 'required'),
  })
  .superRefine((v, ctx) => {
    const all = [v.startDate, v.endDate, v.periodStart, v.periodEnd, v.selfAssessmentDeadline, v.managerReviewDeadline];
    if (!all.every(isDate)) return;
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.endDate < v.startDate) issue('endDate', 'endBeforeStart');
    if (v.periodEnd < v.periodStart) issue('periodEnd', 'endBeforeStart');
    if (v.selfAssessmentDeadline < v.startDate || v.selfAssessmentDeadline > v.endDate) issue('selfAssessmentDeadline', 'deadlineOutsideCycle');
    if (v.managerReviewDeadline < v.selfAssessmentDeadline) issue('managerReviewDeadline', 'managerBeforeSelf');
    else if (v.managerReviewDeadline > v.endDate) issue('managerReviewDeadline', 'deadlineOutsideCycle');
  });
export type CycleFormValues = z.input<typeof cycleFormSchema>;

export const toCycleInput = (v: z.output<typeof cycleFormSchema>): CycleInput => ({
  name: { en: v.nameEn, ar: v.nameAr },
  description: v.description,
  startDate: v.startDate,
  endDate: v.endDate,
  periodStart: v.periodStart,
  periodEnd: v.periodEnd,
  selfAssessmentDeadline: v.selfAssessmentDeadline,
  managerReviewDeadline: v.managerReviewDeadline,
  templateId: v.templateId,
});

export const cycleToForm = (c: CycleInput): CycleFormValues => ({
  nameEn: c.name?.en ?? '',
  nameAr: c.name?.ar ?? '',
  description: c.description ?? '',
  startDate: c.startDate ?? '',
  endDate: c.endDate ?? '',
  periodStart: c.periodStart ?? '',
  periodEnd: c.periodEnd ?? '',
  selfAssessmentDeadline: c.selfAssessmentDeadline ?? '',
  managerReviewDeadline: c.managerReviewDeadline ?? '',
  templateId: c.templateId ?? '',
});

/* Goals -------------------------------------------------------------------------------------------------- */

export const goalFormSchema = z
  .object({
    title: required(120),
    description: text(1000),
    category: z.enum(GOAL_CATEGORIES),
    ownerType: z.enum(['employee', 'department']),
    employeeId: z.string(),
    departmentId: z.string(),
    cycleId: z.string(),
    startDate: date,
    dueDate: date,
    target: required(200),
    priority: z.enum(PRIORITIES),
  })
  .superRefine((v, ctx) => {
    if (v.ownerType === 'employee' && !v.employeeId) ctx.addIssue({ code: 'custom', path: ['employeeId'], message: 'required' });
    if (v.ownerType === 'department' && !v.departmentId) ctx.addIssue({ code: 'custom', path: ['departmentId'], message: 'required' });
    if (isDate(v.startDate) && isDate(v.dueDate) && v.dueDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'dueBeforeStart' });
  });
export type GoalFormValues = z.input<typeof goalFormSchema>;

export const toGoalInput = (v: z.output<typeof goalFormSchema>): GoalInput => ({
  title: v.title,
  description: v.description,
  category: v.category,
  ownerType: v.ownerType,
  employeeId: v.ownerType === 'employee' ? v.employeeId : null,
  departmentId: v.departmentId,
  cycleId: v.cycleId || null,
  startDate: v.startDate,
  dueDate: v.dueDate,
  target: v.target,
  priority: v.priority,
});

export const goalToForm = (g: GoalInput): GoalFormValues => ({
  title: g.title ?? '',
  description: g.description ?? '',
  category: g.category,
  ownerType: g.ownerType,
  employeeId: g.employeeId ?? '',
  departmentId: g.departmentId ?? '',
  cycleId: g.cycleId ?? '',
  startDate: g.startDate ?? '',
  dueDate: g.dueDate ?? '',
  target: g.target ?? '',
  priority: g.priority,
});

export const progressFormSchema = z.object({
  progress: z.number({ error: 'required' }).int('wholeNumber').min(0, 'progressRange').max(100, 'progressRange'),
  status: z.enum(GOAL_STATUSES),
  note: text(300),
});
export type ProgressFormValues = z.input<typeof progressFormSchema>;

/* Competencies & templates ------------------------------------------------------------------------------- */

export const competencyFormSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, 'required').min(2, 'codeLength').max(16, 'codeLength').regex(CODE, 'codeFormat'),
  nameEn: required(60),
  nameAr: required(60).regex(ARABIC, 'arabicRequired'),
  description: text(500),
  criteria: text(1000),
});
export type CompetencyFormValues = z.input<typeof competencyFormSchema>;
export const toCompetencyInput = (v: z.output<typeof competencyFormSchema>): CompetencyInput => ({ code: v.code, name: { en: v.nameEn, ar: v.nameAr }, description: v.description, criteria: v.criteria });

export const templateFormSchema = z.object({
  nameEn: required(60),
  nameAr: required(60).regex(ARABIC, 'arabicRequired'),
  competencyIds: z.array(z.string()).min(1, 'competencyRequired'),
});
export type TemplateFormValues = z.input<typeof templateFormSchema>;
export const toTemplateInput = (v: z.output<typeof templateFormSchema>): TemplateInput => ({ name: { en: v.nameEn, ar: v.nameAr }, competencyIds: [...new Set(v.competencyIds)] });

/* Reviews ------------------------------------------------------------------------------------------------ */

const ratingEntry = z.object({ rating: z.number().int().nullable(), comment: text(500) });

export const selfAssessmentSchema = z
  .object({
    goalRatings: z.array(ratingEntry.extend({ goalId: z.string() })),
    achievements: text(2000),
    challenges: text(2000),
    comments: text(2000),
    submit: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.submit) return;
    v.goalRatings.forEach((g, i) => g.rating === null && ctx.addIssue({ code: 'custom', path: ['goalRatings', i, 'rating'], message: 'ratingRequired' }));
    if (!v.achievements.trim()) ctx.addIssue({ code: 'custom', path: ['achievements'], message: 'required' });
  });
export type SelfAssessmentValues = z.input<typeof selfAssessmentSchema>;

export const managerReviewSchema = z
  .object({
    goalRatings: z.array(ratingEntry.extend({ goalId: z.string() })),
    competencyRatings: z.array(ratingEntry.extend({ competencyId: z.string() })),
    strengths: text(2000),
    improvements: text(2000),
    development: text(2000),
    comments: text(2000),
    overallRating: z.number().int().nullable(),
    submit: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.submit) return;
    v.goalRatings.forEach((g, i) => g.rating === null && ctx.addIssue({ code: 'custom', path: ['goalRatings', i, 'rating'], message: 'ratingRequired' }));
    v.competencyRatings.forEach((c, i) => c.rating === null && ctx.addIssue({ code: 'custom', path: ['competencyRatings', i, 'rating'], message: 'ratingRequired' }));
    if (v.overallRating === null) ctx.addIssue({ code: 'custom', path: ['overallRating'], message: 'ratingRequired' });
    if (!v.strengths.trim()) ctx.addIssue({ code: 'custom', path: ['strengths'], message: 'required' });
    if (!v.improvements.trim()) ctx.addIssue({ code: 'custom', path: ['improvements'], message: 'required' });
  });
export type ManagerReviewValues = z.input<typeof managerReviewSchema>;

/* Development plans -------------------------------------------------------------------------------------- */

export const planFormSchema = z
  .object({
    employeeId: z.string().min(1, 'required'),
    title: required(120),
    objectives: z.array(z.object({ text: required(300) })).min(1, 'objectiveRequired'),
    activities: z.array(z.object({ id: z.string().optional(), type: z.enum(ACTIVITY_TYPES), title: required(160), targetDate: date, status: z.enum(ACTIVITY_STATUSES) })).min(1, 'activityRequired'),
    targetDate: date,
    status: z.enum(PLAN_STATUSES),
    cycleId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!isDate(v.targetDate)) return;
    v.activities.forEach((a, i) => isDate(a.targetDate) && a.targetDate > v.targetDate && ctx.addIssue({ code: 'custom', path: ['activities', i, 'targetDate'], message: 'activityAfterPlan' }));
  });
export type PlanFormValues = z.input<typeof planFormSchema>;

export const toPlanInput = (v: z.output<typeof planFormSchema>): PlanInput => ({
  employeeId: v.employeeId,
  title: v.title,
  objectives: v.objectives.map((o) => o.text),
  activities: v.activities,
  targetDate: v.targetDate,
  status: v.status,
  cycleId: v.cycleId || null,
});

export const planToForm = (p: PlanInput): PlanFormValues => ({
  employeeId: p.employeeId ?? '',
  title: p.title ?? '',
  objectives: (p.objectives ?? []).map((text) => ({ text })),
  activities: p.activities ?? [],
  targetDate: p.targetDate ?? '',
  status: p.status,
  cycleId: p.cycleId ?? '',
});

/* Server-side validation (simulated backend) ------------------------------------------------------------- */

export type FieldErrors = Record<string, string[]>;

function issues(result: z.ZodSafeParseResult<unknown>): FieldErrors | undefined {
  if (result.success) return undefined;
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path.map(String).join('.') || 'form';
    errors[field] = [...(errors[field] ?? []), issue.message];
  }
  return errors;
}

export const validateCycleInput = (c: CycleInput) => issues(cycleFormSchema.safeParse(cycleToForm(c)));
export const validateGoalInput = (g: GoalInput) => issues(goalFormSchema.safeParse(goalToForm(g)));
export const validateProgressInput = (p: GoalProgressInput) => issues(progressFormSchema.safeParse(p));
export const validateCompetencyInput = (c: CompetencyInput) =>
  issues(competencyFormSchema.safeParse({ code: c.code ?? '', nameEn: c.name?.en ?? '', nameAr: c.name?.ar ?? '', description: c.description ?? '', criteria: c.criteria ?? '' }));
export const validateTemplateInput = (t: TemplateInput) => issues(templateFormSchema.safeParse({ nameEn: t.name?.en ?? '', nameAr: t.name?.ar ?? '', competencyIds: t.competencyIds ?? [] }));
export const validateSelfAssessment = (s: SelfAssessmentInput) => issues(selfAssessmentSchema.safeParse(s));
export const validateManagerReview = (m: ManagerReviewInput) => issues(managerReviewSchema.safeParse(m));
export const validatePlanInput = (p: PlanInput) => issues(planFormSchema.safeParse(planToForm(p)));
