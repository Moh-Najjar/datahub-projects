import { describe, expect, it } from 'vitest';
import { leaveRequestFormSchema, leaveTypeFormSchema, leaveTypeToForm, rejectSchema, toLeaveTypeInput } from '@/modules/leave/schemas/leaveSchemas';
import type { LeaveType } from '@/modules/leave/types/leave';
import { addDays, allocationFor, countLeaveDays, datesBetween, isDate, isEligible, overlaps } from './rules';

const ANNUAL = { annualAllocation: 14, seniorityYears: 5, seniorityExtraDays: 7, prorateFirstYear: true, eligibility: 'all' as const, excludesPublicHolidays: true };
const sunToThu = (date: string) => new Date(`${date}T00:00`).getDay() <= 4; // Sun(0)–Thu(4)
const HOLIDAYS = [{ date: '2026-11-26', name: { en: 'Company Day', ar: 'يوم الشركة' } }];

describe('dates', () => {
  it('adds days across months and years, validates dates, lists ranges', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-11-16')).toBe(true);
    expect(datesBetween('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });

  it('overlap is inclusive of the boundary days', () => {
    expect(overlaps({ startDate: '2026-11-01', endDate: '2026-11-05' }, { startDate: '2026-11-05', endDate: '2026-11-09' })).toBe(true);
    expect(overlaps({ startDate: '2026-11-01', endDate: '2026-11-05' }, { startDate: '2026-11-06', endDate: '2026-11-09' })).toBe(false);
  });
});

describe('allocation rules (configurable)', () => {
  it('base allocation, seniority bonus and first-year pro-rating', () => {
    expect(allocationFor(ANNUAL, { hireDate: '2023-08-13', gender: 'male' }, 2026)).toBe(14);
    expect(allocationFor(ANNUAL, { hireDate: '2021-02-01', gender: 'female' }, 2026)).toBe(21); // 5 years reached in 2026
    expect(allocationFor(ANNUAL, { hireDate: '2026-07-01', gender: 'male' }, 2026)).toBe(7); // 6 of 12 months
    expect(allocationFor(ANNUAL, { hireDate: '2026-04-15', gender: 'male' }, 2026)).toBe(10.5); // 9 months, half days
    expect(allocationFor(ANNUAL, { hireDate: '2027-01-10', gender: 'male' }, 2026)).toBe(0); // not yet hired
    expect(allocationFor({ ...ANNUAL, annualAllocation: null }, { hireDate: '2020-01-01', gender: 'male' }, 2026)).toBeNull(); // no limit
  });

  it('eligibility by type', () => {
    expect(isEligible({ eligibility: 'female' }, { gender: 'male' })).toBe(false);
    expect(allocationFor({ ...ANNUAL, eligibility: 'female', annualAllocation: 70, prorateFirstYear: false }, { hireDate: '2020-01-01', gender: 'male' }, 2026)).toBe(0);
  });
});

describe('day counting', () => {
  it("counts the employee's working days only; holidays per the type's policy", () => {
    const week = countLeaveDays('2026-11-22', '2026-11-28', sunToThu, ANNUAL, HOLIDAYS);
    expect(week.days).toBe(4);
    expect(week.excludedHolidays.map((h) => h.date)).toEqual(['2026-11-26']);
    expect(countLeaveDays('2026-11-22', '2026-11-28', sunToThu, { excludesPublicHolidays: false }, HOLIDAYS).days).toBe(5);
    expect(countLeaveDays('2026-11-27', '2026-11-28', sunToThu, ANNUAL, HOLIDAYS).days).toBe(0); // Fri–Sat
    // Another schedule (Mon–Fri) gives another count for the same dates.
    const monToFri = (d: string) => [1, 2, 3, 4, 5].includes(new Date(`${d}T00:00`).getDay());
    expect(countLeaveDays('2026-11-22', '2026-11-28', monToFri, { excludesPublicHolidays: false }, HOLIDAYS).days).toBe(5);
  });
});

describe('form schemas', () => {
  it('request: end before start, crossing a year', () => {
    const base = { employeeId: '', leaveTypeId: 'lt-01', reason: '', document: null };
    const issues = (v: object) => leaveRequestFormSchema.safeParse({ ...base, ...v }).error?.issues.map((i) => i.message);
    expect(issues({ startDate: '2026-11-20', endDate: '2026-11-19' })).toEqual(['endBeforeStart']);
    expect(issues({ startDate: '2026-12-30', endDate: '2027-01-02' })).toEqual(['crossesYear']);
    expect(issues({ startDate: '2026-11-20', endDate: '2026-11-20' })).toBeUndefined();
  });

  it('leave type: round trip and rule validation', () => {
    const t: LeaveType = { id: 'lt-x', code: 'STUDY', name: { en: 'Study', ar: 'دراسة' }, description: '', paid: true, annualAllocation: 5, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: null, requiresApproval: true, requiresDocument: false, eligibility: 'all', excludesPublicHolidays: true, status: 'active', createdAt: '' };
    const parsed = leaveTypeFormSchema.parse(leaveTypeToForm(t));
    expect(toLeaveTypeInput(parsed)).toMatchObject({ code: 'STUDY', annualAllocation: 5, maxConsecutiveDays: null });
    const bad = leaveTypeFormSchema.safeParse({ ...leaveTypeToForm(t), seniorityYears: 3, seniorityExtraDays: 0, hasMaxConsecutive: true, maxConsecutiveDays: 0 });
    expect(bad.error?.issues.map((i) => i.message).sort()).toEqual(['dayRange', 'seniorityDays']);
  });

  it('rejection reason: required, then at least 5 characters', () => {
    expect(rejectSchema.safeParse({ reason: '   ' }).error?.issues.map((i) => i.message)).toEqual(['reasonRequired']);
    expect(rejectSchema.safeParse({ reason: 'no' }).error?.issues.map((i) => i.message)).toEqual(['reasonTooShort']);
  });
});
