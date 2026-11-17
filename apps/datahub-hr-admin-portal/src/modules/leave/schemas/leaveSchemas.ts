import { z } from 'zod';
import type { LeaveRequestInput, LeaveTypeInput } from '@/modules/leave/types/leave';
import { isDate } from '@/modules/leave/utils/rules';

/*
 * Leave form schemas. Messages are reasons translated by the UI (`leave:validation.*`); the simulated backend
 * validates payloads with the same rules. Rules that need stored data (balances, overlaps, duplicates, scope,
 * the employee's schedule) are checked by the backend only and come back as `fieldErrors`.
 */

const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const ARABIC = /[؀-ۿ]/;
const wholeDays = (max: number) => z.number({ error: 'required' }).int('wholeDays').min(0, 'dayRange').max(max, 'dayRange');

export const leaveTypeFormSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(1, 'required').min(2, 'codeLength').max(12, 'codeLength').regex(CODE, 'codeFormat'),
    nameEn: z.string().trim().min(1, 'required').max(60, 'tooLong'),
    nameAr: z.string().trim().min(1, 'required').max(60, 'tooLong').regex(ARABIC, 'arabicRequired'),
    description: z.string().trim().max(300, 'tooLong'),
    paid: z.boolean(),
    hasAllocation: z.boolean(),
    annualAllocation: z.number().optional(),
    seniorityYears: wholeDays(50),
    seniorityExtraDays: wholeDays(60),
    prorateFirstYear: z.boolean(),
    hasMaxConsecutive: z.boolean(),
    maxConsecutiveDays: z.number().optional(),
    requiresApproval: z.boolean(),
    requiresDocument: z.boolean(),
    eligibility: z.enum(['all', 'female', 'male']),
    excludesPublicHolidays: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const days = (path: 'annualAllocation' | 'maxConsecutiveDays', value: number | undefined, min: number) => {
      if (value === undefined || Number.isNaN(value)) ctx.addIssue({ code: 'custom', path: [path], message: 'required' });
      else if (!Number.isInteger(value)) ctx.addIssue({ code: 'custom', path: [path], message: 'wholeDays' });
      else if (value < min || value > 366) ctx.addIssue({ code: 'custom', path: [path], message: 'dayRange' });
    };
    if (v.hasAllocation) days('annualAllocation', v.annualAllocation, 0);
    if (v.hasMaxConsecutive) days('maxConsecutiveDays', v.maxConsecutiveDays, 1);
    if (v.seniorityYears > 0 && v.seniorityExtraDays === 0) ctx.addIssue({ code: 'custom', path: ['seniorityExtraDays'], message: 'seniorityDays' });
  });
export type LeaveTypeFormValues = z.input<typeof leaveTypeFormSchema>;

export function toLeaveTypeInput(v: z.output<typeof leaveTypeFormSchema>): LeaveTypeInput {
  return {
    code: v.code,
    name: { en: v.nameEn, ar: v.nameAr },
    description: v.description,
    paid: v.paid,
    annualAllocation: v.hasAllocation ? (v.annualAllocation ?? 0) : null,
    seniorityYears: v.hasAllocation ? v.seniorityYears : 0,
    seniorityExtraDays: v.hasAllocation && v.seniorityYears > 0 ? v.seniorityExtraDays : 0,
    prorateFirstYear: v.hasAllocation && v.prorateFirstYear,
    maxConsecutiveDays: v.hasMaxConsecutive ? (v.maxConsecutiveDays ?? 1) : null,
    requiresApproval: v.requiresApproval,
    requiresDocument: v.requiresDocument,
    eligibility: v.eligibility,
    excludesPublicHolidays: v.excludesPublicHolidays,
  };
}

export function leaveTypeToForm(t: LeaveTypeInput): LeaveTypeFormValues {
  return {
    code: t.code,
    nameEn: t.name.en,
    nameAr: t.name.ar,
    description: t.description,
    paid: t.paid,
    hasAllocation: t.annualAllocation !== null,
    annualAllocation: t.annualAllocation ?? undefined,
    seniorityYears: t.seniorityYears,
    seniorityExtraDays: t.seniorityExtraDays,
    prorateFirstYear: t.prorateFirstYear,
    hasMaxConsecutive: t.maxConsecutiveDays !== null,
    maxConsecutiveDays: t.maxConsecutiveDays ?? undefined,
    requiresApproval: t.requiresApproval,
    requiresDocument: t.requiresDocument,
    eligibility: t.eligibility,
    excludesPublicHolidays: t.excludesPublicHolidays,
  };
}

/** Longest range one request may span (calendar days). Requests stay inside one calendar year (balances are yearly). */
export const MAX_REQUEST_SPAN_DAYS = 120;

const documentSchema = z.object({ fileName: z.string().min(1).max(200), sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024, 'fileTooLarge') }).nullable();

export const leaveRequestFormSchema = z
  .object({
    employeeId: z.string(),
    leaveTypeId: z.string().min(1, 'required'),
    startDate: z.string().refine(isDate, 'invalidDate'),
    endDate: z.string().refine(isDate, 'invalidDate'),
    reason: z.string().trim().max(500, 'tooLong'),
    document: documentSchema,
  })
  .superRefine((v, ctx) => {
    if (!isDate(v.startDate) || !isDate(v.endDate)) return;
    if (v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endBeforeStart' });
    else if (v.startDate.slice(0, 4) !== v.endDate.slice(0, 4)) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'crossesYear' });
    else {
      const span = (new Date(`${v.endDate}T00:00`).getTime() - new Date(`${v.startDate}T00:00`).getTime()) / 86_400_000 + 1;
      if (span > MAX_REQUEST_SPAN_DAYS) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'rangeTooLong' });
    }
  });
export type LeaveRequestFormValues = z.input<typeof leaveRequestFormSchema>;

export const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(300, 'tooLong')
    .superRefine((v, ctx) => {
      if (v.length === 0) ctx.addIssue({ code: 'custom', message: 'reasonRequired' });
      else if (v.length < 5) ctx.addIssue({ code: 'custom', message: 'reasonTooShort' });
    }),
});
export type RejectValues = z.input<typeof rejectSchema>;

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

export const validateLeaveTypeInput = (t: LeaveTypeInput) =>
  issues(
    leaveTypeFormSchema.safeParse({
      ...leaveTypeToForm({ ...t, name: t.name ?? { en: '', ar: '' } }),
      code: t.code ?? '',
      description: t.description ?? '',
    }),
  );

export const validateRequestInput = (r: LeaveRequestInput) =>
  issues(leaveRequestFormSchema.safeParse({ employeeId: r.employeeId ?? '', leaveTypeId: r.leaveTypeId ?? '', startDate: r.startDate ?? '', endDate: r.endDate ?? '', reason: r.reason ?? '', document: r.document ?? null }));

export const validateRejectReason = (reason: string) => issues(rejectSchema.safeParse({ reason: reason ?? '' }));
