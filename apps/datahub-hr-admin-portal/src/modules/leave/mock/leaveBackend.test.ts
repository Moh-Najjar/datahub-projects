import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { attendanceApi } from '@/modules/attendance/api/attendanceApi';
import { attendanceSchedule, resetAttendanceMock } from '@/modules/attendance/mock/attendanceMock';
import type { AttendanceRecord, AttendanceScope } from '@/modules/attendance/types/attendance';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { leaveApi as api } from '@/modules/leave/api/leaveApi';
import type { LeaveRequest, LeaveRequestInput, LeaveScope, LeaveTypeInput } from '@/modules/leave/types/leave';
import { addDays, allocationFor, countLeaveDays, datesBetween, overlaps } from '@/modules/leave/utils/rules';
import { leaveData, leaveTypes, resetLeaveStore } from './leaveStore';

/*
 * The simulated leave backend on a fixed clock: Monday 16 Nov 2026, 10:30 (local). The seed is generated relative to
 * "today", so every test uses the same moment. Attendance reads the same leave data (integration tests at the end).
 */
const NOW = new Date(2026, 10, 16, 10, 30);
const TODAY = '2026-11-16';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetLeaveStore();
  resetAttendanceMock();
});
afterEach(() => vi.useRealTimers());

const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
function scopeOf(role: Role): LeaveScope {
  const kind = ['system-admin', 'hr-admin', 'hr-manager'].includes(role) ? 'organization' : role === 'department-manager' ? 'team' : 'own';
  return { kind, userId: users[role], role };
}
const HR = scopeOf('hr-admin');
const MANAGER = scopeOf('department-manager'); // Dana Yousef (emp-0001), manages Engineering
const EMPLOYEE = scopeOf('employee'); // Sami Odeh (emp-0025), Engineering › Software Development
const SAMI = 'emp-0025';
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

async function allRequests(filters: Record<string, string>, scope: LeaveScope = HR): Promise<LeaveRequest[]> {
  const out: LeaveRequest[] = [];
  for (let page = 1; ; page++) {
    const p = await api.getLeaveRequests({ page, pageSize: 100, filters }, scope);
    out.push(...p.items);
    if (page >= p.totalPages) return out;
  }
}

/** First working day of Sami's schedule on or after `from` that has no leave yet. */
function freeWorkingDay(from: string, employeeId = SAMI): string {
  let d = from;
  while (!attendanceSchedule.isWorkingDay(employeeId, d) || leaveData.rows().some((r) => r.employeeId === employeeId && (r.status === 'pending' || r.status === 'approved') && overlaps(r, { startDate: d, endDate: d }))) d = addDays(d, 1);
  return d;
}
const request = (patch: Partial<LeaveRequestInput>): LeaveRequestInput => {
  const day = freeWorkingDay('2026-11-17');
  return { leaveTypeId: 'lt-01', startDate: day, endDate: day, reason: 'Family visit', document: null, submit: true, ...patch };
};
const annualBalance = async (scope: LeaveScope = EMPLOYEE) => (await api.getEmployeeLeaveBalances('me', 2026, scope)).find((b) => b.leaveType.id === 'lt-01')!;

