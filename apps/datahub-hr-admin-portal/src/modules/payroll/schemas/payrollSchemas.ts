import { z } from 'zod';
import {
  COMPENSATION_REASONS,
  CURRENCIES,
  DEDUCTION_CATEGORIES,
  EMPLOYMENT_TYPES,
  PAY_FREQUENCIES,
  SYSTEM_DEDUCTION_CATEGORIES,
  type AllowanceTypeInput,
  type AssignmentInput,
  type CompensationInput,
  type Currency,
  type DeductionCategory,
  type DeductionTypeInput,
  type PolicyInput,
  type RunInput,
  type SalaryStructureInput,
} from '@/modules/payroll/types/payroll';
import { FULL_PERCENT, parseAmount, parsePercent, percentText, toDecimalString } from '@/modules/payroll/utils/money';
import { addDays, isCalendarMonth, isDate, isMonth, monthEnd, monthStart, PAYMENT_DAYS_AFTER_PERIOD } from '@/modules/payroll/utils/rules';

/*
 * Payroll form schemas. Forms hold amounts as TEXT ("850.125") and convert them to integer minor units with
 * `parseAmount` — never through floating point. Messages are reasons translated by the UI (`payroll:validation.*`);
 * the simulated backend validates the API payloads (minor units) with the `validate*` functions below. Rules that need
 * stored data (duplicate codes, overlapping periods, scope, status) are checked by the backend only and come back as
 * `fieldErrors`.
 */

export type FieldErrors = Record<string, string[]>;

const ARABIC = /[؀-ۿ]/;
const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const text = (max: number) => z.string().trim().max(max, 'tooLong');
const required = (max: number) => z.string().trim().min(1, 'required').max(max, 'tooLong');
const code = z.string().trim().min(1, 'required').max(20, 'tooLong').regex(CODE, 'invalidCode');
const date = z.string().refine(isDate, 'invalidDate');
const optionalDate = z.string().refine((v) => v === '' || isDate(v), 'invalidDate');
/** Largest amount accepted anywhere (keeps every product of the engine a safe integer). */
export const MAX_AMOUNT_UNITS = 10_000_000;

type Ctx = z.RefinementCtx;
const issue = (ctx: Ctx, path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

/** Validates amount text for the currency: returns minor units or reports `invalidAmount` / `amountTooLarge`. */
function checkAmount(ctx: Ctx, path: string, value: string, currency: Currency, { allowZero = false } = {}) {
  const minor = parseAmount(value, currency);
  if (minor === null) return issue(ctx, path, value.trim() === '' ? 'required' : 'invalidAmount');
  if (!allowZero && minor === 0) return issue(ctx, path, 'positiveAmount');
  if (minor > MAX_AMOUNT_UNITS * 1000) issue(ctx, path, 'amountTooLarge');
}
function checkPercent(ctx: Ctx, path: string, value: string) {
  const bps = parsePercent(value);
  if (bps === null) return issue(ctx, path, value.trim() === '' ? 'required' : 'invalidPercent');
  if (bps === 0) issue(ctx, path, 'positivePercent');
}
const amountOf = (value: string, currency: Currency) => parseAmount(value, currency) ?? 0;
const amountText = (minor: number | null | undefined, currency: Currency) => (minor === null || minor === undefined ? '' : toDecimalString(minor, currency));

/* Salary structure ------------------------------------------------------------------------------------------------ */

export const structureFormSchema = z
  .object({
    code,
    nameEn: required(80),
    nameAr: required(80).regex(ARABIC, 'arabicRequired'),
    description: text(500),
    basicSalary: z.string(),
    currency: z.enum(CURRENCIES),
    payFrequency: z.enum(PAY_FREQUENCIES),
    employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).min(1, 'chooseOne'),
  })
  .superRefine((v, ctx) => checkAmount(ctx, 'basicSalary', v.basicSalary, v.currency));
export type StructureFormValues = z.input<typeof structureFormSchema>;

