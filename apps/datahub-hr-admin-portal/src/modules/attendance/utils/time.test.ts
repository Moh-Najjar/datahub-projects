import { describe, expect, it } from 'vitest';
import { addDays, evaluateRecord, isOvernight, shiftSpanMinutes, shiftWindow, shiftWorkingMinutes, toMs, weekday } from './time';

const MORNING = { startTime: '08:00', endTime: '16:00', breakMinutes: 60, graceMinutes: 10 };
const record = (patch: Partial<Parameters<typeof evaluateRecord>[0]> = {}) => ({
  scheduledStart: '2026-11-16T08:00',
  scheduledEnd: '2026-11-16T16:00',
  checkIn: null,
  checkOut: null,
  onLeave: false,
  shift: MORNING,
  ...patch,
});
const at = (dt: string) => toMs(dt);

describe('shift times', () => {
  it('computes spans and working time, including overnight shifts', () => {
    expect(shiftSpanMinutes('08:00', '16:00')).toBe(480);
    expect(shiftSpanMinutes('16:00', '00:00')).toBe(480); // ends at midnight
    expect(shiftSpanMinutes('22:00', '06:00')).toBe(480);
    expect(isOvernight('16:00', '00:00')).toBe(true);
    expect(isOvernight('00:00', '08:00')).toBe(false);
    expect(shiftWorkingMinutes(MORNING)).toBe(420);
    expect(shiftWindow('2026-11-16', { startTime: '22:00', endTime: '06:00' })).toEqual({ start: '2026-11-16T22:00', end: '2026-11-17T06:00' });
    expect(shiftWindow('2026-11-30', { startTime: '16:00', endTime: '00:00' }).end).toBe('2026-12-01T00:00');
  });

  it('handles dates across months and weekdays', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekday('2026-11-16')).toBe(1); // Monday
  });
});

describe('attendance status (never "absent" just because a check-in is missing)', () => {
  it('no check-in: "scheduled" until the shift ends, then "absent"', () => {
    expect(evaluateRecord(record(), at('2026-11-16T09:00')).status).toBe('scheduled');
    expect(evaluateRecord(record(), at('2026-11-16T15:59')).status).toBe('scheduled');
    expect(evaluateRecord(record(), at('2026-11-16T16:00')).status).toBe('absent');
    expect(evaluateRecord(record({ onLeave: true }), at('2026-11-16T18:00')).status).toBe('on-leave');
  });

  it('late only after the grace period; late duration counts from the scheduled start', () => {
    expect(evaluateRecord(record({ checkIn: '2026-11-16T08:10' }), at('2026-11-16T09:00'))).toMatchObject({ status: 'present', lateMinutes: 0 });
    expect(evaluateRecord(record({ checkIn: '2026-11-16T08:11' }), at('2026-11-16T09:00'))).toMatchObject({ status: 'late', lateMinutes: 11 });
    expect(evaluateRecord(record({ checkIn: '2026-11-16T07:45', checkOut: '2026-11-16T16:15' }), at('2026-11-16T17:00'))).toEqual({ status: 'present', workedMinutes: 450, lateMinutes: 0 });
  });

  it('working hours deduct the break; under half the scheduled time is a half day', () => {
    expect(evaluateRecord(record({ checkIn: '2026-11-16T08:40', checkOut: '2026-11-16T16:00' }), at('2026-11-16T17:00'))).toEqual({ status: 'late', workedMinutes: 380, lateMinutes: 40 });
    expect(evaluateRecord(record({ checkIn: '2026-11-16T08:00', checkOut: '2026-11-16T11:00' }), at('2026-11-16T17:00'))).toMatchObject({ status: 'half-day', workedMinutes: 120 });
    // A span too short to contain the break is not reduced by it.
    expect(evaluateRecord(record({ checkIn: '2026-11-16T08:00', checkOut: '2026-11-16T09:30' }), at('2026-11-16T17:00')).workedMinutes).toBe(90);
  });

  it('a missing check-out becomes "incomplete" only after the shift end + allowance', () => {
    const open = record({ checkIn: '2026-11-16T08:00' });
    expect(evaluateRecord(open, at('2026-11-16T15:00')).status).toBe('present'); // still working
    expect(evaluateRecord(open, at('2026-11-16T19:59')).status).toBe('present');
    expect(evaluateRecord(open, at('2026-11-16T20:00'))).toEqual({ status: 'incomplete', workedMinutes: null, lateMinutes: 0 });
  });

  it('overnight shifts: worked time spans midnight', () => {
    const evening = { scheduledStart: '2026-11-16T16:00', scheduledEnd: '2026-11-17T00:00', checkIn: '2026-11-16T16:05', checkOut: '2026-11-17T00:20', onLeave: false, shift: { breakMinutes: 45, graceMinutes: 10 } };
    expect(evaluateRecord(evening, at('2026-11-17T09:00'))).toEqual({ status: 'present', workedMinutes: 450, lateMinutes: 0 });
    const night = { ...evening, scheduledStart: '2026-11-16T22:00', scheduledEnd: '2026-11-17T06:00', checkIn: '2026-11-16T22:30', checkOut: '2026-11-17T06:00' };
    expect(evaluateRecord(night, at('2026-11-17T09:00'))).toEqual({ status: 'late', workedMinutes: 405, lateMinutes: 30 });
  });
});
