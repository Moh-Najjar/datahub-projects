import type { Localized } from '@datahub/shared-types';
import type { RecordStatus, Weekday } from '@/modules/attendance/types/attendance';

/*
 * FICTIONAL attendance setup for the simulated backend. The shifts are examples for the demo — they do not
 * represent any company's working policy. Read only by `attendanceMock.ts`.
 *
 * Attendance records are NOT stored here: the mock generates them for the existing employees (Employee
 * Management) from a deterministic hash of employee id + date, so every run — and every test — sees the same
 * attendance for the same day.
 */

export interface ShiftRow {
  id: string;
  code: string;
  name: Localized<string>;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  workDays: Weekday[];
  status: RecordStatus;
  createdAt: string;
}

const SUN_THU: Weekday[] = [0, 1, 2, 3, 4];

export const SHIFT_SEED: readonly ShiftRow[] = [
  { id: 'shf-01', code: 'SHF-MOR', name: { en: 'Morning Shift', ar: 'الوردية الصباحية' }, startTime: '08:00', endTime: '16:00', breakMinutes: 60, graceMinutes: 10, workDays: SUN_THU, status: 'active', createdAt: '2019-02-03T09:00:00.000Z' },
  { id: 'shf-02', code: 'SHF-EVE', name: { en: 'Evening Shift', ar: 'الوردية المسائية' }, startTime: '16:00', endTime: '00:00', breakMinutes: 45, graceMinutes: 10, workDays: SUN_THU, status: 'active', createdAt: '2019-11-10T09:00:00.000Z' },
  { id: 'shf-03', code: 'SHF-NGT', name: { en: 'Night Shift', ar: 'الوردية الليلية' }, startTime: '00:00', endTime: '08:00', breakMinutes: 45, graceMinutes: 15, workDays: SUN_THU, status: 'active', createdAt: '2020-08-30T09:00:00.000Z' },
  { id: 'shf-04', code: 'SHF-WKD', name: { en: 'Weekend Support', ar: 'دعم نهاية الأسبوع' }, startTime: '10:00', endTime: '18:00', breakMinutes: 30, graceMinutes: 10, workDays: [5, 6], status: 'active', createdAt: '2021-03-07T09:00:00.000Z' },
  { id: 'shf-05', code: 'SHF-PLT', name: { en: 'Early Pilot Shift', ar: 'الوردية المبكرة التجريبية' }, startTime: '07:00', endTime: '15:00', breakMinutes: 60, graceMinutes: 5, workDays: SUN_THU, status: 'inactive', createdAt: '2023-05-14T09:00:00.000Z' },
];

/** FNV-1a: stable 32-bit hash of a string (seeds the per-employee, per-day generator). */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Initial shift of an employee (by department, deterministic). Later changes go through `assignShift`. */
export function initialShiftId(employeeId: string, departmentId: string): string {
  const h = hash(employeeId) % 10;
  if (departmentId === 'dep-support') return h < 3 ? 'shf-02' : h === 3 ? 'shf-04' : 'shf-01';
  if (departmentId === 'dep-ops-log') return h < 5 ? 'shf-03' : 'shf-01';
  if (departmentId === 'dep-ops-fac') return h < 2 ? 'shf-03' : 'shf-01';
  if (departmentId === 'dep-it-sd') return h < 3 ? 'shf-02' : 'shf-01';
  return 'shf-01';
}

/** Months of attendance kept by the simulation: the current month and the three before it. */
export const WINDOW_MONTHS = 4;
