import { describe, expect, it } from 'vitest';
import type { CalculationInputs } from '@/modules/payroll/types/payroll';
import { calculateLine, withDerivedEnds, type EngineAssignment, type EngineInput, type EngineItemType } from './engine';
import { dailyRateAmount, divRound, parseAmount, parsePercent, percentOf, percentText, prorate, sumMinor, toDecimalString } from './money';

/* Decimal-safe money -------------------------------------------------------------------------------------------- */

describe('money (integer minor units, explicit rounding)', () => {
  it('rounds half-up (ties away from zero) with exact integer division', () => {
    expect(divRound(10, 4)).toBe(3); // 2.5 → 3
    expect(divRound(9, 4)).toBe(2); // 2.25 → 2
    expect(divRound(11, 4)).toBe(3); // 2.75 → 3
    expect(divRound(-10, 4)).toBe(-3); // -2.5 → -3 (away from zero)
    expect(divRound(5_950_000, 30)).toBe(198_333); // 198.3333… JOD → 198.333
    expect(divRound(25, 50)).toBe(1); // 0.0005 JOD → 0.001
    expect(() => divRound(1, 0)).toThrow(RangeError);
    expect(() => divRound(0.5, 2)).toThrow(RangeError);
  });

  it('avoids floating-point errors (0.1 + 0.2 and repeated additions)', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem being avoided
    expect(sumMinor([parseAmount('0.1', 'JOD')!, parseAmount('0.2', 'JOD')!])).toBe(parseAmount('0.3', 'JOD'));
    const tenths = Array.from({ length: 1000 }, () => parseAmount('0.001', 'JOD')!);
    expect(toDecimalString(sumMinor(tenths), 'JOD')).toBe('1.000');
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });

  it('parses and prints amounts with the currency precision (JOD 3, USD 2)', () => {
    expect(parseAmount('850', 'JOD')).toBe(850_000);
    expect(parseAmount('850.125', 'JOD')).toBe(850_125);
    expect(parseAmount('850.5', 'USD')).toBe(85_050);
    expect(parseAmount('850.125', 'USD')).toBeNull(); // too many decimals for USD
    expect(parseAmount('-5', 'JOD')).toBeNull();
    expect(parseAmount('1e3', 'JOD')).toBeNull();
    expect(parseAmount('', 'JOD')).toBeNull();
    expect(toDecimalString(850_125, 'JOD')).toBe('850.125');
    expect(toDecimalString(5, 'JOD')).toBe('0.005');
    expect(toDecimalString(-1250, 'USD')).toBe('-12.50');
  });

  it('percentages are integer basis points', () => {
    expect(parsePercent('15')).toBe(1500);
    expect(parsePercent('7.25')).toBe(725);
    expect(parsePercent('100.01')).toBeNull();
    expect(parsePercent('1.234')).toBeNull();
    expect(percentText(725)).toBe('7.25');
    expect(percentOf(1_234_567, 1000)).toBe(123_457); // 123.4567 → 123.457
  });

  it('prorates with one rounding and returns the full amount for a full period', () => {
    expect(prorate(850_000, 30, 30)).toBe(850_000);
    expect(prorate(850_000, 31, 31)).toBe(850_000);
    expect(prorate(1_000_000, 10, 31)).toBe(322_581); // 322.5806… → 322.581
    // Rounding once on the total, not per day: 3 days of 1000.000 ÷ 30 = 100.000 exactly.
    expect(dailyRateAmount([1_000_000, 1_000_000, 1_000_000], 30)).toBe(100_000);
    expect(dailyRateAmount([1_000_000], 30)).toBe(33_333);
  });
});

/* Engine ---------------------------------------------------------------------------------------------------------- */

