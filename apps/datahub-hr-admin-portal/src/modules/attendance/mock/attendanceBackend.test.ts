import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import * as employees from '@/modules/employees/mock/employeesMock';
import { attendanceApi as api } from '@/modules/attendance/api/attendanceApi';
import type { AttendanceRecord, AttendanceScope, ShiftInput } from '@/modules/attendance/types/attendance';
import { ATTENDED } from '@/modules/attendance/utils/time';
import { csvCell, resetAttendanceMock } from './attendanceMock';

/*
 * The simulated attendance backend on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Records depend on "now",
 * so every test uses the same moment; data for a given day is deterministic.
 */
const NOW = new Date(2026, 10, 16, 10, 30);
const TODAY = '2026-11-16';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetAttendanceMock();
});
afterEach(() => vi.useRealTimers());

const users: Record<string, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
function scopeOf(role: Role): AttendanceScope {
  const kind = ['system-admin', 'hr-admin', 'hr-manager'].includes(role) ? 'organization' : role === 'department-manager' ? 'team' : 'own';
  return { kind, userId: users[role]!, role };
}
const HR = scopeOf('hr-admin');
const ALL = { page: 1, pageSize: 100 } as const;

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}
const reasons = async (promise: Promise<unknown>) => (await rejection(promise)).fieldErrors;

async function allRecords(filters: Record<string, string>, scope = HR): Promise<AttendanceRecord[]> {
  const out: AttendanceRecord[] = [];
  for (let page = 1; ; page++) {
    const p = await api.getAttendanceRecords({ page, pageSize: 100, filters }, scope);
    out.push(...p.items);
    if (page >= p.totalPages) return out;
  }
}

describe('dataset: generated for the existing employees, consistent everywhere', () => {
  it('today: summary = daily records = report totals', async () => {
    const summary = await api.getAttendanceSummary(HR);
    const today = await allRecords({ date: TODAY });
    expect(summary.date).toBe(TODAY);
    expect(summary.totalEmployees).toBe(235); // active employees (Employee Management)
    expect(summary.scheduled).toBe(today.length);
    expect(summary.present).toBe(today.filter((r) => ATTENDED.includes(r.status)).length);
    expect(summary.absent).toBe(today.filter((r) => r.status === 'absent').length);
    expect(summary.onLeave).toBe(today.filter((r) => r.status === 'on-leave').length);
    expect(summary.late).toBe(today.filter((r) => r.status === 'late').length);
    const report = await api.getAttendanceReports({ ...ALL, filters: { type: 'daily', from: TODAY, to: TODAY, departmentId: '' } }, HR);
    expect(report.totals.records).toBe(today.length);
    expect(report.totals.present + report.totals.late + report.totals['half-day'] + report.totals.incomplete).toBe(summary.present);
    expect(summary.trend.at(-1)).toMatchObject({ date: TODAY, absent: summary.absent });
    expect(summary.byDepartment.reduce((s, d) => s + d.scheduled, 0)).toBe(summary.scheduled);
    expect(summary.monthly.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
  });

  it('every record references an existing employee; the scenarios all occur', async () => {
    const records = await allRecords({ from: '2026-11-01', to: TODAY });
    const ids = new Set(employees.employeeRecords.all().map((e) => e.id));
    expect(records.every((r) => ids.has(r.employeeId))).toBe(true);
    const statuses = new Set(records.map((r) => r.status));
    for (const s of ['present', 'late', 'absent', 'on-leave', 'half-day', 'incomplete', 'scheduled'] as const) expect(statuses.has(s), s).toBe(true);
    // Overnight (Evening Shift 16:00–00:00) records end the next day.
    const evening = records.find((r) => r.shift.code === 'SHF-EVE' && r.date === '2026-11-15')!;
    expect(evening).toMatchObject({ scheduledStart: '2026-11-15T16:00', scheduledEnd: '2026-11-16T00:00' });
  });

  it('a missing check-in today is "scheduled" (shift not over), never "absent"', async () => {
    const today = await allRecords({ date: TODAY });
    for (const r of today.filter((x) => x.shift.code === 'SHF-EVE')) expect(['scheduled', 'on-leave']).toContain(r.status); // starts 16:00
    expect(today.filter((r) => r.shift.code === 'SHF-NGT' && r.status === 'scheduled')).toHaveLength(0); // 00:00–08:00 is over
  });

  it('is deterministic: the same day gives the same records', async () => {
    const first = await allRecords({ date: '2026-11-10' });
    resetAttendanceMock();
    const second = await allRecords({ date: '2026-11-10' });
    expect(second).toEqual(first);
  });

  it('no records on weekends for Sunday–Thursday shifts; weekend support works Friday–Saturday', async () => {
    const saturday = await allRecords({ date: '2026-11-14' });
    expect(saturday.length).toBeGreaterThan(0);
    expect(saturday.every((r) => r.shift.code === 'SHF-WKD')).toBe(true);
  });

  it('deactivated employees keep their history', async () => {
    const inactive = employees.employeeRecords.all().find((e) => e.status === 'inactive' && (employees.employeeRecords.inactiveSince(e.id) ?? '') > '2026-08-15')!;
    const since = employees.employeeRecords.inactiveSince(inactive.id)!;
    const theirs = await allRecords({ employeeId: inactive.id, from: '2026-08-01', to: TODAY });
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((r) => r.date < since)).toBe(true);
  });
});