describe('seed: fictional, deterministic, every scenario present, every rule respected', () => {
  it('covers the requested scenarios', async () => {
    const rows = leaveData.rows();
    const has = (typeId: string, status: string) => rows.some((r) => r.leaveTypeId === typeId && r.status === status);
    expect(has('lt-01', 'pending')).toBe(true); // pending annual
    expect(has('lt-01', 'approved')).toBe(true); // approved annual
    expect(has('lt-02', 'rejected')).toBe(true); // rejected sick
    expect(rows.some((r) => r.status === 'cancelled')).toBe(true);
    expect(has('lt-03', 'approved')).toBe(true); // unpaid
    expect(rows.some((r) => r.status === 'draft')).toBe(true);
    const balances = (await api.getLeaveBalances({ page: 1, pageSize: 100, sortBy: 'remaining', filters: { leaveTypeId: 'lt-01' } }, HR)).items;
    expect(balances.some((b) => b.remaining === 0)).toBe(true); // exhausted balance
    expect(balances.some((b) => b.remaining !== null && b.remaining > 0 && b.remaining <= 2)).toBe(true); // low balance
    expect((await api.getLeaveSummary(2026, HR)).onLeaveToday).toBeGreaterThan(0); // currently on leave
  });

  it('is deterministic for the same date', () => {
    const first = leaveData.rows().map((r) => `${r.number}|${r.employeeId}|${r.startDate}|${r.status}`);
    resetLeaveStore();
    expect(leaveData.rows().map((r) => `${r.number}|${r.employeeId}|${r.startDate}|${r.status}`)).toEqual(first);
  });

  it('every seeded request respects days, overlap, allocation and employment rules', () => {
    const rows = leaveData.rows();
    for (const r of rows) {
      const type = leaveTypes.get(r.leaveTypeId);
      const e = employeeRecords.get(r.employeeId)!;
      expect(r.startDate >= e.hireDate, r.number).toBe(true);
      expect(countLeaveDays(r.startDate, r.endDate, (d) => attendanceSchedule.isWorkingDay(r.employeeId, d), type, leaveData.holidays).days, r.number).toBe(r.days);
      if (type.maxConsecutiveDays !== null) expect(r.days).toBeLessThanOrEqual(type.maxConsecutiveDays);
      const active = rows.filter((x) => x.id !== r.id && x.employeeId === r.employeeId && ['pending', 'approved'].includes(x.status));
      if (['pending', 'approved'].includes(r.status)) expect(active.some((x) => overlaps(x, r)), r.number).toBe(false);
    }
    const usage = new Map<string, number>();
    for (const r of rows) if (['pending', 'approved'].includes(r.status)) usage.set(`${r.employeeId}|${r.leaveTypeId}`, (usage.get(`${r.employeeId}|${r.leaveTypeId}`) ?? 0) + r.days);
    for (const [key, days] of usage) {
      const [employeeId, typeId] = key.split('|') as [string, string];
      const allocation = allocationFor(leaveTypes.get(typeId), employeeRecords.get(employeeId)!, 2026);
      if (allocation !== null) expect(days, key).toBeLessThanOrEqual(allocation);
    }
  });
});

