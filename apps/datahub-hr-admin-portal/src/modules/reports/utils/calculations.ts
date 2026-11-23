/*
 * Pure reporting formulas (tested in calculations.test.ts). They only COMBINE figures the source modules return —
 * status rules, balances, payroll amounts and compliance stay in their modules and are never recomputed here.
 */

/* Dates ----------------------------------------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && isoDate(new Date(`${v}T00:00`)) === v;
export const monthOf = (date: string) => date.slice(0, 7);
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
export function addMonths(month: string, count: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + count, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export const monthStart = (month: string) => `${month}-01`;
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return isoDate(new Date(y, m, 0));
}
/** Calendar days from `start` to `end`, both included (UTC days, so DST never shifts it). */
export function daysBetween(start: string, end: string): number {
  const utc = (v: string) => {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(end) - utc(start)) / 86_400_000);
}
/** Months `YYYY-MM` from the month of `from` to the month of `to`, oldest first. */
export function monthsIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = monthOf(from); m <= monthOf(to); m = addMonths(m, 1)) out.push(m);
  return out;
}
export const inRange = (date: string | null | undefined, from: string, to: string) => !!date && date.slice(0, 10) >= from && date.slice(0, 10) <= to;
export const clampDate = (date: string, min: string, max: string) => (date < min ? min : date > max ? max : date);

/* Ratios ---------------------------------------------------------------------------------------------------------- */

/** `part ÷ whole`, or `null` when the whole is 0 (no basis — not 0 %). */
export const ratio = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);
export const average = (values: readonly number[]): number | null => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
export const sum = (values: readonly number[]) => values.reduce((s, v) => s + v, 0);
/** Median of the values (`null` when empty). */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
/** Rounded to `digits` decimals (display/export of ratios and averages; never used for money). */
export const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/* Workforce ------------------------------------------------------------------------------------------------------ */

export interface WorkforceRecord {
  hireDate: string;
  /** Date the employee became inactive (`null` = still active, or never left). */
  leftOn: string | null;
}

/** Employed at the END of `date`: hired on or before it and not left on or before it. */
export const employedOn = (e: WorkforceRecord, date: string) => e.hireDate <= date && (e.leftOn === null || e.leftOn > date);
export const headcountOn = (list: readonly WorkforceRecord[], date: string) => list.filter((e) => employedOn(e, date)).length;

export interface TurnoverRow {
  month: string;
  opening: number;
  hires: number;
  leavers: number;
  closing: number;
  /** (opening + closing) ÷ 2. */
  averageHeadcount: number;
  /** leavers ÷ average headcount (`null` when the average is 0). */
  turnoverRate: number | null;
}

/**
 * Monthly turnover: leavers in the month ÷ average headcount ((opening + closing) ÷ 2). Opening = employed at the end
 * of the previous month; closing = employed at the month's end; hires and leavers by their dates in the month.
 */
export function turnoverByMonth(list: readonly WorkforceRecord[], months: readonly string[]): TurnoverRow[] {
  return months.map((month) => {
    const opening = headcountOn(list, addDays(monthStart(month), -1));
    const closing = headcountOn(list, monthEnd(month));
    const hires = list.filter((e) => inRange(e.hireDate, monthStart(month), monthEnd(month))).length;
    const leavers = list.filter((e) => inRange(e.leftOn, monthStart(month), monthEnd(month))).length;
    const averageHeadcount = (opening + closing) / 2;
    return { month, opening, hires, leavers, closing, averageHeadcount, turnoverRate: ratio(leavers, averageHeadcount) };
  });
}

/** Turnover over a whole period: leavers in [from, to] ÷ average of the headcount at the start and at the end. */
export function periodTurnover(list: readonly WorkforceRecord[], from: string, to: string) {
  const opening = headcountOn(list, addDays(from, -1));
  const closing = headcountOn(list, to);
  const leavers = list.filter((e) => inRange(e.leftOn, from, to)).length;
  const hires = list.filter((e) => inRange(e.hireDate, from, to)).length;
  return { opening, closing, hires, leavers, averageHeadcount: (opening + closing) / 2, rate: ratio(leavers, (opening + closing) / 2) };
}

/** Whole years between two dates (age, tenure). */
export function yearsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return ty - fy - (tm < fm || (tm === fm && td < fd) ? 1 : 0);
}

export const AGE_BANDS = ['under-25', '25-34', '35-44', '45-54', '55-plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export function ageBand(age: number): AgeBand {
  if (age < 25) return 'under-25';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55-plus';
}

/* Attendance ------------------------------------------------------------------------------------------------------ */

export interface StatusCounts {
  present: number;
  late: number;
  absent: number;
  'on-leave': number;
  'half-day': number;
  incomplete: number;
  scheduled: number;
}

/** Days the employee came in: present, late, half day or incomplete (checked in). */
export const attendedDays = (c: StatusCounts) => c.present + c.late + c['half-day'] + c.incomplete;

/**
 * Attendance rate — the Attendance module's definition: attended ÷ (attended + absent). Approved leave and days that
 * have not started ("Not started") are not due, so they are neither attended nor absent. `null` when nothing was due.
 */
export const attendanceRate = (c: StatusCounts) => ratio(attendedDays(c), attendedDays(c) + c.absent);

/* Recruitment ---------------------------------------------------------------------------------------------------- */

/** Offer acceptance rate: accepted ÷ offers the candidate answered or let expire (accepted + rejected + expired). */
export function offerAcceptanceRate(statuses: readonly string[]): number | null {
  const accepted = statuses.filter((s) => s === 'accepted').length;
  const decided = statuses.filter((s) => s === 'accepted' || s === 'rejected' || s === 'expired').length;
  return ratio(accepted, decided);
}

/** Step-to-step conversion of a funnel: each step ÷ the previous one (the first is `null`). */
export function funnelConversion(counts: readonly number[]): Array<number | null> {
  return counts.map((c, i) => (i === 0 ? null : ratio(c, counts[i - 1]!)));
}

/** Days from application to the accepted offer; `null` when either date is missing or out of order. */
export function timeToHire(appliedAt: string | null, acceptedAt: string | null): number | null {
  if (!appliedAt || !acceptedAt) return null;
  const days = daysBetween(appliedAt, acceptedAt);
  return days >= 0 ? days : null;
}

/* Performance ------------------------------------------------------------------------------------------------------ */

/** Rating distribution on the 1–5 scale (each value counted, values outside the scale ignored). */
export function ratingDistribution(ratings: readonly number[], scale: readonly number[] = [1, 2, 3, 4, 5]) {
  return scale.map((value) => ({ value, count: ratings.filter((r) => r === value).length }));
}

/* Documents ------------------------------------------------------------------------------------------------------- */

/**
 * Document compliance rate: verified (non-expired) required items ÷ applicable required items, over all employees
 * (each item weighs the same). Uses the Documents module's checklist statuses; `null` when no rule applies.
 */
export function complianceRate(items: ReadonlyArray<{ status: string }>): number | null {
  return ratio(items.filter((i) => i.status === 'verified').length, items.length);
}

/* Grouping ------------------------------------------------------------------------------------------------------- */

export function groupBy<T, K>(list: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of list) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function countBy<T>(list: readonly T[], keyOf: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of list) out[keyOf(item)] = (out[keyOf(item)] ?? 0) + 1;
  return out;
}
