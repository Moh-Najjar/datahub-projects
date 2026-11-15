import type { Localized } from '@datahub/shared-types';
import type { LeaveStatus, MonthKey } from '@/modules/dashboard/types/dashboard';

/*
 * FICTIONAL dashboard dataset — the single source for every dashboard figure. Read only by `dashboardMock.ts`.
 *
 * Each department has a fixed size; monthly hires/exits, attendance and leave figures are generated with a
 * seeded PRNG, so the data is identical on every run (and in tests). Organisation figures are always SUMS of
 * department figures, and headcount history is reconstructed backwards from today's headcount — so KPIs,
 * charts and pending actions can never disagree with each other.
 */

export const HISTORY_MONTHS = 24;
export const LEAVE_MONTHS = 6;

/** The demo Department Manager's department (the real backend derives this from the signed-in user). */
export const DEMO_TEAM_DEPARTMENT_ID = 'dep-eng';

interface DepartmentSeed {
  id: string;
  name: Localized<string>;
  active: number;
  inactive: number;
  openPositions: number;
  openPositionsLastMonth: number;
  probationReviewsDue: number;
  documentsExpiring: number;
  attendanceCorrections: number;
}

const SEEDS: readonly DepartmentSeed[] = [
  { id: 'dep-eng', name: { en: 'Engineering', ar: 'الهندسة' }, active: 58, inactive: 4, openPositions: 3, openPositionsLastMonth: 2, probationReviewsDue: 2, documentsExpiring: 3, attendanceCorrections: 4 },
  { id: 'dep-sales', name: { en: 'Sales', ar: 'المبيعات' }, active: 39, inactive: 2, openPositions: 2, openPositionsLastMonth: 3, probationReviewsDue: 1, documentsExpiring: 2, attendanceCorrections: 2 },
  { id: 'dep-ops', name: { en: 'Operations', ar: 'العمليات' }, active: 36, inactive: 2, openPositions: 1, openPositionsLastMonth: 1, probationReviewsDue: 1, documentsExpiring: 4, attendanceCorrections: 3 },
  { id: 'dep-support', name: { en: 'Customer Support', ar: 'دعم العملاء' }, active: 33, inactive: 2, openPositions: 1, openPositionsLastMonth: 2, probationReviewsDue: 2, documentsExpiring: 1, attendanceCorrections: 2 },
  { id: 'dep-it', name: { en: 'Information Technology', ar: 'تقنية المعلومات' }, active: 23, inactive: 1, openPositions: 0, openPositionsLastMonth: 1, probationReviewsDue: 0, documentsExpiring: 1, attendanceCorrections: 1 },
  { id: 'dep-fin', name: { en: 'Finance', ar: 'المالية' }, active: 17, inactive: 1, openPositions: 0, openPositionsLastMonth: 0, probationReviewsDue: 1, documentsExpiring: 0, attendanceCorrections: 0 },
  { id: 'dep-mkt', name: { en: 'Marketing', ar: 'التسويق' }, active: 15, inactive: 1, openPositions: 0, openPositionsLastMonth: 0, probationReviewsDue: 0, documentsExpiring: 1, attendanceCorrections: 1 },
  { id: 'dep-hr', name: { en: 'Human Resources', ar: 'الموارد البشرية' }, active: 14, inactive: 0, openPositions: 0, openPositionsLastMonth: 0, probationReviewsDue: 0, documentsExpiring: 0, attendanceCorrections: 0 },
];

export interface AttendanceCounts {
  late: number;
  absent: number;
  onLeave: number;
}

export interface DepartmentData extends DepartmentSeed {
  /** Hires and exits per month, oldest first; index `HISTORY_MONTHS - 1` is the current month (to date). */
  hires: number[];
  exits: number[];
  attendanceToday: AttendanceCounts;
  attendanceYesterday: AttendanceCounts;
  /** Leave requests submitted per month (last `LEAVE_MONTHS`, oldest first) by current status. */
  leave: Array<Record<LeaveStatus, number>>;
}

/** Small deterministic PRNG (mulberry32). */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

function attendance(active: number, random: () => number): AttendanceCounts {
  return {
    onLeave: Math.round(active * 0.04 + random() * 1.5),
    absent: Math.round(active * 0.02 + random() * 1.5),
    late: Math.round(active * 0.05 + random() * 2),
  };
}

function buildDepartment(seed: DepartmentSeed): DepartmentData {
  const random = prng(hash(seed.id));
  const size = seed.active + seed.inactive;
  const maxMonthly = Math.max(1, Math.round(size / 20));
  const hires = Array.from({ length: HISTORY_MONTHS }, () => Math.floor(random() * (maxMonthly + 1)));
  const exits = Array.from({ length: HISTORY_MONTHS }, () => Math.floor(random() * maxMonthly));
  const leave = Array.from({ length: LEAVE_MONTHS }, (_, i) => {
    const recent = i >= LEAVE_MONTHS - 2; // only the last two months still have undecided requests
    return {
      approved: Math.round(size * 0.12 + random() * 3),
      rejected: Math.floor(random() * 2),
      cancelled: Math.floor(random() * 2),
      pending: recent ? Math.round(size * (i === LEAVE_MONTHS - 1 ? 0.06 : 0.02) + random()) : 0,
    };
  });
  return {
    ...seed,
    hires,
    exits,
    attendanceToday: attendance(seed.active, random),
    attendanceYesterday: attendance(seed.active, random),
    leave,
  };
}

export const DEPARTMENTS: readonly DepartmentData[] = SEEDS.map(buildDepartment);

/** End-of-month headcount history, oldest first; the last value is today's headcount. */
export function headcountHistory(department: DepartmentData): number[] {
  const series = new Array<number>(HISTORY_MONTHS);
  series[HISTORY_MONTHS - 1] = department.active + department.inactive;
  for (let i = HISTORY_MONTHS - 1; i > 0; i--) series[i - 1] = series[i]! - department.hires[i]! + department.exits[i]!;
  return series;
}

/** `YYYY-MM` for the month `offset` months before `now`'s month. */
export function monthKey(now: Date, offset: number): MonthKey {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