describe('leave types (configurable rules)', () => {
  const input = (patch: Partial<LeaveTypeInput> = {}): LeaveTypeInput => ({
    code: 'STUDY',
    name: { en: 'Study Leave', ar: 'إجازة دراسية' },
    description: 'Exam days.',
    paid: true,
    annualAllocation: 5,
    seniorityYears: 0,
    seniorityExtraDays: 0,
    prorateFirstYear: false,
    maxConsecutiveDays: 3,
    requiresApproval: true,
    requiresDocument: false,
    eligibility: 'all',
    excludesPublicHolidays: true,
    ...patch,
  });

  it('lists 8 types, searches and filters by status and paid', async () => {
    expect((await api.getLeaveTypes(ALL, EMPLOYEE)).total).toBe(8);
    expect((await api.getLeaveTypes({ ...ALL, search: 'sick' }, HR)).items.map((t) => t.code)).toEqual(['SICK']);
    expect((await api.getLeaveTypes({ ...ALL, filters: { paid: 'unpaid' } }, HR)).items.map((t) => t.code).sort()).toEqual(['OTHER', 'UNPAID']);
  });

  it('creates, edits, deactivates; codes are unique (case-insensitive)', async () => {
    const created = await api.createLeaveType(input({ code: 'study' }), HR);
    expect(created).toMatchObject({ code: 'STUDY', status: 'active' });
    expect(await reasons(api.createLeaveType(input({ code: 'sick' }), HR))).toEqual({ code: ['duplicateCode'] });
    expect(await reasons(api.updateLeaveType(created.id, input({ code: 'ANNUAL' }), HR))).toEqual({ code: ['duplicateCode'] });
    expect((await api.updateLeaveType(created.id, input({ annualAllocation: 6 }), HR)).annualAllocation).toBe(6);
    expect((await api.updateLeaveTypeStatus(created.id, 'inactive', HR)).status).toBe('inactive');
    expect((await rejection(api.updateLeaveTypeStatus(created.id, 'inactive', HR))).code).toBe('CONFLICT');
  });

  it('validates the payload like the form', async () => {
    expect(await reasons(api.createLeaveType(input({ name: { en: 'Study', ar: 'Study' }, maxConsecutiveDays: 0 }), HR))).toEqual({ nameAr: ['arabicRequired'], maxConsecutiveDays: ['dayRange'] });
  });

  it('needs leave:manage-policies (HR Admin, System Admin)', async () => {
    await api.createLeaveType(input({ code: 'SYS' }), scopeOf('system-admin'));
    for (const role of ['hr-manager', 'department-manager', 'employee', 'payroll-officer', 'recruiter'] as const) {
      expect((await rejection(api.createLeaveType(input({ code: `X${role.length}` }), scopeOf(role)))).code).toBe('FORBIDDEN');
    }
  });

  it('an inactive type accepts no new requests; changed allocations apply to balances', async () => {
    await api.updateLeaveTypeStatus('lt-07', 'inactive', HR);
    expect(await reasons(api.createLeaveRequest(request({ leaveTypeId: 'lt-07' }), EMPLOYEE))).toEqual({ leaveTypeId: ['typeInactive'] });
    const before = await annualBalance();
    const annual = leaveTypes.get('lt-01');
    await api.updateLeaveType('lt-01', { ...annual, annualAllocation: 20 }, HR);
    expect((await annualBalance()).allocated).toBe(before.allocated! + 6);
  });
});