describe('records: search, filters, sorting, pagination', () => {
  it('searches by name and employee number', async () => {
    const byName = await api.getAttendanceRecords({ ...ALL, search: 'dana yousef', filters: { from: '2026-11-01', to: TODAY } }, HR);
    expect(byName.items.length).toBeGreaterThan(0);
    expect(byName.items.every((r) => r.employeeId === 'emp-0001')).toBe(true);
    const byNumber = await api.getAttendanceRecords({ ...ALL, search: 'EMP-0013', filters: { date: '2026-11-12' } }, HR);
    expect(byNumber.items.map((r) => r.employeeId)).toEqual(['emp-0013']);
  });

  it('filters by department (incl. subdepartments), employee, status and shift', async () => {
    const eng = await allRecords({ date: '2026-11-12', departmentId: 'dep-eng' });
    expect(eng.every((r) => r.employee.department.id.startsWith('dep-eng'))).toBe(true);
    const late = await allRecords({ date: '2026-11-12', status: 'late' });
    expect(late.every((r) => r.status === 'late' && r.lateMinutes > 0)).toBe(true);
    const night = await allRecords({ date: '2026-11-12', shiftId: 'shf-03' });
    expect(night.length).toBeGreaterThan(0);
    expect(night.every((r) => r.shift.id === 'shf-03')).toBe(true);
  });

  it('sorts and paginates', async () => {
    const p1 = await api.getAttendanceRecords({ page: 1, pageSize: 10, sortBy: 'lateMinutes', sortDirection: 'desc', filters: { date: '2026-11-12' } }, HR);
    expect(p1.items[0]!.lateMinutes).toBeGreaterThanOrEqual(p1.items[1]!.lateMinutes);
    const p2 = await api.getAttendanceRecords({ page: 2, pageSize: 10, sortBy: 'lateMinutes', sortDirection: 'desc', filters: { date: '2026-11-12' } }, HR);
    expect(p2.page).toBe(2);
    expect(new Set([...p1.items, ...p2.items].map((r) => r.id)).size).toBe(20);
  });
});

