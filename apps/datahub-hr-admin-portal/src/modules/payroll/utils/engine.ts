import type { Localized } from '@datahub/shared-types';
import type { CalculationInputs, CalculationType, Currency, DeductionCategory, ItemBasis, LineItem, LineStatus, Minor, Recurrence } from '@/modules/payroll/types/payroll';
import { dailyRateAmount, percentOf, prorate, sumMinor } from './money';
import { addDays, daysInclusive, rangesOverlap } from './rules';

/*
 * The PAYROLL CALCULATION ENGINE: a pure, deterministic function of a fully gathered input (no data access, no clock,
 * no React). The simulated backend gathers the inputs (compensation history, assignments, approved leave, attendance
 * facts, policy) and stores the result as an immutable snapshot on the payroll line.
 *
 *   Gross            = Basic (prorated per compensation segment) + Allowances + Overtime (always 0: not supported)
 *   Total deductions = Unpaid leave + Absence (only when enabled) + Statutory (illustrative) + Assigned deductions
 *   Net              = Gross − Total deductions   (negative → error that blocks submission)
 *
 * Rules (documented in the policy and tested):
 * - Partial periods: each compensation record in force inside the employed part of the period gives a basic line
 *   `basic × days ÷ calendar days of the period`; a full month is exactly the monthly basic.
 * - Recurring allowances / deductions apply in full when in force on any employed day of the period (no proration);
 *   one-time items apply to the period containing their effective date. Percentages are of the period's basic.
 * - Fixed amounts apply only in their own currency (a mismatch is skipped with a warning; currencies are never mixed).
 * - Unpaid leave: APPROVED requests of unpaid leave types only; each date counted once; amount =
 *   Σ(monthly basic in force that day) ÷ divisor, rounded once. Paid leave is never deducted.
 * - Absence: only when an absence deduction type is ACTIVE; absent days from attendance that are not leave days.
 *   Late arrivals are never deducted (no approved policy).
 * - A per-period maximum caps the line after rounding.
 */

export interface EngineCompensation {
  id: string;
  structureCode: string;
  basicSalary: Minor;
  currency: Currency;
  effectiveFrom: string;
  /** Derived end (day before the next record), `null` = open. */
  effectiveTo: string | null;
}

export interface EngineItemType {
  code: string;
  name: Localized<string>;
  category: DeductionCategory | null;
  maxAmount: Minor | null;
  illustrative: boolean;
}