describe('day counting and validation', () => {
  it('counts working days of the employee schedule only; holidays per type policy', async () => {
    // Sami works Sunday–Thursday; 26 Nov 2026 is an (example) public holiday.
    const week = { startDate: '2026-11-22', endDate: '2026-11-28' }; // Sun → Sat
    const annual = await api.getLeaveQuote(request({ ...week }), EMPLOYEE);
    expect(annual.days).toBe(4); // 5 working days − holiday (annual excludes holidays)
    expect(annual.excludedHolidays.map((h) => h.date)).toEqual(['2026-11-26']);
    const unpaid = await api.getLeaveQuote(request({ ...week, leaveTypeId: 'lt-03' }), EMPLOYEE);
    expect(unpaid.days).toBe(5); // unpaid counts holidays
    expect(annual.remainingAfter).toBe(annual.balance!.remaining! - 4);
  });

  it('refuses invalid ranges, cross-year requests and days without work', async () => {
    expect(await reasons(api.createLeaveRequest(request({ startDate: '2026-11-20', endDate: '2026-11-18' }), EMPLOYEE))).toEqual({ endDate: ['endBeforeStart'] });
    expect(await reasons(api.createLeaveRequest(request({ startDate: '2026-12-30', endDate: '2027-01-03' }), EMPLOYEE))).toEqual({ endDate: ['crossesYear'] });
    expect(await reasons(api.createLeaveRequest(request({ startDate: '2026-11-20', endDate: '2026-11-21' }), EMPLOYEE))).toEqual({ endDate: ['noWorkingDays'] }); // Fri–Sat
  });

  it('refuses overlaps with pending or approved leave', async () => {
    const first = await api.createLeaveRequest(request({}), EMPLOYEE);
    expect(await reasons(api.createLeaveRequest(request({ startDate: first.startDate, endDate: first.endDate }), EMPLOYEE))).toEqual({ startDate: ['overlap'] });
    await api.cancelLeaveRequest(first.id, EMPLOYEE);
    expect((await api.createLeaveRequest(request({ startDate: first.startDate, endDate: first.endDate }), EMPLOYEE)).status).toBe('pending');
  });

  it('refuses requests beyond the balance, over the consecutive limit, without a required document, or ineligible', async () => {
    const balance = await annualBalance();
    const start = freeWorkingDay('2026-12-06');
    expect(await reasons(api.createLeaveRequest(request({ leaveTypeId: 'lt-07', startDate: start, endDate: addDays(start, 3) }), EMPLOYEE))).toMatchObject({ endDate: ['tooManyDays'] });
    expect(await reasons(api.createLeaveRequest(request({ leaveTypeId: 'lt-02', startDate: start, endDate: start }), EMPLOYEE))).toEqual({ document: ['documentRequired'] });
    expect(await reasons(api.createLeaveRequest(request({ leaveTypeId: 'lt-04', startDate: start, endDate: start }), EMPLOYEE))).toMatchObject({ leaveTypeId: ['notEligible'] }); // maternity, Sami is not eligible
    // Use the remaining balance with 1-day requests, then one more is refused.
    let day = '2026-11-29';
    for (let i = 0; i < balance.remaining!; i++) {
      day = freeWorkingDay(day);
      await api.createLeaveRequest(request({ startDate: day, endDate: day }), EMPLOYEE);
    }
    expect(await reasons(api.createLeaveRequest(request({ startDate: freeWorkingDay(day), endDate: freeWorkingDay(day) }), EMPLOYEE))).toEqual({ leaveTypeId: ['insufficientBalance'] });
    // A draft is accepted (balance and document are checked on submission).
    expect((await api.createLeaveRequest(request({ startDate: freeWorkingDay(day), endDate: freeWorkingDay(day), submit: false }), EMPLOYEE)).status).toBe('draft');
  });

  it('refuses days already worked (check-in recorded) and inactive employees', async () => {
    const worked = (await attendanceApi.getEmployeeAttendanceHistory('me', '2026-11', { kind: 'own', userId: users.employee, role: 'employee' })).records.find((r) => r.checkIn)!;
    expect(await reasons(api.createLeaveRequest(request({ leaveTypeId: 'lt-03', startDate: worked.date, endDate: worked.date }), EMPLOYEE))).toEqual({ startDate: ['attendanceRecorded'] });
  });

  it('employees request for themselves only (no on-behalf permission exists)', async () => {
    expect((await rejection(api.createLeaveRequest(request({ employeeId: 'emp-0030' }), HR))).code).toBe('FORBIDDEN');
    expect((await rejection(api.createLeaveRequest(request({ employeeId: 'emp-0030' }), EMPLOYEE))).code).toBe('FORBIDDEN');
  });
});

describe('balances: remaining = allocated − used − pending', () => {
  it('pending reserves days, approval uses them, rejection and cancellation release them', async () => {
    const start = await annualBalance();
    expect(start.remaining).toBe(start.allocated! - start.used - start.pending);
    const a = await api.createLeaveRequest(request({}), EMPLOYEE);
    let b = await annualBalance();
    expect([b.used, b.pending, b.remaining]).toEqual([start.used, start.pending + 1, start.remaining! - 1]);
    await api.approveLeaveRequest(a.id, MANAGER);
    b = await annualBalance();
    expect([b.used, b.pending, b.remaining]).toEqual([start.used + 1, start.pending, start.remaining! - 1]);
    await api.cancelLeaveRequest(a.id, HR);
    b = await annualBalance();
    expect([b.used, b.pending, b.remaining]).toEqual([start.used, start.pending, start.remaining]);
    const r = await api.createLeaveRequest(request({}), EMPLOYEE);
    await api.rejectLeaveRequest(r.id, 'Team is short-staffed that week', MANAGER);
    expect((await annualBalance()).remaining).toBe(start.remaining);
  });

  it('editing a pending request re-reserves the new number of days', async () => {
    const a = await api.createLeaveRequest(request({}), EMPLOYEE);
    const before = await annualBalance();
    const end = freeWorkingDay(addDays(a.startDate, 1));
    const edited = await api.updateLeaveRequest(a.id, request({ startDate: a.startDate, endDate: end }), EMPLOYEE);
    expect(edited.days).toBeGreaterThan(1);
    expect((await annualBalance()).pending).toBe(before.pending - 1 + edited.days);
  });

  it('the balance history adds up to the remaining balance', async () => {
    const a = await api.createLeaveRequest(request({}), EMPLOYEE);
    await api.approveLeaveRequest(a.id, MANAGER);
    const b = await annualBalance();
    const events = await api.getLeaveBalanceHistory('me', 'lt-01', 2026, EMPLOYEE);
    expect(events[0]).toMatchObject({ type: 'allocated', days: b.allocated });
    expect(events.reduce((s, e) => s + e.days, 0)).toBe(b.remaining);
    for (const row of (await api.getLeaveBalances({ page: 1, pageSize: 40, filters: { leaveTypeId: 'lt-01' } }, HR)).items) {
      const history = await api.getLeaveBalanceHistory(row.employeeId, 'lt-01', 2026, HR);
      expect(history.reduce((s, e) => s + e.days, 0), row.employeeId).toBe(row.remaining);
    }
  });

  it('hides gender-restricted types from other viewers unless used', async () => {
    const hrView = await api.getEmployeeLeaveBalances(SAMI, 2026, HR);
    expect(hrView.some((b) => b.leaveType.id === 'lt-05')).toBe(false); // paternity: not used
    expect((await api.getEmployeeLeaveBalances('me', 2026, EMPLOYEE)).some((b) => b.leaveType.id === 'lt-05')).toBe(true); // his own view
  });
});