describe('check-in and check-out (simulated)', () => {
  /** A Morning Shift (08:00–16:00) record without a check-in yet at 10:30. */
  async function pendingRecord() {
    return (await allRecords({ date: TODAY, shiftId: 'shf-01', status: 'scheduled' }))[0]!;
  }

  it('checks in once, then checks out once; duplicates and out-of-order punches are refused', async () => {
    const r = await pendingRecord();
    // "Now" is 10:30: a future time is refused, so is a time far outside the shift.
    expect(await reasons(api.checkIn({ recordId: r.id, time: '2026-11-16T10:45' }, HR))).toEqual({ checkIn: ['futureTime'] });
    expect(await reasons(api.checkIn({ recordId: r.id, time: '2026-11-16T03:00' }, HR))).toEqual({ checkIn: ['outsideShift'] });
    expect(await reasons(api.checkOut({ recordId: r.id }, HR))).toEqual({ time: ['notCheckedIn'] });
    const inRec = await api.checkIn({ recordId: r.id, time: '2026-11-16T10:20' }, HR);
    expect(inRec).toMatchObject({ checkIn: '2026-11-16T10:20', status: 'late', lateMinutes: 140, workedMinutes: null });
    expect(await reasons(api.checkIn({ recordId: r.id }, HR))).toEqual({ time: ['alreadyCheckedIn'] });
    expect(await reasons(api.checkOut({ recordId: r.id, time: '2026-11-16T10:10' }, HR))).toEqual({ time: ['beforeCheckIn'] });
    const outRec = await api.checkOut({ recordId: r.id }, HR); // now = 10:30
    expect(outRec).toMatchObject({ checkOut: '2026-11-16T10:30', workedMinutes: 10, status: 'half-day' });
    expect(await reasons(api.checkOut({ recordId: r.id }, HR))).toEqual({ time: ['alreadyCheckedOut'] });
  });

  it('refuses a check-in on a leave day', async () => {
    const leave = (await allRecords({ from: '2026-11-01', to: TODAY, status: 'on-leave' }))[0]!;
    expect(await reasons(api.checkIn({ recordId: leave.id }, HR))).toEqual({ time: ['onLeave'] });
  });

  it('incomplete records: checked in, no check-out after the shift', async () => {
    const incomplete = await allRecords({ from: '2026-11-01', to: '2026-11-13', status: 'incomplete' });
    expect(incomplete.length).toBeGreaterThan(0);
    expect(incomplete.every((r) => r.checkIn !== null && r.checkOut === null && r.workedMinutes === null)).toBe(true);
    const fixed = await api.updateAttendanceRecord(incomplete[0]!.id, { checkIn: incomplete[0]!.checkIn, checkOut: incomplete[0]!.scheduledEnd, note: 'Forgot to check out' }, HR);
    expect(fixed.status).not.toBe('incomplete');
    expect(fixed.workedMinutes).toBeGreaterThan(0);
  });

  it('manual records: validated, no duplicates, employee must be employed', async () => {
    // Saturday: Dana (Morning Shift, Sunday–Thursday) has no record.
    const created = await api.createAttendanceRecord({ employeeId: 'emp-0001', date: '2026-11-14', shiftId: 'shf-01', checkIn: '2026-11-14T08:05', checkOut: '2026-11-14T13:00', note: 'Release support' }, HR);
    expect(created).toMatchObject({ date: '2026-11-14', status: 'present', workedMinutes: 235 });
    expect(await reasons(api.createAttendanceRecord({ employeeId: 'emp-0001', date: '2026-11-14', shiftId: 'shf-01', checkIn: null, checkOut: null, note: '' }, HR))).toEqual({ date: ['duplicateRecord'] });
    expect(await reasons(api.createAttendanceRecord({ employeeId: 'emp-0001', date: '2026-11-21', shiftId: 'shf-01', checkIn: null, checkOut: null, note: '' }, HR))).toEqual({ date: ['futureDate'] });
    expect(await reasons(api.createAttendanceRecord({ employeeId: 'emp-0001', date: '2026-11-15', shiftId: 'shf-05', checkIn: null, checkOut: null, note: '' }, HR))).toMatchObject({ date: ['duplicateRecord'] });
    expect(await reasons(api.createAttendanceRecord({ employeeId: 'emp-0002', date: '2026-11-14', shiftId: 'shf-05', checkIn: null, checkOut: null, note: '' }, HR))).toEqual({ shiftId: ['inactive'] });
    expect(await reasons(api.createAttendanceRecord({ employeeId: 'emp-0002', date: '2026-11-14', shiftId: 'shf-01', checkIn: '', checkOut: '2026-11-14T12:00', note: '' }, HR))).toEqual({ checkOut: ['checkOutWithoutIn'] });
  });

  it('a department change keeps the original department on past records', async () => {
    const before = (await allRecords({ employeeId: 'emp-0050', from: '2026-11-01', to: '2026-11-12' }))[0]!;
    // Transfer the employee in Employee Management (a stored row carries every field of the update payload).
    const row = employees.employeeRecords.get('emp-0050')!;
    employees.updateEmployee('emp-0050', { ...row, departmentId: 'dep-eng-qa', positionId: 'pos-06', managerId: 'emp-0015' }, { kind: 'organization', role: 'hr-admin' });
    const after = await api.getAttendanceById(before.id, HR);
    expect(after.employee.department).toEqual(before.employee.department);
    expect((await api.getEmployeeAttendanceHistory('emp-0050', '2026-11', HR)).employee.department.id).toBe('dep-eng-qa');
  });
});

