import { z } from 'zod';
import type { AttendanceRecordInput, AttendanceUpdateInput, ShiftInput, Weekday } from '@/modules/attendance/types/attendance';
import { isDate, isDateTime, isTime, shiftSpanMinutes, toMs } from '@/modules/attendance/utils/time';

/*
 * Attendance form schemas. Messages are reasons translated by the UI (`attendance:validation.*`); the simulated
 * backend validates payloads with the same rules. Rules needing stored data (duplicates, session state, scope)
 * are checked by the backend only.
 */

const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const ARABIC = /[؀-ۿ]/;
const optionalDateTime = z.string().trim().refine((v) => v === '' || isDateTime(v), 'invalidDateTime');

export const shiftFormSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(1, 'required').min(2, 'codeLength').max(12, 'codeLength').regex(CODE, 'codeFormat'),
    nameEn: z.string().trim().min(1, 'required').max(60, 'tooLong'),
    nameAr: z.string().trim().min(1, 'required').max(60, 'tooLong').regex(ARABIC, 'arabicRequired'),
    startTime: z.string().refine(isTime, 'invalidTime'),
    endTime: z.string().refine(isTime, 'invalidTime'),
    breakMinutes: z.number({ error: 'required' }).int('wholeMinutes').min(0, 'breakRange').max(240, 'breakRange'),
    graceMinutes: z.number({ error: 'required' }).int('wholeMinutes').min(0, 'graceRange').max(120, 'graceRange'),
    workDays: z.array(z.number().int().min(0).max(6)).min(1, 'workDaysRequired'),
  })
  .superRefine((v, ctx) => {
    if (!isTime(v.startTime) || !isTime(v.endTime)) return;
    if (v.startTime === v.endTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'sameTimes' });
      return;
    }
    const span = shiftSpanMinutes(v.startTime, v.endTime);
    if (span > 16 * 60) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'shiftTooLong' });
    if (Number.isInteger(v.breakMinutes) && v.breakMinutes >= span) ctx.addIssue({ code: 'custom', path: ['breakMinutes'], message: 'breakTooLong' });
    if (Number.isInteger(v.graceMinutes) && v.graceMinutes >= span) ctx.addIssue({ code: 'custom', path: ['graceMinutes'], message: 'graceTooLong' });
  });
export type ShiftFormValues = z.input<typeof shiftFormSchema>;

export function toShiftInput(v: z.output<typeof shiftFormSchema>): ShiftInput {
  return {
    code: v.code,
    name: { en: v.nameEn, ar: v.nameAr },
    startTime: v.startTime,
    endTime: v.endTime,
    breakMinutes: v.breakMinutes,
    graceMinutes: v.graceMinutes,
    workDays: [...new Set(v.workDays)].sort() as Weekday[],
  };
}

/** Check-in / check-out consistency shared by the edit and create forms. */
function punches(v: { checkIn: string; checkOut: string }, ctx: z.RefinementCtx) {
  if (v.checkOut && !v.checkIn) ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'checkOutWithoutIn' });
  if (v.checkIn && v.checkOut && isDateTime(v.checkIn) && isDateTime(v.checkOut) && toMs(v.checkOut) <= toMs(v.checkIn)) {
    ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'checkOutBeforeIn' });
  }
}

export const recordUpdateSchema = z
  .object({ checkIn: optionalDateTime, checkOut: optionalDateTime, note: z.string().trim().max(300, 'tooLong') })
  .superRefine(punches);
export type RecordUpdateValues = z.input<typeof recordUpdateSchema>;

export const recordCreateSchema = z
  .object({
    employeeId: z.string().min(1, 'required'),
    date: z.string().refine(isDate, 'invalidDate'),
    shiftId: z.string().min(1, 'required'),
    checkIn: optionalDateTime,
    checkOut: optionalDateTime,
    note: z.string().trim().max(300, 'tooLong'),
  })
  .superRefine(punches);
export type RecordCreateValues = z.input<typeof recordCreateSchema>;

export const punchSchema = z.object({ time: z.string().refine(isDateTime, 'invalidDateTime') });
export type PunchValues = z.input<typeof punchSchema>;

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

export const validateShiftInput = (s: ShiftInput) =>
  issues(shiftFormSchema.safeParse({ code: s.code, nameEn: s.name?.en, nameAr: s.name?.ar, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, graceMinutes: s.graceMinutes, workDays: s.workDays }));

export const validateUpdateInput = (u: AttendanceUpdateInput) =>
  issues(recordUpdateSchema.safeParse({ checkIn: u.checkIn ?? '', checkOut: u.checkOut ?? '', note: u.note ?? '' }));

export const validateCreateInput = (c: AttendanceRecordInput) =>
  issues(recordCreateSchema.safeParse({ employeeId: c.employeeId ?? '', date: c.date ?? '', shiftId: c.shiftId ?? '', checkIn: c.checkIn ?? '', checkOut: c.checkOut ?? '', note: c.note ?? '' }));