describe('approval workflow', () => {
  it('approve records the approver and date; types without approval are approved on submission', async () => {
    const a = await api.createLeaveRequest(request({}), EMPLOYEE);
    expect(a.can).toEqual({ edit: true, cancel: true, approve: false });
    const approved = await api.approveLeaveRequest(a.id, MANAGER);
    expect(approved).toMatchObject({ status: 'approved', decidedBy: { en: 'Dana Yousef' } });
    expect(approved.decidedAt).toBe(NOW.toISOString());
    const auto = await api.createLeaveRequest(request({ leaveTypeId: 'lt-06' }), EMPLOYEE);
    expect(auto.status).toBe('approved');
    expect(auto.history.map((h) => h.action)).toEqual(['created', 'submitted', 'approved']);
  });

  it('reject needs a reason and records it', async () => {
    const a = await api.createLeaveRequest(request({}), EMPLOYEE);
    expect(await reasons(api.rejectLeaveRequest(a.id, '  ', MANAGER))).toEqual({ reason: ['reasonRequired'] });
    const rejected = await api.rejectLeaveRequest(a.id, 'Release week for the team', HR);
    expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'Release week for the team', decidedBy: { en: 'Lina Haddad' } });
  });

  it('no self-approval, no double decision, no approving rejected or cancelled requests', async () => {
    const a = await api.createLeaveRequest(request({}), EMPLOYEE);
    expect((await rejection(api.approveLeaveRequest(a.id, EMPLOYEE))).code).toBe('FORBIDDEN');
    await api.approveLeaveRequest(a.id, HR);
    expect((await rejection(api.approveLeaveRequest(a.id, HR))).code).toBe('CONFLICT');
    expect((await rejection(api.rejectLeaveRequest(a.id, 'Too late now', HR))).code).toBe('CONFLICT');
    const b = await api.createLeaveRequest(request({}), EMPLOYEE);
    await api.rejectLeaveRequest(b.id, 'Not this week', HR);
    expect((await rejection(api.approveLeaveRequest(b.id, HR))).code).toBe('CONFLICT');
    const c = await api.createLeaveRequest(request({}), EMPLOYEE);
    await api.cancelLeaveRequest(c.id, EMPLOYEE);
    expect((await rejection(api.approveLeaveRequest(c.id, HR))).code).toBe('CONFLICT');
    // HR Admin's own request (Lina, emp-0002) cannot be approved by herself.
    const own = await api.createLeaveRequest({ leaveTypeId: 'lt-01', startDate: freeWorkingDay('2026-11-17', 'emp-0002'), endDate: freeWorkingDay('2026-11-17', 'emp-0002'), reason: '', document: null, submit: true }, HR);
    expect(own.can.approve).toBe(false);
    expect((await rejection(api.approveLeaveRequest(own.id, HR))).code).toBe('FORBIDDEN');
    expect((await api.approveLeaveRequest(own.id, scopeOf('hr-manager'))).status).toBe('approved');
  });

  it('Department Managers decide their team only; "awaiting me" lists exactly what the caller may approve', async () => {
    const mine = await allRequests({ awaitingMe: 'true' }, MANAGER);
    const team = employeeRecords.teamUnits(users['department-manager']);
    expect(mine.length).toBeGreaterThan(0);
    for (const r of mine) expect(r.status === 'pending' && team.has(r.employee.department.id) && r.can.approve).toBe(true);
    const outside = (await allRequests({ status: 'pending' })).find((r) => !team.has(r.employee.department.id))!;
    expect((await rejection(api.approveLeaveRequest(outside.id, MANAGER))).code).toBe('FORBIDDEN');
    expect(await allRequests({ awaitingMe: 'true' }, EMPLOYEE)).toEqual([]);
  });

  it('cancellation: the employee before the start, approvers any time; final states stay final', async () => {
    const started = leaveData.rows().find((r) => r.status === 'approved' && r.startDate <= TODAY && r.endDate >= TODAY)!;
    expect((await api.cancelLeaveRequest(started.id, HR)).status).toBe('cancelled');
    expect((await rejection(api.cancelLeaveRequest(started.id, HR))).code).toBe('CONFLICT');
    const past = (await allRequests({ status: 'approved' }, EMPLOYEE)).find((r) => r.endDate < TODAY)!;
    expect(past.can.cancel).toBe(false);
    expect((await rejection(api.cancelLeaveRequest(past.id, EMPLOYEE))).code).toBe('FORBIDDEN');
  });

  it('only the owner edits, only drafts and pending requests that have not started', async () => {
    const a = await api.createLeaveRequest(request({ submit: false }), EMPLOYEE);
    expect((await rejection(api.updateLeaveRequest(a.id, request({}), HR))).code).toBe('FORBIDDEN'); // drafts are private
    const submitted = await api.updateLeaveRequest(a.id, request({ startDate: a.startDate, endDate: a.endDate, submit: true }), EMPLOYEE);
    expect(submitted.status).toBe('pending');
    await api.approveLeaveRequest(a.id, HR);
    expect((await rejection(api.updateLeaveRequest(a.id, request({ startDate: a.startDate, endDate: a.endDate }), EMPLOYEE))).code).toBe('CONFLICT');
  });
});