describe('shifts', () => {
  const input = (patch: Partial<ShiftInput> = {}): ShiftInput => ({
    code: 'shf-late',
    name: { en: 'Late Shift', ar: 'الوردية المتأخرة' },
    startTime: '22:00',
    endTime: '06:00',
    breakMinutes: 30,
    graceMinutes: 10,
    workDays: [0, 1, 2, 3, 4],
    ...patch,
  });

  it('lists with derived values (overnight, working time, assigned employees)', async () => {
    const page = await api.getShifts({ ...ALL, sortBy: 'code' }, HR);
    const evening = page.items.find((s) => s.code === 'SHF-EVE')!;
    expect(evening).toMatchObject({ overnight: true, workingMinutes: 435 });
    const total = page.items.reduce((s, x) => s + x.assignedEmployees, 0);
    expect(total).toBe(235); // every active employee has one shift
    expect((await api.getShifts({ ...ALL, search: 'night' }, HR)).items.map((s) => s.code)).toEqual(['SHF-NGT']);
    expect((await api.getShifts({ ...ALL, filters: { status: 'inactive' } }, HR)).items.map((s) => s.code)).toEqual(['SHF-PLT']);
  });

  it('creates (overnight) and updates; validates times, break, grace and duplicate codes', async () => {
    const created = await api.createShift(input(), HR);
    expect(created).toMatchObject({ code: 'SHF-LATE', overnight: true, workingMinutes: 450, status: 'active', assignedEmployees: 0 });
    expect(await reasons(api.createShift(input({ code: 'SHF-MOR' }), HR))).toEqual({ code: ['duplicate'] });
    expect(await reasons(api.createShift(input({ code: 'X1', endTime: '22:00' }), HR))).toEqual({ endTime: ['sameTimes'] });
    expect(await reasons(api.createShift(input({ code: 'X2', startTime: '08:00', endTime: '09:00', breakMinutes: 60, graceMinutes: 60 }), HR))).toEqual({ breakMinutes: ['breakTooLong'], graceMinutes: ['graceTooLong'] });
    expect(await reasons(api.createShift(input({ code: 'X3', startTime: '25:00', workDays: [] }), HR))).toEqual({ startTime: ['invalidTime'], workDays: ['workDaysRequired'] });
    expect((await api.updateShift(created.id, input({ graceMinutes: 20 }), HR)).graceMinutes).toBe(20);
  });

  it('cannot deactivate a shift with assigned employees; assignment moves employees from today', async () => {
    expect(await reasons(api.updateShiftStatus('shf-01', 'inactive', HR))).toEqual({ status: ['shift-in-use'] });
    const created = await api.createShift(input(), HR);
    const before = (await allRecords({ employeeId: 'emp-0002', from: '2026-11-01', to: '2026-11-12' })).map((r) => r.shift.code);
    expect(await api.assignShift({ shiftId: created.id, employeeIds: ['emp-0002'] }, HR)).toEqual({ assigned: 1 });
    expect((await api.getShiftById(created.id, HR)).assignedEmployees).toBe(1);
    expect((await api.getShiftMembers(created.id, HR)).map((m) => m.employeeId)).toEqual(['emp-0002']);
    // Past records keep the shift they were worked under.
    expect((await allRecords({ employeeId: 'emp-0002', from: '2026-11-01', to: '2026-11-12' })).map((r) => r.shift.code)).toEqual(before);
    expect(await reasons(api.assignShift({ shiftId: 'shf-05', employeeIds: ['emp-0002'] }, HR))).toEqual({ shiftId: ['inactive'] });
    expect((await api.updateShiftStatus('shf-05', 'active', HR)).status).toBe('active');
    expect((await api.updateShiftStatus('shf-05', 'inactive', HR)).status).toBe('inactive');
  });
});

describe('reports and CSV export', () => {
  const filters = (type: 'daily' | 'monthly' | 'department' | 'late' | 'absence', departmentId = '') => ({ type, from: '2026-11-01', to: '2026-11-13', departmentId });

  it('report rows agree with the records for the same range and department', async () => {
    const records = await allRecords({ from: '2026-11-01', to: '2026-11-13', departmentId: 'dep-sales' });
    const late = await api.getAttendanceReports({ ...ALL, filters: filters('late', 'dep-sales') }, HR);
    expect(late.total).toBe(records.filter((r) => r.lateMinutes > 0).length);
    const absence = await api.getAttendanceReports({ ...ALL, filters: filters('absence', 'dep-sales') }, HR);
    expect(absence.total).toBe(records.filter((r) => r.status === 'absent').length);
    const department = await api.getAttendanceReports({ ...ALL, filters: filters('department', 'dep-sales') }, HR);
    expect(department.data.type).toBe('department');
    if (department.data.type === 'department') expect(department.data.rows.reduce((s, r) => s + r.scheduled, 0)).toBe(records.length);
    const monthly = await api.getAttendanceReports({ ...ALL, filters: filters('monthly', 'dep-sales') }, HR);
    if (monthly.data.type === 'monthly') expect(monthly.data.rows.reduce((s, r) => s + r.absent, 0)).toBe(absence.total);
  });

  it('validates the date range', async () => {
    expect(await reasons(api.getAttendanceReports({ ...ALL, filters: { type: 'late', from: '2026-11-10', to: '2026-11-01', departmentId: '' } }, HR))).toEqual({ to: ['rangeOrder'] });
    expect(await reasons(api.getAttendanceReports({ ...ALL, filters: { type: 'late', from: '2026-01-01', to: '2026-11-01', departmentId: '' } }, HR))).toEqual({ to: ['rangeTooLong'] });
  });

  it('exports CSV of the whole filtered report, in the requested language, within scope', async () => {
    const csv = await api.exportAttendanceReport(filters('absence', 'dep-sales'), 'en', HR);
    const lines = csv.content.trim().split('\r\n');
    expect(csv.content.startsWith('﻿')).toBe(true);
    expect(lines[0]).toContain('"Employee","Employee number","Department"');
    expect(lines.length - 1).toBe(csv.rows);
    expect(csv.fileName).toBe('attendance-absence-2026-11-01_2026-11-13.csv');
    const ar = await api.exportAttendanceReport(filters('monthly'), 'ar', HR);
    expect(ar.content).toContain('"الرقم الوظيفي"');
    // A Department Manager's export contains only their team.
    const team = await api.exportAttendanceReport(filters('daily'), 'en', scopeOf('department-manager'));
    expect(team.content.split('\r\n').slice(1, -1).every((line) => /"(Engineering|Software Development|Mobile Development|Quality Assurance|Data & Analytics|Research Lab)"/.test(line))).toBe(true);
  });

  it('neutralises spreadsheet formulas in cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell(null)).toBe('""');
  });
});