export const toStructureInput = (v: z.output<typeof structureFormSchema>): SalaryStructureInput => ({
  code: v.code,
  name: { en: v.nameEn, ar: v.nameAr },
  description: v.description,
  basicSalary: amountOf(v.basicSalary, v.currency),
  currency: v.currency,
  payFrequency: v.payFrequency,
  employmentTypes: v.employmentTypes,
});
export const structureToForm = (s?: SalaryStructureInput): StructureFormValues => ({
  code: s?.code ?? '',
  nameEn: s?.name.en ?? '',
  nameAr: s?.name.ar ?? '',
  description: s?.description ?? '',
  basicSalary: s ? amountText(s.basicSalary, s.currency) : '',
  currency: s?.currency ?? 'JOD',
  payFrequency: s?.payFrequency ?? 'monthly',
  employmentTypes: s?.employmentTypes ?? ['full-time'],
});

/* Compensation ---------------------------------------------------------------------------------------------------- */

export const compensationFormSchema = z
  .object({
    structureId: z.string().min(1, 'required'),
    /** Set from the chosen structure (the salary is in the structure's currency). */
    currency: z.enum(CURRENCIES),
    basicSalary: z.string(),
    effectiveFrom: date,
    reason: z.enum(COMPENSATION_REASONS),
    note: text(500),
  })
  .superRefine((v, ctx) => {
    checkAmount(ctx, 'basicSalary', v.basicSalary, v.currency);
    if ((v.reason === 'correction' || v.reason === 'adjustment') && v.note.trim() === '') issue(ctx, 'note', 'noteRequired');
  });
export type CompensationFormValues = z.input<typeof compensationFormSchema>;

export const toCompensationInput = (v: z.output<typeof compensationFormSchema>): CompensationInput => ({
  structureId: v.structureId,
  basicSalary: amountOf(v.basicSalary, v.currency),
  effectiveFrom: v.effectiveFrom,
  reason: v.reason,
  note: v.note,
});

/* Allowance and deduction types ------------------------------------------------------------------------------------ */

export const allowanceTypeFormSchema = z
  .object({
    code,
    nameEn: required(80),
    nameAr: required(80).regex(ARABIC, 'arabicRequired'),
    description: text(500),
    calculation: z.enum(['fixed', 'percentage']),
    amount: z.string(),
    percentage: z.string(),
    currency: z.enum(CURRENCIES),
    recurrence: z.enum(['recurring', 'one-time']),
    taxable: z.boolean(),
  })
  .superRefine((v, ctx) => (v.calculation === 'fixed' ? checkAmount(ctx, 'amount', v.amount, v.currency) : checkPercent(ctx, 'percentage', v.percentage)));
export type AllowanceTypeFormValues = z.input<typeof allowanceTypeFormSchema>;

export const toAllowanceTypeInput = (v: z.output<typeof allowanceTypeFormSchema>): AllowanceTypeInput => ({
  code: v.code,
  name: { en: v.nameEn, ar: v.nameAr },
  description: v.description,
  calculation: v.calculation,
  amount: v.calculation === 'fixed' ? amountOf(v.amount, v.currency) : null,
  percentage: v.calculation === 'percentage' ? (parsePercent(v.percentage) ?? 0) : null,
  currency: v.currency,
  recurrence: v.recurrence,
  taxable: v.taxable,
});
export const allowanceTypeToForm = (a?: AllowanceTypeInput): AllowanceTypeFormValues => ({
  code: a?.code ?? '',
  nameEn: a?.name.en ?? '',
  nameAr: a?.name.ar ?? '',
  description: a?.description ?? '',
  calculation: a?.calculation ?? 'fixed',
  amount: a ? amountText(a.amount, a.currency) : '',
  percentage: a?.percentage != null ? percentText(a.percentage) : '',
  currency: a?.currency ?? 'JOD',
  recurrence: a?.recurrence ?? 'recurring',
  taxable: a?.taxable ?? false,
});

const isSystemCategory = (c: DeductionCategory) => SYSTEM_DEDUCTION_CATEGORIES.includes(c);