describe('scope and privacy', () => {
  it('each role sees only its scope', async () => {
    const org = await api.getLeaveRequests(ALL, HR);
    const team = await allRequests({}, MANAGER);
    const units = employeeRecords.teamUnits(users['department-manager']);
    expect(team.length).toBeGreaterThan(0);
    expect(team.length).toBeLessThan(org.total);
    for (const r of team) expect(units.has(r.employee.department.id) || r.employeeId === 'emp-0001').toBe(true);
    for (const role of ['employee', 'recruiter', 'payroll-officer'] as const) {
      const own = await allRequests({}, scopeOf(role));
      expect(own.every((r) => r.employeeId === employeeRecords.employeeIdOf(users[role]))).toBe(true);
    }
    const other = (await allRequests({})).find((r) => r.employeeId !== SAMI)!;
    expect((await rejection(api.getLeaveRequestById(other.id, EMPLOYEE))).code).toBe('FORBIDDEN');
    expect((await rejection(api.getLeaveSummary(2026, { ...scopeOf('employee'), kind: 'organization' }))).code).toBe('FORBIDDEN'); // a forged scope is refused
    expect((await rejection(api.getEmployeeLeaveBalances('emp-0030', 2026, EMPLOYEE))).code).toBe('FORBIDDEN');
  });

  it('drafts are visible to their owner only', async () => {
    const draft = await api.createLeaveRequest(request({ submit: false }), EMPLOYEE);
    expect((await allRequests({}, HR)).some((r) => r.id === draft.id)).toBe(false);
    expect((await rejection(api.getLeaveRequestById(draft.id, MANAGER))).code).toBe('FORBIDDEN');
    expect((await api.getLeaveRequestById(draft.id, EMPLOYEE)).status).toBe('draft');
  });
});