const NOV = { start: '2026-11-01', end: '2026-11-30' };
const NO_ATTENDANCE: CalculationInputs['attendance'] = { dataFrom: null, dataTo: null, scheduledDays: 21, present: 0, late: 0, absent: 0, halfDay: 0, incomplete: 0, onLeave: 0, lateMinutes: 0, workedMinutes: 0, minutesBeyondShift: 0, absentDates: [] };
const UNPAID: EngineItemType = { code: 'UNPAID-LV', name: { en: 'Unpaid leave', ar: 'إجازة بدون راتب' }, category: 'unpaid-leave', maxAmount: null, illustrative: false };
const ABSENCE: EngineItemType = { code: 'ABSENCE', name: { en: 'Absence', ar: 'غياب' }, category: 'absence', maxAmount: null, illustrative: false };
const type = (code: string, extra: Partial<EngineItemType> = {}): EngineItemType => ({ code, name: { en: code, ar: code }, category: null, maxAmount: null, illustrative: false, ...extra });
const fixed = (code: string, amount: number, extra: Partial<EngineAssignment> = {}): EngineAssignment => ({ id: `a-${code}`, type: type(code), calculation: 'fixed', amount, percentage: null, currency: 'JOD', recurrence: 'recurring', effectiveFrom: '2020-01-01', effectiveTo: null, ...extra });
const pct = (code: string, bps: number, extra: Partial<EngineAssignment> = {}): EngineAssignment => ({ ...fixed(code, 0, extra), calculation: 'percentage', amount: null, percentage: bps });

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    period: NOV,
    currency: 'JOD',
    employee: { hireDate: '2020-03-01', lastDay: null },
    compensation: [{ id: 'c1', structureCode: 'SAL-MID', basicSalary: 1_200_000, currency: 'JOD', effectiveFrom: '2020-03-01', effectiveTo: null }],
    allowances: [],
    deductions: [],
    statutory: [],
    unpaidLeaveType: UNPAID,
    absenceType: null,
    leave: [],
    attendance: NO_ATTENDANCE,
    policy: { dailyRateDivisor: 30 },
    ...over,
  };
}
function line(over: Partial<EngineInput> = {}) {
  const r = calculateLine(input(over));
  if (!r.included) throw new Error(`excluded: ${r.reason}`);
  return r.line;
}

