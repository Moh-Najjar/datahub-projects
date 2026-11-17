import type { AttendanceStatus, ShiftSnapshot, Weekday } from '@/modules/attendance/types/attendance';

/*
 * Pure attendance rules (used by the simulated backend and by tests; the real backend implements the same).
 * All values are local wall-clock: dates `YYYY-MM-DD`, times `HH:mm`, date-times `YYYY-MM-DDTHH:mm`.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date-time string → epoch ms (interpreted in the local time zone). */
export function toMs(dateTime: string): number {
  const [d, t = '00:00'] = dateTime.split('T') as [string, string?];
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const [h, min] = t.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, day, h, min).getTime();
}

export function toDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const toDate = (ms: number) => toDateTime(ms).slice(0, 10);
export const todayIso = (now: number = Date.now()) => toDate(now);

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return toDate(new Date(y, m - 1, d + days).getTime());
}

export function weekday(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getDay() as Weekday;
}

/** `HH:mm` → minutes after midnight. */
export const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && toDate(toMs(v)) === v;
export const isDateTime = (v: string) => /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v) && toDateTime(toMs(v)) === v;

/** Length of a shift in minutes; an end at or before the start means the shift ends the next day. */
export function shiftSpanMinutes(startTime: string, endTime: string): number {
  const span = minutesOf(endTime) - minutesOf(startTime);
  return span > 0 ? span : span + 24 * 60;
}

export const isOvernight = (startTime: string, endTime: string) => minutesOf(endTime) <= minutesOf(startTime);

/** Scheduled time minus the break. */
export const shiftWorkingMinutes = (s: { startTime: string; endTime: string; breakMinutes: number }) => shiftSpanMinutes(s.startTime, s.endTime) - s.breakMinutes;

/** Scheduled start/end of a shift that starts on `date` (overnight shifts end on the next day). */
export function shiftWindow(date: string, s: { startTime: string; endTime: string }): { start: string; end: string } {
  const start = `${date}T${s.startTime}`;
  return { start, end: toDateTime(toMs(start) + shiftSpanMinutes(s.startTime, s.endTime) * 60_000) };
}

/** How long after the scheduled end a missing check-out turns a record "incomplete". */
export const CHECKOUT_ALLOWANCE_MINUTES = 4 * 60;

export interface EvaluableRecord {
  scheduledStart: string;
  scheduledEnd: string;
  checkIn: string | null;
  checkOut: string | null;
  onLeave: boolean;
  shift: Pick<ShiftSnapshot, 'breakMinutes' | 'graceMinutes'>;
}

export interface Evaluation {
  status: AttendanceStatus;
  workedMinutes: number | null;
  lateMinutes: number;
}

/**
 * Status, worked time and lateness of a record at time `now`. A missing check-in is NOT automatically "absent":
 * until the scheduled shift has ended the record is "scheduled".
 */
export function evaluateRecord(r: EvaluableRecord, now: number): Evaluation {
  if (r.onLeave) return { status: 'on-leave', workedMinutes: null, lateMinutes: 0 };
  const start = toMs(r.scheduledStart);
  const end = toMs(r.scheduledEnd);
  if (!r.checkIn) return { status: now >= end ? 'absent' : 'scheduled', workedMinutes: null, lateMinutes: 0 };

  const checkIn = toMs(r.checkIn);
  const lateMinutes = checkIn > start + r.shift.graceMinutes * 60_000 ? Math.round((checkIn - start) / 60_000) : 0;
  if (!r.checkOut) {
    const overdue = now >= end + CHECKOUT_ALLOWANCE_MINUTES * 60_000;
    return { status: overdue ? 'incomplete' : lateMinutes > 0 ? 'late' : 'present', workedMinutes: null, lateMinutes };
  }

  const span = Math.round((toMs(r.checkOut) - checkIn) / 60_000);
  // The break is deducted only from a span long enough to contain it.
  const workedMinutes = Math.max(0, span > r.shift.breakMinutes * 2 ? span - r.shift.breakMinutes : span);
  const scheduledMinutes = Math.round((end - start) / 60_000) - r.shift.breakMinutes;
  if (workedMinutes < scheduledMinutes / 2) return { status: 'half-day', workedMinutes, lateMinutes };
  return { status: lateMinutes > 0 ? 'late' : 'present', workedMinutes, lateMinutes };
}

/** Records that count as "checked in" for totals. */
export const ATTENDED: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete'];