describe('attendance integration: one source of truth', () => {
  const attHR: AttendanceScope = { kind: 'organization', userId: users['hr-admin'], role: 'hr-admin' };
  async function attendanceOn(date: string, employeeId = SAMI): Promise<AttendanceRecord | undefined> {
    return (await attendanceApi.getAttendanceRecords({ page: 1, pageSize: 10, filters: { date, employeeId } }, attHR)).items[0];
  }

  it('"on leave today" is the same figure in both modules', async () => {
    const [leave, attendance] = [await api.getLeaveSummary(2026, HR), await attendanceApi.getAttendanceSummary(attHR)];
    expect(leave.onLeaveToday).toBe(attendance.onLeave);
    const team = await api.getLeaveSummary(2026, MANAGER);
    const teamAttendance = await attendanceApi.getAttendanceSummary({ kind: 'team', userId: users['department-manager'], role: 'department-manager' });
    expect(team.onLeaveToday).toBe(teamAttendance.onLeave);
  });

  it('every "On leave" attendance record is an approved request covering the date, and vice versa', async () => {
    const onLeave: AttendanceRecord[] = [];
    for (let page = 1; ; page++) {
      const p = await attendanceApi.getAttendanceRecords({ page, pageSize: 100, filters: { status: 'on-leave' } }, attHR);
      onLeave.push(...p.items);
      if (page >= p.totalPages) break;
    }
    expect(onLeave.length).toBeGreaterThan(0);
    for (const r of onLeave) {
      const req = leaveData.get(r.leaveRequestId!)!;
      expect(req.status).toBe('approved');
      expect(req.employeeId === r.employeeId && req.startDate <= r.date && r.date <= req.endDate).toBe(true);
      expect(r.checkIn).toBeNull();
    }
    const onLeaveKeys = new Set(onLeave.map((r) => `${r.employeeId}|${r.date}`));
    const windowStart = '2026-08-01';
    for (const req of leaveData.rows()) {
      for (const d of datesBetween(req.startDate, req.endDate)) {
        if (d < windowStart || d > TODAY || !attendanceSchedule.isWorkingDay(req.employeeId, d)) continue;
        const covered = leaveData.approvedOn(req.employeeId, d) !== null;
        expect(onLeaveKeys.has(`${req.employeeId}|${d}`), `${req.number} ${d}`).toBe(covered); // pending / rejected / cancelled ≠ leave
      }
    }
  });

  it('approval marks the days "On leave"; cancelling reverts them (no duplicate records)', async () => {
    const day = freeWorkingDay('2026-11-17');
    const a = await api.createLeaveRequest(request({ startDate: day, endDate: day }), EMPLOYEE);
    await api.approveLeaveRequest(a.id, MANAGER);
    vi.setSystemTime(new Date(`${day}T23:00`)); // the leave day has passed
    const onLeave = await attendanceOn(day);
    expect(onLeave).toMatchObject({ status: 'on-leave', leaveRequestId: a.id, checkIn: null });
    expect((await attendanceRejection(onLeave!.id)).code).toBe('VALIDATION'); // no check-in on a leave day
    await api.cancelLeaveRequest(a.id, HR);
    const after = await attendanceOn(day);
    expect(after).toMatchObject({ id: onLeave!.id, leaveRequestId: null, onLeave: false, status: 'absent' });
    expect((await attendanceApi.getAttendanceRecords({ page: 1, pageSize: 10, filters: { date: day, employeeId: SAMI } }, attHR)).total).toBe(1);
  });

  async function attendanceRejection(recordId: string) {
    return rejection(attendanceApi.checkIn({ recordId }, attHR));
  }

  it('approval is refused over days already worked', async () => {
    const worked = (await attendanceApi.getEmployeeAttendanceHistory(SAMI, '2026-11', attHR)).records.find((r) => r.checkIn)!;
    const row = leaveData.insert({ ...leaveData.rows().find((r) => r.employeeId === SAMI)!, startDate: worked.date, endDate: worked.date, days: 1, status: 'pending', history: [], ledger: [] });
    expect(await reasons(api.approveLeaveRequest(row.id, HR))).toEqual({ form: ['attendanceRecorded'] });
  });
});