export const deductionTypeFormSchema = z
  .object({
    code,
    nameEn: required(80),
    nameAr: required(80).regex(ARABIC, 'arabicRequired'),
    description: text(500),
    category: z.enum(DEDUCTION_CATEGORIES),
    calculation: z.enum(['fixed', 'percentage', 'daily-rate']),
    amount: z.string(),
    percentage: z.string(),
    currency: z.enum(CURRENCIES),
    recurrence: z.enum(['recurring', 'one-time']),
    maxAmount: z.string(),
  })
  .superRefine((v, ctx) => {
    if (isSystemCategory(v.category) !== (v.calculation === 'daily-rate')) issue(ctx, 'calculation', isSystemCategory(v.category) ? 'dailyRateRequired' : 'dailyRateSystemOnly');
    else if (v.calculation === 'fixed') checkAmount(ctx, 'amount', v.amount, v.currency);
    else if (v.calculation === 'percentage') checkPercent(ctx, 'percentage', v.percentage);
    if (v.maxAmount.trim() !== '') checkAmount(ctx, 'maxAmount', v.maxAmount, v.currency);
  });
export type DeductionTypeFormValues = z.input<typeof deductionTypeFormSchema>;

export const toDeductionTypeInput = (v: z.output<typeof deductionTypeFormSchema>): DeductionTypeInput => ({
  code: v.code,
  name: { en: v.nameEn, ar: v.nameAr },
  description: v.description,
  category: v.category,
  calculation: v.calculation,
  amount: v.calculation === 'fixed' ? amountOf(v.amount, v.currency) : null,
  percentage: v.calculation === 'percentage' ? (parsePercent(v.percentage) ?? 0) : null,
  currency: v.currency,
  recurrence: isSystemCategory(v.category) ? 'recurring' : v.recurrence,
  maxAmount: v.maxAmount.trim() === '' ? null : amountOf(v.maxAmount, v.currency),
});
export const deductionTypeToForm = (d?: DeductionTypeInput): DeductionTypeFormValues => ({
  code: d?.code ?? '',
  nameEn: d?.name.en ?? '',
  nameAr: d?.name.ar ?? '',
  description: d?.description ?? '',
  category: d?.category ?? 'other',
  calculation: d?.calculation ?? 'fixed',
  amount: d ? amountText(d.amount, d.currency) : '',
  percentage: d?.percentage != null ? percentText(d.percentage) : '',
  currency: d?.currency ?? 'JOD',
  recurrence: d?.recurrence ?? 'one-time',
  maxAmount: d ? amountText(d.maxAmount, d.currency) : '',
});

/* Assignments (employee allowances / deductions) ------------------------------------------------------------------- */

export const assignmentFormSchema = z
  .object({
    typeId: z.string().min(1, 'required'),
    /** From the chosen type. */
    calculation: z.enum(['fixed', 'percentage']),
    currency: z.enum(CURRENCIES),
    recurrence: z.enum(['recurring', 'one-time']),
    amount: z.string(),
    percentage: z.string(),
    effectiveFrom: date,
    effectiveTo: optionalDate,
    note: text(300),
  })
  .superRefine((v, ctx) => {
    if (v.calculation === 'fixed') checkAmount(ctx, 'amount', v.amount, v.currency);
    else checkPercent(ctx, 'percentage', v.percentage);
    if (v.effectiveTo !== '' && isDate(v.effectiveFrom) && v.effectiveTo < v.effectiveFrom) issue(ctx, 'effectiveTo', 'endBeforeStart');
  });
export type AssignmentFormValues = z.input<typeof assignmentFormSchema>;

export const toAssignmentInput = (v: z.output<typeof assignmentFormSchema>): AssignmentInput => ({
  typeId: v.typeId,
  amount: v.calculation === 'fixed' ? amountOf(v.amount, v.currency) : null,
  percentage: v.calculation === 'percentage' ? (parsePercent(v.percentage) ?? 0) : null,
  effectiveFrom: v.effectiveFrom,
  effectiveTo: v.recurrence === 'one-time' || v.effectiveTo === '' ? null : v.effectiveTo,
  note: v.note,
});