describe('permissions and scope (enforced by the API)', () => {
  it.each(['system-admin', 'hr-admin', 'hr-manager'] as const)('%s: whole organization and writes', async (role) => {
    expect((await api.getAttendanceSummary(scopeOf(role))).totalEmployees).toBe(235);
    const r = (await allRecords({ date: TODAY, shiftId: 'shf-01', status: 'scheduled' }))[0]!;
    expect((await api.checkIn({ recordId: r.id, time: '2026-11-16T10:00' }, scopeOf(role))).checkIn).toBe('2026-11-16T10:00');
  });

  it('Department Manager: own team only, read-only', async () => {
    const team = scopeOf('department-manager');
    const records = await allRecords({ date: '2026-11-12' }, team);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.employee.department.id.startsWith('dep-eng'))).toBe(true);
    expect((await api.getAttendanceSummary(team)).totalEmployees).toBe(58);
    const outside = (await allRecords({ date: '2026-11-12', departmentId: 'dep-sales' }))[0]!;
    expect((await rejection(api.getAttendanceById(outside.id, team))).code).toBe('FORBIDDEN');
    expect((await rejection(api.getEmployeeAttendanceHistory('emp-0007', '2026-11', team))).code).toBe('FORBIDDEN');
    expect((await rejection(api.checkIn({ recordId: records[0]!.id }, team))).code).toBe('FORBIDDEN');
    expect((await rejection(api.createShift({ code: 'T', name: { en: 'T', ar: 'ت' }, startTime: '08:00', endTime: '12:00', breakMinutes: 0, graceMinutes: 0, workDays: [1] }, team))).code).toBe('FORBIDDEN');
    expect((await api.getShifts(ALL, team)).total).toBe(5); // shifts are visible reference data
  });

  it.each([
    ['employee', 'emp-0025'],
    ['payroll-officer', 'emp-0005'],
    ['recruiter', 'emp-0004'],
  ] as const)('%s: only their own attendance', async (role, employeeId) => {
    const own = scopeOf(role);
    const mine = await allRecords({ from: '2026-11-01', to: TODAY }, own);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.employeeId === employeeId)).toBe(true);
    expect((await api.getEmployeeAttendanceHistory(employeeId, '2026-11', own)).records.length).toBe(mine.length);
    expect((await rejection(api.getEmployeeAttendanceHistory('emp-0001', '2026-11', own))).code).toBe('FORBIDDEN');
    expect((await rejection(api.getShifts(ALL, own))).code).toBe('FORBIDDEN');
    expect((await rejection(api.checkIn({ recordId: mine[0]!.id }, own))).code).toBe('FORBIDDEN');
    expect((await api.getAttendanceSummary(own)).totalEmployees).toBe(1);
  });

  it('a role without any attendance permission is refused', async () => {
    // Every existing role has at least hr.attendance.view.own; a scope claiming more than the role grants fails.
    expect((await rejection(api.getAttendanceRecords(ALL, { kind: 'organization', userId: 'usr-0007', role: 'payroll-officer' }))).code).toBe('FORBIDDEN');
    expect((await rejection(api.getAttendanceRecords(ALL, { kind: 'team', userId: 'usr-0006', role: 'recruiter' }))).code).toBe('FORBIDDEN');
  });
});