export interface EngineAssignment {
  id: string;
  type: EngineItemType;
  calculation: CalculationType;
  amount: Minor | null;
  percentage: number | null;
  currency: Currency;
  recurrence: Recurrence;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface EngineLeave {
  requestId: string;
  number: string;
  typeCode: string;
  typeName: Localized<string>;
  paid: boolean;
  dates: string[];
}

export interface EngineInput {
  period: { start: string; end: string };
  currency: Currency;
  employee: { hireDate: string; /** Last employed day (inactive employees), `null` while employed. */ lastDay: string | null };
  compensation: readonly EngineCompensation[];
  allowances: readonly EngineAssignment[];
  deductions: readonly EngineAssignment[];
  /** Active statutory deduction types: they apply to every employee of the run (illustrative). */
  statutory: readonly EngineAssignment[];
  /** Active system deduction types (`null` = disabled: nothing is deducted for that cause). */
  unpaidLeaveType: EngineItemType | null;
  absenceType: EngineItemType | null;
  leave: readonly EngineLeave[];
  attendance: CalculationInputs['attendance'];
  policy: { dailyRateDivisor: number };
}

export type ExclusionReason = 'notEmployed' | 'missingCompensation' | 'currencyMismatch';

export interface EngineLine {
  basic: Minor;
  allowances: Minor;
  overtime: Minor;
  gross: Minor;
  deductions: Minor;
  net: Minor;
  status: LineStatus;
  issues: string[];
  earnings: LineItem[];
  deductionItems: LineItem[];
  inputs: CalculationInputs;
}

export type EngineResult = { included: false; reason: ExclusionReason } | { included: true; line: EngineLine };

export const BASIC_NAME: Localized<string> = { en: 'Basic salary', ar: 'الراتب الأساسي' };

/** Issues that make a line an error (blocking submission); everything else is a warning. */
const ERROR_ISSUES = new Set(['negativeNet']);

function cap(amount: Minor, max: Minor | null): { amount: Minor; capped: boolean } {
  return max !== null && amount > max ? { amount: max, capped: true } : { amount, capped: false };
}

export function calculateLine(input: EngineInput): EngineResult {
  const { period, currency, policy } = input;
  const periodDays = daysInclusive(period.start, period.end);
  const from = input.employee.hireDate > period.start ? input.employee.hireDate : period.start;
  const to = input.employee.lastDay !== null && input.employee.lastDay < period.end ? input.employee.lastDay : period.end;
  if (from > to) return { included: false, reason: 'notEmployed' };

  // Compensation segments inside the employed range.
  const records = [...input.compensation].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const segments = records
    .filter((r) => rangesOverlap(r.effectiveFrom, r.effectiveTo, from, to))
    .map((r) => {
      const segFrom = r.effectiveFrom > from ? r.effectiveFrom : from;
      const segTo = r.effectiveTo !== null && r.effectiveTo < to ? r.effectiveTo : to;
      return { record: r, from: segFrom, to: segTo, days: daysInclusive(segFrom, segTo) };
    });
  if (segments.length === 0) return { included: false, reason: 'missingCompensation' };
  if (segments.some((s) => s.record.currency !== currency)) return { included: false, reason: 'currencyMismatch' };

  const issues: string[] = [];
  const employedDays = daysInclusive(from, to);
  const coveredDays = segments.reduce((sum, s) => sum + s.days, 0);
  if (coveredDays < employedDays) issues.push('partialCompensation');
  if (employedDays < periodDays) issues.push('partialPeriod');

  /* Earnings ------------------------------------------------------------------------------------------------- */
  const earnings: LineItem[] = segments.map((s) => ({
    code: s.record.structureCode,
    name: BASIC_NAME,
    kind: 'basic',
    category: null,
    amount: prorate(s.record.basicSalary, s.days, periodDays),
    basis: [{ method: 'prorated', base: s.record.basicSalary, days: s.days, periodDays }],
    capped: false,
    illustrative: false,
    sources: [s.record.id],
  }));
  const basic = sumMinor(earnings.map((e) => e.amount));

  const applies = (a: EngineAssignment) => (a.recurrence === 'one-time' ? a.effectiveFrom >= from && a.effectiveFrom <= to : rangesOverlap(a.effectiveFrom, a.effectiveTo, from, to));
  /** Fixed amount or percentage of the period's basic; `null` when a fixed amount is in another currency. */
  const valueOf = (a: EngineAssignment): { amount: Minor; basis: ItemBasis } | null => {
    if (a.calculation === 'percentage') return { amount: percentOf(basic, a.percentage ?? 0), basis: { method: 'percentage', base: basic, percentage: a.percentage ?? 0 } };
    if (a.currency !== currency) return null;
    return { amount: a.amount ?? 0, basis: { method: 'fixed', base: a.amount ?? 0 } };
  };
  const item = (a: EngineAssignment, kind: 'allowance' | 'deduction'): LineItem | null => {
    const v = valueOf(a);
    if (!v) {
      if (!issues.includes('currencySkipped')) issues.push('currencySkipped');
      return null;
    }
    const c = kind === 'deduction' ? cap(v.amount, a.type.maxAmount) : { amount: v.amount, capped: false };
    return { code: a.type.code, name: a.type.name, kind, category: a.type.category, amount: c.amount, basis: [v.basis], capped: c.capped, illustrative: a.type.illustrative, sources: [a.id] };
  };

  for (const a of input.allowances) {
    if (!applies(a)) continue;
    const it = item(a, 'allowance');
    if (it) earnings.push(it);
  }
  const allowances = sumMinor(earnings.filter((e) => e.kind === 'allowance').map((e) => e.amount));
  // Overtime: attendance has no overtime field and no overtime policy exists → always 0 (no line).
  const overtime = 0;
  const gross = sumMinor([basic, allowances, overtime]);

  /* Deductions ----------------------------------------------------------------------------------------------- */
  const deductionItems: LineItem[] = [];
  /** Monthly basic in force on a date (`null` if no compensation covers it: such days are not paid, so not deducted). */
  const basicOn = (date: string) => segments.find((s) => s.from <= date && date <= s.to)?.record.basicSalary ?? null;
  const dailyRateItem = (type: EngineItemType, dates: readonly string[], sources: string[]): LineItem | null => {
    const paidDates = dates.filter((d) => basicOn(d) !== null);
    if (paidDates.length === 0) return null;
    const bySegment = new Map<number, number>();
    for (const d of paidDates) bySegment.set(basicOn(d)!, (bySegment.get(basicOn(d)!) ?? 0) + 1);
    const c = cap(
      dailyRateAmount(
        paidDates.map((d) => basicOn(d)!),
        policy.dailyRateDivisor,
      ),
      type.maxAmount,
    );
    return {
      code: type.code,
      name: type.name,
      kind: 'deduction',
      category: type.category,
      amount: c.amount,
      basis: [...bySegment].map(([base, days]) => ({ method: 'daily-rate', base, days, divisor: policy.dailyRateDivisor })),
      capped: c.capped,
      illustrative: type.illustrative,
      sources,
    };
  };

  const inRange = (d: string) => d >= from && d <= to;
  // Approved unpaid leave: each date once (no double deduction when requests overlap).
  const unpaid = input.leave.filter((l) => !l.paid);
  const unpaidDates = [...new Set(unpaid.flatMap((l) => l.dates).filter(inRange))].sort();
  let unpaidLeaveDays = 0;
  if (input.unpaidLeaveType && unpaidDates.length > 0) {
    const it = dailyRateItem(input.unpaidLeaveType, unpaidDates, unpaid.filter((l) => l.dates.some(inRange)).map((l) => l.requestId));
    if (it) {
      deductionItems.push(it);
      unpaidLeaveDays = it.basis.reduce((sum, b) => sum + ('days' in b ? b.days : 0), 0);
    }
  }
  // Absence (only when enabled): absent days that are not leave days.
  const leaveDates = new Set(input.leave.flatMap((l) => l.dates));
  const absentDates = input.attendance.absentDates.filter((d) => inRange(d) && !leaveDates.has(d));
  let absenceDays = 0;
  if (input.absenceType) {
    if (input.attendance.dataFrom === null || input.attendance.dataFrom > from || (input.attendance.dataTo ?? '') < to) issues.push('attendanceIncomplete');
    const it = absentDates.length > 0 ? dailyRateItem(input.absenceType, absentDates, absentDates) : null;
    if (it) {
      deductionItems.push(it);
      absenceDays = it.basis.reduce((sum, b) => sum + ('days' in b ? b.days : 0), 0);
    }
  }
  for (const a of input.statutory) {
    const it = item(a, 'deduction');
    if (it) deductionItems.push(it);
  }
  for (const a of input.deductions) {
    if (!applies(a)) continue;
    const it = item(a, 'deduction');
    if (it) deductionItems.push(it);
  }
  const deductions = sumMinor(deductionItems.map((d) => d.amount));
  const net = gross - deductions;
  if (net < 0) issues.push('negativeNet');

  const status: LineStatus = issues.some((i) => ERROR_ISSUES.has(i)) ? 'error' : issues.some((i) => i !== 'partialPeriod') ? 'warning' : 'ok';
  return {
    included: true,
    line: {
      basic,
      allowances,
      overtime,
      gross,
      deductions,
      net,
      status,
      issues,
      earnings,
      deductionItems,
      inputs: {
        period: { start: period.start, end: period.end, days: periodDays },
        employment: { hireDate: input.employee.hireDate, lastDay: input.employee.lastDay, from, to, days: employedDays },
        compensation: segments.map((s) => ({ recordId: s.record.id, structureCode: s.record.structureCode, basicSalary: s.record.basicSalary, from: s.from, to: s.to, days: s.days })),
        attendance: input.attendance,
        leave: input.leave.map((l) => ({ requestId: l.requestId, number: l.number, typeCode: l.typeCode, typeName: l.typeName, paid: l.paid, dates: l.dates.filter(inRange) })),
        unpaidLeaveDays,
        absenceDays,
        policy: { dailyRateDivisor: policy.dailyRateDivisor },
      },
    },
  };
}

/** The end of each record = the day before the next one starts (records are immutable; ends are derived). */
export function withDerivedEnds<T extends { effectiveFrom: string }>(records: readonly T[]): Array<T & { effectiveTo: string | null }> {
  const sorted = [...records].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return sorted.map((r, i) => ({ ...r, effectiveTo: sorted[i + 1] ? addDays(sorted[i + 1]!.effectiveFrom, -1) : null }));
}