/* Payroll run ------------------------------------------------------------------------------------------------------ */

export const runFormSchema = z
  .object({
    /** Monthly runs cover one calendar month. */
    month: z.string().refine(isMonth, 'invalidMonth'),
    paymentDate: date,
    departmentId: z.string(),
    currency: z.enum(CURRENCIES),
    payFrequency: z.enum(PAY_FREQUENCIES),
  })
  .superRefine((v, ctx) => {
    if (!isMonth(v.month) || !isDate(v.paymentDate)) return;
    if (v.paymentDate < monthStart(v.month) || v.paymentDate > addDays(monthEnd(v.month), PAYMENT_DAYS_AFTER_PERIOD)) issue(ctx, 'paymentDate', 'paymentDateRange');
  });
export type RunFormValues = z.input<typeof runFormSchema>;

export const toRunInput = (v: z.output<typeof runFormSchema>): RunInput => ({
  periodStart: monthStart(v.month),
  periodEnd: monthEnd(v.month),
  paymentDate: v.paymentDate,
  payFrequency: v.payFrequency,
  departmentId: v.departmentId === '' ? null : v.departmentId,
  currency: v.currency,
});

export const reasonFormSchema = z.object({ reason: z.string().trim().min(5, 'reasonTooShort').max(500, 'tooLong') });
export type ReasonFormValues = z.input<typeof reasonFormSchema>;

export const policyFormSchema = z.object({ dailyRateDivisor: z.string().regex(/^\d{1,2}$/, 'invalidDivisor').refine((v) => Number(v) >= 1 && Number(v) <= 31, 'invalidDivisor') });
export type PolicyFormValues = z.input<typeof policyFormSchema>;

/* Backend-side validation of API payloads ---------------------------------------------------------------------------- */

function collect(check: (add: (field: string, reason: string) => void) => void): FieldErrors | undefined {
  const errors: FieldErrors = {};
  check((field, reason) => (errors[field] = [...(errors[field] ?? []), reason]));
  return Object.keys(errors).length ? errors : undefined;
}
const validAmount = (v: unknown, { allowZero = false } = {}) => typeof v === 'number' && Number.isSafeInteger(v) && (allowZero ? v >= 0 : v > 0) && v <= MAX_AMOUNT_UNITS * 1000;
const validPercent = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= FULL_PERCENT;
const validName = (n: { en?: string; ar?: string } | undefined) => Boolean(n?.en?.trim()) && Boolean(n?.ar?.trim()) && ARABIC.test(n?.ar ?? '');

export function validateStructureInput(i: SalaryStructureInput) {
  return collect((add) => {
    if (!CODE.test(i.code ?? '') || i.code.length > 20) add('code', 'invalidCode');
    if (!validName(i.name)) add('nameEn', 'required');
    if ((i.description ?? '').length > 500) add('description', 'tooLong');
    if (!(CURRENCIES as readonly string[]).includes(i.currency)) add('currency', 'required');
    if (!(PAY_FREQUENCIES as readonly string[]).includes(i.payFrequency)) add('payFrequency', 'required');
    if (!validAmount(i.basicSalary)) add('basicSalary', 'invalidAmount');
    if (!Array.isArray(i.employmentTypes) || i.employmentTypes.length === 0 || i.employmentTypes.some((t) => !(EMPLOYMENT_TYPES as readonly string[]).includes(t))) add('employmentTypes', 'chooseOne');
  });
}

export function validateCompensationInput(i: CompensationInput) {
  return collect((add) => {
    if (!i.structureId) add('structureId', 'required');
    if (!validAmount(i.basicSalary)) add('basicSalary', 'invalidAmount');
    if (!isDate(i.effectiveFrom ?? '')) add('effectiveFrom', 'invalidDate');
    if (!(COMPENSATION_REASONS as readonly string[]).includes(i.reason)) add('reason', 'required');
    if ((i.reason === 'correction' || i.reason === 'adjustment') && !(i.note ?? '').trim()) add('note', 'noteRequired');
    if ((i.note ?? '').length > 500) add('note', 'tooLong');
  });
}