describe('calculation engine', () => {
  it('gross = basic + allowances (+ overtime 0); net = gross − deductions', () => {
    const l = line({ allowances: [fixed('TRANSPORT', 40_000), pct('HOUSING', 1000)], deductions: [fixed('LOAN', 60_000)] });
    expect(l.basic).toBe(1_200_000);
    expect(l.allowances).toBe(40_000 + 120_000);
    expect(l.overtime).toBe(0);
    expect(l.gross).toBe(1_360_000);
    expect(l.deductions).toBe(60_000);
    expect(l.net).toBe(1_300_000);
    expect(l.status).toBe('ok');
    expect(l.earnings.map((e) => e.code)).toEqual(['SAL-MID', 'TRANSPORT', 'HOUSING']);
    expect(l.earnings.find((e) => e.code === 'HOUSING')!.basis).toEqual([{ method: 'percentage', base: 1_200_000, percentage: 1000 }]);
  });

  it('prorates basic by calendar days for a mid-period hire and splits at a salary change', () => {
    const hire = line({ employee: { hireDate: '2026-11-11', lastDay: null }, compensation: [{ id: 'c1', structureCode: 'S', basicSalary: 900_000, currency: 'JOD', effectiveFrom: '2026-11-11', effectiveTo: null }] });
    expect(hire.basic).toBe(600_000); // 900 × 20/30
    expect(hire.issues).toContain('partialPeriod');
    expect(hire.status).toBe('ok');

    const records = withDerivedEnds([
      { id: 'c1', structureCode: 'S', basicSalary: 1_000_000, currency: 'JOD' as const, effectiveFrom: '2025-01-01' },
      { id: 'c2', structureCode: 'S', basicSalary: 1_300_000, currency: 'JOD' as const, effectiveFrom: '2026-11-16' },
    ]);
    expect(records[0]!.effectiveTo).toBe('2026-11-15');
    const raise = line({ compensation: records });
    expect(raise.earnings.filter((e) => e.kind === 'basic').map((e) => e.amount)).toEqual([500_000, 650_000]); // 15 + 15 days
    expect(raise.basic).toBe(1_150_000);
  });

  it('a leaver is paid up to the last employed day; non-employed or uncompensated employees are excluded', () => {
    expect(line({ employee: { hireDate: '2020-01-01', lastDay: '2026-11-09' } }).basic).toBe(360_000); // 1200 × 9/30
    expect(calculateLine(input({ employee: { hireDate: '2026-12-01', lastDay: null } }))).toEqual({ included: false, reason: 'notEmployed' });
    expect(calculateLine(input({ compensation: [] }))).toEqual({ included: false, reason: 'missingCompensation' });
    expect(calculateLine(input({ currency: 'USD' }))).toEqual({ included: false, reason: 'currencyMismatch' });
  });

  it('one-time items apply only in the period of their effective date; recurring ones while in force', () => {
    const bonus = fixed('BONUS', 100_000, { recurrence: 'one-time', effectiveFrom: '2026-11-15' });
    expect(line({ allowances: [bonus] }).allowances).toBe(100_000);
    expect(line({ allowances: [{ ...bonus, effectiveFrom: '2026-10-15' }] }).allowances).toBe(0);
    expect(line({ allowances: [fixed('ENDED', 50_000, { effectiveTo: '2026-10-31' })] }).allowances).toBe(0);
    expect(line({ allowances: [fixed('STARTS', 50_000, { effectiveFrom: '2026-11-30' })] }).allowances).toBe(50_000);
  });

  it('approved unpaid leave: days × basic ÷ 30 (rounded once); paid leave never deducted; each date once', () => {
    const leave = [
      { requestId: 'lv-1', number: 'LR-1', typeCode: 'UNPAID', typeName: { en: 'Unpaid', ar: 'بدون راتب' }, paid: false, dates: ['2026-11-02', '2026-11-03'] },
      // Overlapping request covering one of the same dates: counted once (no double deduction).
      { requestId: 'lv-2', number: 'LR-2', typeCode: 'OTHER', typeName: { en: 'Other', ar: 'أخرى' }, paid: false, dates: ['2026-11-03', '2026-11-04'] },
      { requestId: 'lv-3', number: 'LR-3', typeCode: 'ANNUAL', typeName: { en: 'Annual', ar: 'سنوية' }, paid: true, dates: ['2026-11-10', '2026-11-11'] },
    ];
    const l = line({ leave });
    const item = l.deductionItems.find((d) => d.category === 'unpaid-leave')!;
    expect(item.amount).toBe(120_000); // 3 days × 1200 ÷ 30
    expect(item.basis).toEqual([{ method: 'daily-rate', base: 1_200_000, days: 3, divisor: 30 }]);
    expect(item.sources).toEqual(['lv-1', 'lv-2']);
    expect(l.inputs.unpaidLeaveDays).toBe(3);
    expect(l.deductions).toBe(120_000);
    // The divisor is the policy's: 31 changes the amount.
    expect(line({ leave, policy: { dailyRateDivisor: 31 } }).deductions).toBe(116_129); // 3600 ÷ 31 = 116.1290…
    // No active unpaid-leave deduction type → nothing deducted.
    expect(line({ leave, unpaidLeaveType: null }).deductions).toBe(0);
  });

  it('absence is deducted only when the absence type is enabled, never for leave days; lateness never', () => {
    const attendance = { ...NO_ATTENDANCE, dataFrom: '2026-11-01', dataTo: '2026-11-16', absent: 2, late: 5, lateMinutes: 140, absentDates: ['2026-11-05', '2026-11-12'] };
    const off = line({ attendance });
    expect(off.deductions).toBe(0);
    expect(off.inputs.attendance.lateMinutes).toBe(140);
    const on = line({ attendance, absenceType: ABSENCE });
    expect(on.deductions).toBe(80_000); // 2 × 1200 ÷ 30
    expect(on.inputs.absenceDays).toBe(2);
    expect(on.issues).toContain('attendanceIncomplete'); // data only up to 16 Nov
    expect(on.status).toBe('warning');
    const leave = [{ requestId: 'lv-1', number: 'LR-1', typeCode: 'SICK', typeName: { en: 'Sick', ar: 'مرضية' }, paid: true, dates: ['2026-11-12'] }];
    expect(line({ attendance, absenceType: ABSENCE, leave }).deductions).toBe(40_000);
  });

  it('caps deductions at the per-period maximum and marks illustrative statutory items', () => {
    const cappedLoan = { ...fixed('LOAN', 300_000), type: type('LOAN', { maxAmount: 200_000, category: 'loan' }) };
    const statutory = { ...pct('STAT', 500), type: type('STAT', { category: 'statutory', illustrative: true }) };
    const l = line({ deductions: [cappedLoan], statutory: [statutory] });
    expect(l.deductionItems.map((d) => [d.code, d.amount, d.capped, d.illustrative])).toEqual([
      ['STAT', 60_000, false, true],
      ['LOAN', 200_000, true, false],
    ]);
  });

  it('a negative net salary is an error (no policy allows it); a fixed amount in another currency is skipped', () => {
    const l = line({ deductions: [fixed('ADVANCE', 1_500_000)] });
    expect(l.net).toBe(-300_000);
    expect(l.issues).toContain('negativeNet');
    expect(l.status).toBe('error');
    const usd = line({ allowances: [fixed('USD-ALW', 10_000, { currency: 'USD' })] });
    expect(usd.allowances).toBe(0);
    expect(usd.issues).toContain('currencySkipped');
  });

  it('is deterministic and keeps a snapshot of its inputs', () => {
    const a = calculateLine(input({ allowances: [fixed('T', 40_000)] }));
    const b = calculateLine(input({ allowances: [fixed('T', 40_000)] }));
    expect(a).toEqual(b);
    if (!a.included) throw new Error('excluded');
    expect(a.line.inputs).toMatchObject({ period: { start: NOV.start, end: NOV.end, days: 30 }, employment: { from: NOV.start, to: NOV.end, days: 30 }, compensation: [{ recordId: 'c1', basicSalary: 1_200_000, days: 30 }], policy: { dailyRateDivisor: 30 } });
  });
});