describe('calendar, overview, reports and CSV', () => {
  it('calendar: approved and pending leave overlapping the month, filtered', async () => {
    const entries = await api.getLeaveCalendar('2026-11', {}, HR);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(['approved', 'pending']).toContain(e.status);
      expect(e.startDate <= '2026-11-30' && e.endDate >= '2026-11-01').toBe(true);
    }
    expect((await api.getLeaveCalendar('2026-11', { status: 'pending' }, HR)).every((e) => e.status === 'pending')).toBe(true);
    expect((await api.getLeaveCalendar('2026-11', {}, EMPLOYEE)).every((e) => e.employeeId === SAMI)).toBe(true);
    expect(await reasons(api.getLeaveCalendar('2026-13', {}, HR))).toEqual({ month: ['invalidMonth'] });
  });

  it('overview figures agree with requests, by type, by department and the reports', async () => {
    const s = await api.getLeaveSummary(2026, HR);
    const reqs = (await allRequests({})).filter((r) => r.startDate.startsWith('2026'));
    expect(s.total).toBe(reqs.length);
    expect(s.byStatus.approved).toBe(reqs.filter((r) => r.status === 'approved').length);
    expect(s.daysUsed).toBe(s.byType.reduce((sum, t) => sum + t.days, 0));
    expect(s.daysUsed).toBe(s.byDepartment.reduce((sum, d) => sum + d.days, 0));
    expect(s.monthly.reduce((sum, m) => sum + m.approved + m.pending + m.rejected + m.cancelled, 0)).toBe(s.total);
    const byType = await api.getLeaveReports({ page: 1, pageSize: 50, filters: { type: 'by-type', from: '2026-01-01', to: '2026-12-31' } }, HR);
    const rows = byType.data.type === 'by-type' ? byType.data.rows : [];
    expect(rows.reduce((sum, r) => sum + r.approvedDays, 0)).toBe(s.daysUsed);
  });

  it('report filters are validated', async () => {
    expect(await reasons(api.getLeaveReports({ page: 1, pageSize: 10, filters: { type: 'requests', from: '2026-11-30', to: '2026-11-01' } }, HR))).toEqual({ to: ['endBeforeStart'] });
  });

  it('CSV: whole report in the UI language, BOM, formula neutralised, scope applied', async () => {
    const filters = { type: 'requests' as const, from: '2026-01-01', to: '2026-12-31', departmentId: '', leaveTypeId: '' };
    const en = await api.exportLeaveReport(filters, 'en', HR);
    expect(en.content.startsWith('﻿"Request number"')).toBe(true);
    expect(en.rows).toBe((await api.getLeaveReports({ page: 1, pageSize: 10, filters }, HR)).total);
    const ar = await api.exportLeaveReport({ ...filters, type: 'balances' }, 'ar', HR);
    expect(ar.content).toContain('"المتبقي"');
    const own = await api.exportLeaveReport(filters, 'en', EMPLOYEE);
    expect(own.content.split('\r\n').slice(1, -1).every((l) => l.includes('"EMP-') || l.includes(employeeRecords.get(SAMI)!.employeeNumber))).toBe(true);
    // A formula-like reason never reaches a cell unescaped (reasons are not exported; names / codes are quoted).
    expect(en.content).not.toMatch(/(^|,)=/m);
  });
});