export function validateAllowanceTypeInput(i: AllowanceTypeInput) {
  return collect((add) => {
    if (!CODE.test(i.code ?? '') || i.code.length > 20) add('code', 'invalidCode');
    if (!validName(i.name)) add('nameEn', 'required');
    if (i.calculation === 'fixed' && !validAmount(i.amount)) add('amount', 'invalidAmount');
    if (i.calculation === 'percentage' && !validPercent(i.percentage)) add('percentage', 'invalidPercent');
    if (!(CURRENCIES as readonly string[]).includes(i.currency)) add('currency', 'required');
  });
}

export function validateDeductionTypeInput(i: DeductionTypeInput) {
  return collect((add) => {
    if (!CODE.test(i.code ?? '') || i.code.length > 20) add('code', 'invalidCode');
    if (!validName(i.name)) add('nameEn', 'required');
    if (!(DEDUCTION_CATEGORIES as readonly string[]).includes(i.category)) add('category', 'required');
    else if (isSystemCategory(i.category) !== (i.calculation === 'daily-rate')) add('calculation', isSystemCategory(i.category) ? 'dailyRateRequired' : 'dailyRateSystemOnly');
    if (i.calculation === 'fixed' && !validAmount(i.amount)) add('amount', 'invalidAmount');
    if (i.calculation === 'percentage' && !validPercent(i.percentage)) add('percentage', 'invalidPercent');
    if (i.maxAmount !== null && !validAmount(i.maxAmount)) add('maxAmount', 'invalidAmount');
    if (!(CURRENCIES as readonly string[]).includes(i.currency)) add('currency', 'required');
  });
}

export function validateAssignmentInput(i: AssignmentInput, calculation: 'fixed' | 'percentage') {
  return collect((add) => {
    if (calculation === 'fixed' && !validAmount(i.amount)) add('amount', 'invalidAmount');
    if (calculation === 'percentage' && !validPercent(i.percentage)) add('percentage', 'invalidPercent');
    if (!isDate(i.effectiveFrom ?? '')) add('effectiveFrom', 'invalidDate');
    if (i.effectiveTo !== null && (!isDate(i.effectiveTo) || i.effectiveTo < i.effectiveFrom)) add('effectiveTo', 'endBeforeStart');
    if ((i.note ?? '').length > 300) add('note', 'tooLong');
  });
}

export function validateRunInput(i: RunInput) {
  return collect((add) => {
    if (!isDate(i.periodStart ?? '') || !isDate(i.periodEnd ?? '')) return add('periodStart', 'invalidDate');
    if (!isCalendarMonth(i.periodStart, i.periodEnd)) add('periodStart', 'calendarMonth');
    if (!isDate(i.paymentDate ?? '') || i.paymentDate < i.periodStart || i.paymentDate > addDays(i.periodEnd, PAYMENT_DAYS_AFTER_PERIOD)) add('paymentDate', 'paymentDateRange');
    if (!(CURRENCIES as readonly string[]).includes(i.currency)) add('currency', 'required');
    if (!(PAY_FREQUENCIES as readonly string[]).includes(i.payFrequency)) add('payFrequency', 'required');
  });
}

export function validateReason(reason: string) {
  const r = (reason ?? '').trim();
  return collect((add) => {
    if (r.length < 5) add('reason', 'reasonTooShort');
    if (r.length > 500) add('reason', 'tooLong');
  });
}

export function validatePolicyInput(i: PolicyInput) {
  return collect((add) => {
    if (!Number.isInteger(i.dailyRateDivisor) || i.dailyRateDivisor < 1 || i.dailyRateDivisor > 31) add('dailyRateDivisor', 'invalidDivisor');
  });
}
