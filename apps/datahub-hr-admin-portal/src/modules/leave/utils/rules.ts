import type { LeaveType, PublicHoliday } from '@/modules/leave/types/leave';

/*
 * Pure leave rules (used by the simulated backend, its seed and tests; the real backend implements the same).
 * Dates are local `YYYY-MM-DD`.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day);
};
const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const addDays = (date: string, days: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return format(d);
};
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && format(parse(v)) === v;

/** Every calendar date from `start` to `end` (inclusive). */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface EmployeeFacts {
  hireDate: string;
  gender: 'male' | 'female';
}

/** Whether the employee may take this leave type at all. */
export const isEligible = (type: Pick<LeaveType, 'eligibility'>, employee: Pick<EmployeeFacts, 'gender'>) => type.eligibility === 'all' || type.eligibility === employee.gender;

/**
 * Annual allocation of a leave type for an employee in `year` (configurable per type):
 * base days + seniority bonus (years of service reached during the year), pro-rated by remaining months for employees
 * hired during the year when the type says so; 0 when not eligible or hired after the year; `null` = no allocation.
 */
export function allocationFor(type: Pick<LeaveType, 'annualAllocation' | 'seniorityYears' | 'seniorityExtraDays' | 'prorateFirstYear' | 'eligibility'>, employee: EmployeeFacts, year: number): number | null {
  if (type.annualAllocation === null) return null;
  if (!isEligible(type, employee)) return 0;
  const hire = parse(employee.hireDate);
  if (hire.getFullYear() > year) return 0;
  const years = year - hire.getFullYear();
  let days = type.annualAllocation + (type.seniorityYears > 0 && years >= type.seniorityYears ? type.seniorityExtraDays : 0);
  if (type.prorateFirstYear && hire.getFullYear() === year) {
    const monthsLeft = 12 - hire.getMonth(); // hired in January → 12 months
    days = Math.round(((days * monthsLeft) / 12) * 2) / 2; // to the half day
  }
  return days;
}

export interface DayCount {
  days: number;
  countedDates: string[];
  excludedHolidays: PublicHoliday[];
}

/**
 * Leave days of a request: the employee's WORKING days in the range (their shift schedule decides the weekend), minus
 * public holidays when the leave type excludes them. Non-working days are never counted.
 */
export function countLeaveDays(start: string, end: string, isWorkingDay: (date: string) => boolean, type: Pick<LeaveType, 'excludesPublicHolidays'>, holidays: readonly PublicHoliday[]): DayCount {
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
  const countedDates: string[] = [];
  const excludedHolidays: PublicHoliday[] = [];
  for (const date of datesBetween(start, end)) {
    if (!isWorkingDay(date)) continue;
    const holiday = holidayByDate.get(date);
    if (holiday && type.excludesPublicHolidays) {
      excludedHolidays.push(holiday);
      continue;
    }
    countedDates.push(date);
  }
  return { days: countedDates.length, countedDates, excludedHolidays };
}

/** Two date ranges share at least one day. */
export const overlaps = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) => a.startDate <= b.endDate && b.startDate <= a.endDate;
