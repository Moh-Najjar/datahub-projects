import type { RunStatus } from '@/modules/payroll/types/payroll';

/*
 * Pure payroll rules shared by the simulated backend, the UI and tests (the real backend must implement the same).
 */

/* Dates ---------------------------------------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && formatDate(new Date(`${v}T00:00`)) === v;
export const todayIso = () => formatDate(new Date());
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}
/** Calendar days from `start` to `end`, both included (0 if end < start). Uses UTC days, so DST never shifts it. */
export function daysInclusive(start: string, end: string): number {
  const utc = (v: string) => {
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((utc(end) - utc(start)) / 86_400_000) + 1);
}
export const monthOf = (date: string) => date.slice(0, 7);
export const monthStart = (month: string) => `${month}-01`;
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return formatDate(new Date(y, m, 0));
}
export function addMonths(month: string, count: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + count, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
/** Two date ranges share at least one day (`null` end = open). */
export const rangesOverlap = (aStart: string, aEnd: string | null, bStart: string, bEnd: string | null) => aStart <= (bEnd ?? '9999-12-31') && bStart <= (aEnd ?? '9999-12-31');

/** A monthly pay period is one calendar month. */
export const isCalendarMonth = (start: string, end: string) => start.endsWith('-01') && end === monthEnd(monthOf(start));

/** The payment date may not precede the period and must fall within 31 days after it ends. */
export const PAYMENT_DAYS_AFTER_PERIOD = 31;

/* Payroll run workflow ---------------------------------------------------------------------------------------------- */

/**
 * Draft → (calculate) → Calculated → (validate, submit) → Pending approval → Approved → (simulated payment) → Paid.
 * Rejected runs are corrected by recalculating (→ Calculated) or editing (→ Draft) and resubmitted. Paid and cancelled
 * runs are final. `calculating` exists only while a calculation runs.
 */
export const EDITABLE_RUN_STATUSES: readonly RunStatus[] = ['draft', 'rejected'];
export const CALCULABLE_RUN_STATUSES: readonly RunStatus[] = ['draft', 'calculated', 'rejected'];
export const CANCELLABLE_RUN_STATUSES: readonly RunStatus[] = ['draft', 'calculated', 'rejected'];
/** Runs that hold employees for their period (cancelled runs release them). */
export const BLOCKING_RUN_STATUSES: readonly RunStatus[] = ['draft', 'calculating', 'calculated', 'pending-approval', 'approved', 'rejected', 'paid'];
/** Final payroll: the only runs reports, payslips and the overview's cost figures use. */
export const FINAL_RUN_STATUSES: readonly RunStatus[] = ['approved', 'paid'];
/** Not finished yet ("pending payroll runs"). */
export const PENDING_RUN_STATUSES: readonly RunStatus[] = ['draft', 'calculated', 'rejected'];
