import type { CycleStatus, GoalStatus } from '@/modules/performance/types/performance';

/*
 * Pure performance rules (used by the simulated backend, the UI and tests; the real backend implements the same).
 */

/**
 * Manual cycle transitions. `in-progress` (first submission) and `completed` (every manager review submitted) are set
 * by the system; `closed` is final and locks every review of the cycle (its history stays available).
 */
export const CYCLE_TRANSITIONS: Readonly<Record<CycleStatus, readonly CycleStatus[]>> = {
  draft: ['active'],
  active: ['closed'],
  'in-progress': ['closed'],
  completed: ['closed'],
  closed: [],
};

/** Cycles whose reviews can still be written. */
export const OPEN_CYCLE_STATUSES: readonly CycleStatus[] = ['active', 'in-progress'];
/** Cycles counted as "current" in the overview. */
export const CURRENT_CYCLE_STATUSES: readonly CycleStatus[] = ['active', 'in-progress', 'completed'];

/** Goals in a final status accept no more progress updates. */
export const FINAL_GOAL_STATUSES: readonly GoalStatus[] = ['completed', 'cancelled'];

/** Two date ranges share at least one day. */
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start <= b.end && b.start <= a.end;

const pad = (n: number) => String(n).padStart(2, '0');
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && formatDate(new Date(`${v}T00:00`)) === v;
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
};
export const todayIso = () => formatDate(new Date());

/** Average of ratings rounded to one decimal; `null` when there are none. */
export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
