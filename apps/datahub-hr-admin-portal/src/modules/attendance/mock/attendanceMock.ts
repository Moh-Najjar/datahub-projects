import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { createMockStore } from '@/core/api/mock/store';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { leaveData } from '@/modules/leave/mock/leaveStore';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import { validateCreateInput, validateShiftInput, validateUpdateInput, type FieldErrors } from '@/modules/attendance/schemas/attendanceSchemas';
import {
  ATTENDANCE_STATUSES,
  type AttendanceFilters,
  type AttendanceRecord,
  type AttendanceRecordInput,
  type AttendanceReport,
  type AttendanceScope,
  type AttendanceStatus,
  type AttendanceSummary,
  type AttendanceUpdateInput,
  type CsvExport,
  type DepartmentReportRow,
  type EmployeeAttendanceHistory,
  type EmployeeReportRow,
  type MonthTotals,
  type NamedRef,
  type PunchInput,
  type RecordStatus,
  type ReportFilters,
  type Shift,
  type ShiftFilters,
  type ShiftInput,
  type ShiftSnapshot,
  type StatusCounts,
} from '@/modules/attendance/types/attendance';
import { addDays, ATTENDED, evaluateRecord, isDateTime, isOvernight, shiftWindow, shiftWorkingMinutes, toDate, toDateTime, toMs, todayIso, weekday } from '@/modules/attendance/utils/time';
import { hash, initialShiftId, prng, SHIFT_SEED, WINDOW_MONTHS, type ShiftRow } from './seed';

/*
 * SIMULATED attendance backend (in memory, reset on reload). It is part of the same simulated backend as the
 * employees and organization mocks: records reference EXISTING employee ids and resolve names through them; it
 * keeps no employee table of its own. Rules the real backend must enforce:
 *
 * - Scope: `organization` (attendance:read), `team` (attendance:read:team — departments the user manages) or
 *   `own` (attendance:read:own). Anything outside the scope → `FORBIDDEN`, lists are filtered.
 * - Writes (records, punches, shifts, assignments) need `attendance:write` → `FORBIDDEN` otherwise.
 * - Punch rules: no second check-in or check-out for a session, no check-out before check-in, no future times.
 * - Status, worked time and lateness are computed (utils/time.ts), never stored.
 * - History: each record keeps a snapshot of the employee's department/position and of the shift on that day.
 * - Leave: "On leave" comes from APPROVED requests of Leave Management (`leaveData`, the leave data layer), computed on
 *   every read — pending, rejected and cancelled requests never count, and nothing is copied into the records.
 *
 * Nothing here records real-world presence: check-ins are simulated operations.
 */

/* State ----------------------------------------------------------------------------------------------- */

interface RecordRow {
  id: string;
  employeeId: string;
  date: string;
  employee: AttendanceRecord['employee'];
  shift: ShiftSnapshot;
  scheduledStart: string;
  scheduledEnd: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string;
}

interface Assignment {
  employeeId: string;
  shiftId: string;
  /** First day the assignment applies (`YYYY-MM-DD`). */
  from: string;
}

const shifts = createMockStore<ShiftRow>(SHIFT_SEED, 'shf');
let records = new Map<string, RecordRow>();
/** Employees already considered for a date (scheduled or not), so generation happens once per employee/day. */
let considered = new Map<string, Set<string>>();
let assignments: Assignment[] = [];
let windowStart = '';

/** Restore the initial state (tests). Records are regenerated on next use, relative to the current date. */
export function resetAttendanceMock(): void {
  shifts.reset();
  records = new Map();
  considered = new Map();
  assignments = [];
  windowStart = '';
}

const now = () => Date.now();
const recordId = (date: string, employeeId: string) => `att-${date}-${employeeId}`;

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}
function forbidden(message = 'Outside your attendance scope'): never {
  throw new ApiError('FORBIDDEN', message);
}

/* Organization / employee lookups (same simulated backend) ---------------------------------------------- */

const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const position = (id: string) => orgTables.positions().find((p) => p.id === id);
const deptRef = (id: string): NamedRef => ({ id, name: department(id)?.name ?? { en: id, ar: id } });
const posRef = (id: string): NamedRef => ({ id, name: position(id)?.title ?? { en: id, ar: id } });

function topLevel(departmentId: string): string {
  let current = department(departmentId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = department(current.parentId);
  }
  return current?.id ?? departmentId;
}

/* Shifts and assignments ------------------------------------------------------------------------------- */

/** Assignments per employee (index of `assignments`, rebuilt whenever they change). */
let assignmentsByEmployee = new Map<string, Assignment[]>();

function indexAssignments() {
  assignmentsByEmployee = new Map();
  for (const a of assignments) assignmentsByEmployee.set(a.employeeId, [...(assignmentsByEmployee.get(a.employeeId) ?? []), a]);
}

function ensureAssignments() {
  if (assignments.length) return;
  assignments = employeeRecords.all().map((e) => ({ employeeId: e.id, shiftId: initialShiftId(e.id, e.departmentId), from: '2000-01-01' }));
  indexAssignments();
}

/** The assignment in force on `date` (latest `from` not after the date). */
function shiftIdOn(employeeId: string, date: string): string | undefined {
  ensureAssignments();
  let best: Assignment | undefined;
  for (const a of assignmentsByEmployee.get(employeeId) ?? []) if (a.from <= date && (!best || a.from >= best.from)) best = a;
  // Employees created after the seed get the default rule.
  return best?.shiftId ?? initialShiftId(employeeId, employeeRecords.get(employeeId)?.departmentId ?? '');
}

const currentShiftId = (employeeId: string) => shiftIdOn(employeeId, todayIso(now()));

const snapshot = (s: ShiftRow): ShiftSnapshot => ({ id: s.id, code: s.code, name: s.name, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, graceMinutes: s.graceMinutes });

/* Generation ------------------------------------------------------------------------------------------- */

/** First day of the month `WINDOW_MONTHS - 1` months before today. */
function computeWindowStart(today: string): string {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 - (WINDOW_MONTHS - 1), 1);
  return toDate(d.getTime());
}

/** Deterministic punches for one scheduled day (only those that already happened by `nowMs`). */
function generatePunches(employeeId: string, date: string, start: string, end: string, s: ShiftRow, nowMs: number) {
  const r = prng(hash(`${employeeId}|${date}`));
  const p = r();
  const startMs = toMs(start);
  const endMs = toMs(end);
  const minute = 60_000;
  let checkIn: number | null;
  let checkOut: number | null;
  // Leave is not generated here: approved leave comes from Leave Management (see materializeDate).
  if (p < 0.02) {
    checkIn = checkOut = null; // absent
  } else if (p < 0.04) {
    checkIn = startMs - Math.floor(r() * 10) * minute; // forgot to check out → incomplete
    checkOut = null;
  } else if (p < 0.055) {
    checkIn = startMs + Math.floor(r() * 5) * minute; // half day
    checkOut = startMs + (180 + Math.floor(r() * 30)) * minute;
  } else if (p < 0.145) {
    checkIn = startMs + (s.graceMinutes + 1 + Math.floor(r() * 50)) * minute; // late
    checkOut = endMs + Math.floor(r() * 30) * minute;
  } else {
    checkIn = startMs + (Math.floor(r() * (15 + s.graceMinutes)) - 15) * minute; // on time (incl. within grace)
    checkOut = endMs + Math.floor(r() * 35) * minute;
  }
  // Only what already happened: today's later punches do not exist yet.
  if (checkIn !== null && checkIn > nowMs) checkIn = checkOut = null;
  if (checkOut !== null && checkOut > nowMs) checkOut = null;
  return { checkIn: checkIn === null ? null : toDateTime(checkIn), checkOut: checkOut === null ? null : toDateTime(checkOut) };
}

/**
 * Creates the records of `dates` for employees not yet considered (eligible + scheduled that weekday). Per-employee
 * lookups (deactivation date, shift table) are computed once per call, not once per employee-day.
 */
function materialize(dates: readonly string[]) {
  const nowMs = now();
  const employees = employeeRecords.all();
  const inactiveSince = new Map(employees.filter((e) => e.status !== 'active').map((e) => [e.id, employeeRecords.inactiveSince(e.id)]));
  const shiftById = new Map(shifts.all().map((s) => [s.id, s]));
  for (const date of dates) materializeDate(date, nowMs, employees, inactiveSince, shiftById);
}

function materializeDate(date: string, nowMs: number, employees: ReturnType<typeof employeeRecords.all>, inactiveSince: Map<string, string | null>, shiftById: Map<string, ShiftRow>) {
  let seen = considered.get(date);
  if (!seen) considered.set(date, (seen = new Set()));
  if (seen.size >= employees.length) return; // everyone already considered for this day
  const day = weekday(date);
  for (const e of employees) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (e.hireDate > date) continue;
    const since = inactiveSince.get(e.id);
    if (e.status !== 'active' && (!since || date >= since)) continue; // historical records remain
    const s = shiftById.get(shiftIdOn(e.id, date) ?? '');
    if (!s || !s.workDays.includes(day)) continue;
    const { start, end } = shiftWindow(date, s);
    if (toMs(start) > nowMs + 24 * 3_600_000) continue;
    // Nobody punches in on a day of approved leave.
    const punches = leaveData.approvedOn(e.id, date) ? { checkIn: null, checkOut: null } : generatePunches(e.id, date, start, end, s, nowMs);
    const id = recordId(date, e.id);
    records.set(id, {
      id,
      employeeId: e.id,
      date,
      employee: { name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId), position: posRef(e.positionId) },
      shift: snapshot(s),
      scheduledStart: start,
      scheduledEnd: end,
      note: '',
      ...punches,
    });
  }
}

/** Every date of the data window up to today, oldest first (records exist for dates ≤ today). */
function windowDates(): string[] {
  const today = todayIso(now());
  if (!windowStart) windowStart = computeWindowStart(today);
  const dates: string[] = [];
  for (let d = windowStart; d <= today; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** All records (generated once per employee/day; new employees are picked up on the next call). */
function allRows(): RecordRow[] {
  materialize(windowDates());
  return [...records.values()];
}

/* Scope ------------------------------------------------------------------------------------------------ */

function scopeFilter(scope: AttendanceScope): (row: { employeeId: string; employee: { department: NamedRef } }) => boolean {
  if (scope.kind === 'organization') {
    if (!hasPermission(scope.role, 'attendance:read')) forbidden();
    return () => true;
  }
  if (scope.kind === 'team') {
    if (!hasPermission(scope.role, 'attendance:read:team')) forbidden();
    const units = employeeRecords.teamUnits(scope.userId);
    // Team = the department the record was made in (history stays with the department it belongs to).
    return (row) => units.has(row.employee.department.id);
  }
  if (!hasPermission(scope.role, 'attendance:read:own')) forbidden();
  const me = employeeRecords.employeeIdOf(scope.userId);
  return (row) => row.employeeId === me;
}

function requireWrite(scope: AttendanceScope) {
  if (!hasPermission(scope.role, 'attendance:write')) forbidden('attendance:write is required');
}

/** May the scope see this employee at all (current department / own record)? */
function employeeVisible(scope: AttendanceScope, employeeId: string): boolean {
  const e = employeeRecords.get(employeeId);
  if (!e) return false;
  return scopeFilter(scope)({ employeeId, employee: { department: { id: e.departmentId, name: { en: '', ar: '' } } } });
}

/* Mapping ---------------------------------------------------------------------------------------------- */

function toRecord(row: RecordRow, nowMs = now()): AttendanceRecord {
  // Approved leave (Leave Management) is looked up on every read, so approvals and cancellations show at once.
  const leaveRequestId = leaveData.approvedOn(row.employeeId, row.date);
  const full = { ...row, onLeave: leaveRequestId !== null, leaveRequestId };
  return { ...full, ...evaluateRecord(full, nowMs) };
}

const emptyCounts = (): StatusCounts => Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as StatusCounts;

function countStatuses(list: readonly AttendanceRecord[]): StatusCounts {
  const counts = emptyCounts();
  for (const r of list) counts[r.status]++;
  return counts;
}

const attended = (c: StatusCounts) => ATTENDED.reduce((sum, s) => sum + c[s], 0);
/** Attendance rate: attended / (due − on leave); records still "scheduled" are not due yet. */
function rate(c: StatusCounts): number | null {
  const due = attended(c) + c.absent;
  return due > 0 ? attended(c) / due : null;
}

/* Records ---------------------------------------------------------------------------------------------- */

function filtered(scope: AttendanceScope, f: Partial<AttendanceFilters>): AttendanceRecord[] {
  const visible = scopeFilter(scope);
  const nowMs = now();
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  return allRows()
    .filter(
      (r) =>
        visible(r) &&
        (!f.date || r.date === f.date) &&
        (!f.from || r.date >= f.from) &&
        (!f.to || r.date <= f.to) &&
        (!units || units.has(r.employee.department.id)) &&
        (!f.employeeId || r.employeeId === f.employeeId) &&
        (!f.shiftId || r.shift.id === f.shiftId),
    )
    .map((r) => toRecord(r, nowMs))
    .filter((r) => !f.status || r.status === f.status);
}

function flat(r: AttendanceRecord) {
  return { ...r, 'employee.name.en': r.employee.name.en, 'employee.name.ar': r.employee.name.ar, 'employee.employeeNumber': r.employee.employeeNumber };
}

function unflat<T extends AttendanceRecord>(page: Paginated<T & Record<string, unknown>>): Paginated<AttendanceRecord> {
  return {
    ...page,
    items: page.items.map((item) => {
      const { 'employee.name.en': _a, 'employee.name.ar': _b, 'employee.employeeNumber': _c, ...rest } = item;
      return rest as AttendanceRecord;
    }),
  };
}

export function listRecords(params: ListParams<AttendanceFilters>, scope: AttendanceScope): Paginated<AttendanceRecord> {
  const { status, ...rest } = params.filters ?? {};
  const rows = filtered(scope, { ...rest, status }).map(flat);
  return unflat(queryCollection(rows, { ...params, filters: {} }, { searchFields: ['employee.name.en', 'employee.name.ar', 'employee.employeeNumber'] }));
}

function visibleRow(id: string, scope: AttendanceScope): RecordRow {
  allRows();
  const row = records.get(id);
  if (!row) throw new ApiError('NOT_FOUND', `Attendance record ${id} not found`);
  if (!scopeFilter(scope)(row)) forbidden();
  return row;
}

export function getRecord(id: string, scope: AttendanceScope): AttendanceRecord {
  return toRecord(visibleRow(id, scope));
}

/** Punches must lie between 4 h before the scheduled start and 12 h after its end, and not in the future. */
function checkPunchTimes(row: Pick<RecordRow, 'scheduledStart' | 'scheduledEnd'>, times: { checkIn?: string | null; checkOut?: string | null }) {
  const errors: FieldErrors = {};
  const earliest = toMs(row.scheduledStart) - 4 * 3_600_000;
  const latest = toMs(row.scheduledEnd) + 12 * 3_600_000;
  for (const field of ['checkIn', 'checkOut'] as const) {
    const value = times[field];
    if (!value) continue;
    if (!isDateTime(value)) errors[field] = ['invalidDateTime'];
    else if (toMs(value) > now()) errors[field] = ['futureTime'];
    else if (toMs(value) < earliest || toMs(value) > latest) errors[field] = ['outsideShift'];
  }
  if (Object.keys(errors).length) invalid(errors);
}

export function updateRecord(id: string, input: AttendanceUpdateInput, scope: AttendanceScope): AttendanceRecord {
  requireWrite(scope);
  const row = visibleRow(id, scope);
  const format = validateUpdateInput(input);
  if (format) invalid(format);
  checkPunchTimes(row, input);
  if (leaveData.approvedOn(row.employeeId, row.date) && (input.checkIn || input.checkOut)) invalid({ checkIn: ['onLeave'] });
  const next: RecordRow = { ...row, checkIn: input.checkIn || null, checkOut: input.checkOut || null, note: input.note.trim() };
  records.set(id, next);
  return toRecord(next);
}

export function createRecord(input: AttendanceRecordInput, scope: AttendanceScope): AttendanceRecord {
  requireWrite(scope);
  const format = validateCreateInput(input);
  if (format) invalid(format);
  const e = employeeRecords.get(input.employeeId);
  if (!e) invalid({ employeeId: ['not-found'] });
  if (!employeeVisible(scope, e.id)) forbidden();
  const today = todayIso(now());
  if (input.date > today) invalid({ date: ['futureDate'] });
  windowDates();
  if (input.date < windowStart) invalid({ date: ['outsideWindow'] });
  const inactiveSince = employeeRecords.inactiveSince(e.id);
  if (e.hireDate > input.date || (e.status !== 'active' && (!inactiveSince || input.date >= inactiveSince))) invalid({ employeeId: ['notEmployed'] });
  materialize([input.date]);
  const id = recordId(input.date, e.id);
  if (records.has(id)) invalid({ date: ['duplicateRecord'] });
  const s = shifts.all().find((x) => x.id === input.shiftId);
  if (!s) invalid({ shiftId: ['not-found'] });
  if (s.status !== 'active') invalid({ shiftId: ['inactive'] });
  const { start, end } = shiftWindow(input.date, s);
  checkPunchTimes({ scheduledStart: start, scheduledEnd: end }, input);
  const row: RecordRow = {
    id,
    employeeId: e.id,
    date: input.date,
    employee: { name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId), position: posRef(e.positionId) },
    shift: snapshot(s),
    scheduledStart: start,
    scheduledEnd: end,
    checkIn: input.checkIn || null,
    checkOut: input.checkOut || null,
    note: input.note.trim(),
  };
  records.set(id, row);
  return toRecord(row);
}

/** SIMULATED check-in for a scheduled session (default time: now). */
export function checkIn({ recordId: id, time }: PunchInput, scope: AttendanceScope): AttendanceRecord {
  requireWrite(scope);
  const row = visibleRow(id, scope);
  if (leaveData.approvedOn(row.employeeId, row.date)) invalid({ time: ['onLeave'] });
  if (row.checkIn) invalid({ time: ['alreadyCheckedIn'] });
  const at = time ?? toDateTime(now());
  checkPunchTimes(row, { checkIn: at });
  const next = { ...row, checkIn: at };
  records.set(id, next);
  return toRecord(next);
}

/** SIMULATED check-out (default time: now). */
export function checkOut({ recordId: id, time }: PunchInput, scope: AttendanceScope): AttendanceRecord {
  requireWrite(scope);
  const row = visibleRow(id, scope);
  if (!row.checkIn) invalid({ time: ['notCheckedIn'] });
  if (row.checkOut) invalid({ time: ['alreadyCheckedOut'] });
  const at = time ?? toDateTime(now());
  if (isDateTime(at) && toMs(at) <= toMs(row.checkIn)) invalid({ time: ['beforeCheckIn'] });
  checkPunchTimes(row, { checkOut: at });
  const next = { ...row, checkOut: at };
  records.set(id, next);
  return toRecord(next);
}

/* Overview --------------------------------------------------------------------------------------------- */

export function summary(scope: AttendanceScope): AttendanceSummary {
  const visible = scopeFilter(scope);
  const nowMs = now();
  const today = todayIso(nowMs);
  const inScope = allRows().filter(visible).map((r) => toRecord(r, nowMs));
  const todays = inScope.filter((r) => r.date === today);
  const c = countStatuses(todays);

  // Active employees in scope (current assignment, not the historical snapshot).
  const totalEmployees = employeeRecords.all().filter((e) => e.status === 'active' && employeeVisible(scope, e.id)).length;

  const trend = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => ({ date, ...countStatuses(inScope.filter((r) => r.date === date)) }));

  const groups = new Map<string, AttendanceRecord[]>();
  for (const r of todays) {
    const top = topLevel(r.employee.department.id);
    groups.set(top, [...(groups.get(top) ?? []), r]);
  }
  const byDepartment = [...groups.entries()]
    .map(([id, list]) => {
      const counts = countStatuses(list);
      return { department: deptRef(id), scheduled: list.length, present: attended(counts), late: counts.late, absent: counts.absent, onLeave: counts['on-leave'] };
    })
    .sort((a, b) => b.scheduled - a.scheduled);

  const months = [...new Set(windowDates().map((d) => d.slice(0, 7)))];
  const monthly = months.map((month) => {
    const list = inScope.filter((r) => r.date.startsWith(month));
    const worked = list.filter((r) => r.workedMinutes !== null);
    return {
      month,
      rate: rate(countStatuses(list)),
      averageMinutes: worked.length ? Math.round(worked.reduce((s, r) => s + r.workedMinutes!, 0) / worked.length) : null,
      records: list.length,
    };
  });

  return {
    date: today,
    totalEmployees,
    scheduled: todays.length,
    present: attended(c),
    absent: c.absent,
    late: c.late,
    onLeave: c['on-leave'],
    attendanceRate: rate(c),
    today: c,
    trend,
    byDepartment,
    monthly,
  };
}

/* History ---------------------------------------------------------------------------------------------- */

function totalsOf(list: readonly AttendanceRecord[]): MonthTotals {
  const c = countStatuses(list);
  const worked = list.filter((r) => r.workedMinutes !== null);
  const totalMinutes = worked.reduce((s, r) => s + r.workedMinutes!, 0);
  return {
    workingDays: list.length - c.scheduled,
    present: attended(c),
    late: c.late,
    absent: c.absent,
    onLeave: c['on-leave'],
    halfDay: c['half-day'],
    incomplete: c.incomplete,
    totalMinutes,
    averageMinutes: worked.length ? Math.round(totalMinutes / worked.length) : null,
  };
}

/** `employeeId` may be `me`: the employee linked to the signed-in account (resolved by the backend). */
export function employeeHistory(requestedId: string, month: string | undefined, scope: AttendanceScope): EmployeeAttendanceHistory {
  const employeeId = requestedId === 'me' ? (employeeRecords.employeeIdOf(scope.userId) ?? '') : requestedId;
  const e = employeeRecords.get(employeeId);
  if (!e) throw new ApiError('NOT_FOUND', `Employee ${employeeId} not found`);
  const visible = scopeFilter(scope);
  const mine = allRows().filter((r) => r.employeeId === employeeId && visible(r));
  // Visible if the scope covers the employee now, or any of their records (e.g. history in a managed department).
  if (!employeeVisible(scope, employeeId) && mine.length === 0) forbidden();
  const availableMonths = [...new Set(windowDates().map((d) => d.slice(0, 7)))].reverse();
  const selected = month && availableMonths.includes(month) ? month : availableMonths[0]!;
  const list = mine
    .filter((r) => r.date.startsWith(selected))
    .map((r) => toRecord(r))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    employee: { id: e.id, name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId), position: posRef(e.positionId), status: e.status },
    month: selected,
    records: list,
    totals: totalsOf(list),
    availableMonths,
  };
}

/* Shifts ----------------------------------------------------------------------------------------------- */

function assignedCount(shiftId: string): number {
  ensureAssignments();
  return employeeRecords.all().filter((e) => e.status === 'active' && currentShiftId(e.id) === shiftId).length;
}

function toShift(row: ShiftRow): Shift {
  return { ...row, workDays: [...row.workDays], overnight: isOvernight(row.startTime, row.endTime), workingMinutes: shiftWorkingMinutes(row), assignedEmployees: assignedCount(row.id) };
}

/** Shifts are reference data for anyone who may read attendance beyond their own records. */
function requireShiftRead(scope: AttendanceScope) {
  if (!hasPermission(scope.role, 'attendance:read') && !hasPermission(scope.role, 'attendance:read:team')) forbidden();
}

export function listShifts(params: ListParams<ShiftFilters>, scope: AttendanceScope): Paginated<Shift> {
  requireShiftRead(scope);
  const rows = shifts.all().map((s) => ({ ...toShift(s), 'name.en': s.name.en, 'name.ar': s.name.ar }));
  const page = queryCollection(rows, params, { searchFields: ['code', 'name.en', 'name.ar'] });
  return { ...page, items: page.items.map(({ 'name.en': _a, 'name.ar': _b, ...s }) => s as Shift) };
}

export function getShift(id: string, scope: AttendanceScope): Shift {
  requireShiftRead(scope);
  return toShift(shifts.get(id));
}

export interface ShiftMember {
  employeeId: string;
  name: Localized<string>;
  employeeNumber: string;
  department: NamedRef;
  /** Effective date of the assignment. */
  from: string;
}

export function shiftMembers(id: string, scope: AttendanceScope): ShiftMember[] {
  requireShiftRead(scope);
  shifts.get(id);
  ensureAssignments();
  return employeeRecords
    .all()
    .filter((e) => e.status === 'active' && currentShiftId(e.id) === id && employeeVisible(scope, e.id))
    .map((e) => {
      const today = todayIso(now());
      const current = assignments.filter((a) => a.employeeId === e.id && a.from <= today).sort((a, b) => b.from.localeCompare(a.from))[0];
      return { employeeId: e.id, name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId), from: current?.from ?? '2000-01-01' };
    })
    .sort((a, b) => a.name.en.localeCompare(b.name.en));
}

function checkShift(input: ShiftInput, exceptId?: string) {
  const format = validateShiftInput(input);
  if (format) invalid(format);
  const code = input.code.trim().toUpperCase();
  if (shifts.all().some((s) => s.id !== exceptId && s.code === code)) invalid({ code: ['duplicate'] });
}

const shiftData = (input: ShiftInput) => ({
  code: input.code.trim().toUpperCase(),
  name: { en: input.name.en.trim(), ar: input.name.ar.trim() },
  startTime: input.startTime,
  endTime: input.endTime,
  breakMinutes: input.breakMinutes,
  graceMinutes: input.graceMinutes,
  workDays: [...new Set(input.workDays)].sort(),
});

export function createShift(input: ShiftInput, scope: AttendanceScope): Shift {
  requireWrite(scope);
  checkShift(input);
  return toShift(shifts.create({ ...shiftData(input), status: 'active', createdAt: new Date(now()).toISOString() }));
}

/** Edits apply to future records; existing records keep the shift snapshot they were created with. */
export function updateShift(id: string, input: ShiftInput, scope: AttendanceScope): Shift {
  requireWrite(scope);
  shifts.get(id);
  checkShift(input, id);
  return toShift(shifts.update(id, shiftData(input)));
}

export function updateShiftStatus(id: string, status: RecordStatus, scope: AttendanceScope): Shift {
  requireWrite(scope);
  shifts.get(id);
  if (status === 'inactive' && assignedCount(id) > 0) invalid({ status: ['shift-in-use'] });
  return toShift(shifts.update(id, { status }));
}

/** Assigns employees to a shift from `from` (default today); earlier records keep their shift. */
export function assignShift(input: { shiftId: string; employeeIds: string[]; from?: string }, scope: AttendanceScope): { assigned: number } {
  requireWrite(scope);
  const s = shifts.all().find((x) => x.id === input.shiftId);
  if (!s) throw new ApiError('NOT_FOUND', `Shift ${input.shiftId} not found`);
  if (s.status !== 'active') invalid({ shiftId: ['inactive'] });
  if (!input.employeeIds.length) invalid({ employeeIds: ['required'] });
  const today = todayIso(now());
  const from = input.from ?? today;
  if (from < today) invalid({ from: ['pastDate'] });
  ensureAssignments();
  for (const id of input.employeeIds) {
    const e = employeeRecords.get(id);
    if (!e) invalid({ employeeIds: ['not-found'] });
    if (e.status !== 'active') invalid({ employeeIds: ['inactiveEmployee'] });
    if (!employeeVisible(scope, id)) forbidden();
  }
  for (const id of new Set(input.employeeIds)) {
    assignments = assignments.filter((a) => !(a.employeeId === id && a.from >= from));
    assignments.push({ employeeId: id, shiftId: s.id, from });
    indexAssignments();
    // Not-yet-started records of the employee follow the new shift from `from` on.
    for (const [rid, row] of records) {
      if (row.employeeId === id && row.date >= from && !row.checkIn && toMs(row.scheduledStart) > now()) records.delete(rid);
    }
    for (const [date, seen] of considered) if (date >= from) seen.delete(id);
  }
  return { assigned: new Set(input.employeeIds).size };
}

/* Reports ---------------------------------------------------------------------------------------------- */

const MAX_REPORT_DAYS = 93;

function checkReportFilters(f: ReportFilters) {
  const errors: FieldErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.from)) errors.from = ['invalidDate'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.to)) errors.to = ['invalidDate'];
  if (!errors.from && !errors.to) {
    if (f.from > f.to) errors.to = ['rangeOrder'];
    else if ((toMs(f.to) - toMs(f.from)) / 86_400_000 >= MAX_REPORT_DAYS) errors.to = ['rangeTooLong'];
  }
  if (Object.keys(errors).length) invalid(errors);
}

function reportRows(f: ReportFilters, scope: AttendanceScope) {
  checkReportFilters(f);
  const base = { from: f.type === 'daily' ? f.from : f.from, to: f.type === 'daily' ? f.from : f.to, departmentId: f.departmentId || undefined };
  const list = filtered(scope, base);
  let data: AttendanceReport['data'];
  if (f.type === 'daily') data = { type: 'daily', rows: [...list].sort((a, b) => a.employee.name.en.localeCompare(b.employee.name.en)) };
  else if (f.type === 'late') data = { type: 'late', rows: list.filter((r) => r.lateMinutes > 0).sort((a, b) => b.lateMinutes - a.lateMinutes || b.date.localeCompare(a.date)) };
  else if (f.type === 'absence') data = { type: 'absence', rows: list.filter((r) => r.status === 'absent').sort((a, b) => b.date.localeCompare(a.date)) };
  else if (f.type === 'monthly') {
    const byEmployee = new Map<string, AttendanceRecord[]>();
    for (const r of list) byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
    const rows: EmployeeReportRow[] = [...byEmployee.values()].map((recs) => {
      const last = recs[recs.length - 1]!;
      return { employeeId: last.employeeId, name: last.employee.name, employeeNumber: last.employee.employeeNumber, department: last.employee.department, ...totalsOf(recs) };
    });
    data = { type: 'monthly', rows: rows.sort((a, b) => a.name.en.localeCompare(b.name.en)) };
  } else {
    const byDepartment = new Map<string, AttendanceRecord[]>();
    for (const r of list) byDepartment.set(r.employee.department.id, [...(byDepartment.get(r.employee.department.id) ?? []), r]);
    const rows: DepartmentReportRow[] = [...byDepartment.entries()].map(([id, recs]) => {
      const c = countStatuses(recs);
      return {
        department: deptRef(id),
        employees: new Set(recs.map((r) => r.employeeId)).size,
        scheduled: recs.length,
        present: attended(c),
        late: c.late,
        absent: c.absent,
        onLeave: c['on-leave'],
        rate: rate(c),
        totalMinutes: recs.reduce((s, r) => s + (r.workedMinutes ?? 0), 0),
      };
    });
    data = { type: 'department', rows: rows.sort((a, b) => a.department.name.en.localeCompare(b.department.name.en)) };
  }
  const counts = countStatuses(list);
  return { data, totals: { ...counts, records: list.length, totalMinutes: list.reduce((s, r) => s + (r.workedMinutes ?? 0), 0) } };
}

export function report(params: ListParams<ReportFilters>, scope: AttendanceScope): AttendanceReport {
  const filters = { type: 'daily', from: todayIso(now()), to: todayIso(now()), departmentId: '', ...params.filters } as ReportFilters;
  const { data, totals } = reportRows(filters, scope);
  const page = queryCollection(data.rows as unknown[], { page: params.page, pageSize: params.pageSize });
  return { filters, totals, page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages, data: { type: data.type, rows: page.items } as AttendanceReport['data'] };
}

/* CSV export ------------------------------------------------------------------------------------------- */

/** Column headings and status names of the export (the backend renders the file in the requested language). */
const CSV_TEXT = {
  en: {
    employee: 'Employee', number: 'Employee number', department: 'Department', position: 'Position', shift: 'Shift', date: 'Date', checkIn: 'Check-in', checkOut: 'Check-out',
    worked: 'Worked minutes', late: 'Late minutes', status: 'Status', workingDays: 'Working days', present: 'Present', lateDays: 'Late', absent: 'Absent', onLeave: 'On leave',
    halfDay: 'Half day', incomplete: 'Incomplete', totalMinutes: 'Total worked minutes', averageMinutes: 'Average worked minutes', employees: 'Employees', scheduled: 'Scheduled', rate: 'Attendance rate (%)',
    statuses: { present: 'Present', late: 'Late', absent: 'Absent', 'on-leave': 'On leave', 'half-day': 'Half day', incomplete: 'Incomplete', scheduled: 'Not started' },
  },
  ar: {
    employee: 'الموظف', number: 'الرقم الوظيفي', department: 'القسم', position: 'المسمى الوظيفي', shift: 'الوردية', date: 'التاريخ', checkIn: 'تسجيل الدخول', checkOut: 'تسجيل الخروج',
    worked: 'دقائق العمل', late: 'دقائق التأخير', status: 'الحالة', workingDays: 'أيام العمل', present: 'حاضر', lateDays: 'متأخر', absent: 'غائب', onLeave: 'في إجازة',
    halfDay: 'نصف يوم', incomplete: 'غير مكتمل', totalMinutes: 'إجمالي دقائق العمل', averageMinutes: 'متوسط دقائق العمل', employees: 'الموظفون', scheduled: 'المجدول', rate: 'نسبة الحضور (%)',
    statuses: { present: 'حاضر', late: 'متأخر', absent: 'غائب', 'on-leave': 'في إجازة', 'half-day': 'نصف يوم', incomplete: 'غير مكتمل', scheduled: 'لم يبدأ' },
  },
} as const;

/** One CSV cell: quoted, with formula-like values neutralised (spreadsheet injection). */
export function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportReport(filters: ReportFilters, language: 'en' | 'ar', scope: AttendanceScope): CsvExport {
  const { data } = reportRows(filters, scope);
  const t = CSV_TEXT[language];
  let header: string[];
  let lines: Array<Array<string | number | null>>;
  if (data.type === 'monthly') {
    header = [t.employee, t.number, t.department, t.workingDays, t.present, t.lateDays, t.absent, t.onLeave, t.halfDay, t.incomplete, t.totalMinutes, t.averageMinutes];
    lines = data.rows.map((r) => [r.name[language], r.employeeNumber, r.department.name[language], r.workingDays, r.present, r.late, r.absent, r.onLeave, r.halfDay, r.incomplete, r.totalMinutes, r.averageMinutes]);
  } else if (data.type === 'department') {
    header = [t.department, t.employees, t.scheduled, t.present, t.lateDays, t.absent, t.onLeave, t.rate, t.totalMinutes];
    lines = data.rows.map((r) => [r.department.name[language], r.employees, r.scheduled, r.present, r.late, r.absent, r.onLeave, r.rate === null ? null : Math.round(r.rate * 1000) / 10, r.totalMinutes]);
  } else {
    header = [t.employee, t.number, t.department, t.position, t.shift, t.date, t.checkIn, t.checkOut, t.worked, t.late, t.status];
    lines = data.rows.map((r) => [
      r.employee.name[language],
      r.employee.employeeNumber,
      r.employee.department.name[language],
      r.employee.position.name[language],
      r.shift.code,
      r.date,
      r.checkIn?.replace('T', ' ') ?? null,
      r.checkOut?.replace('T', ' ') ?? null,
      r.workedMinutes,
      r.lateMinutes,
      t.statuses[r.status as AttendanceStatus],
    ]);
  }
  const content = '﻿' + [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const range = filters.type === 'daily' ? filters.from : `${filters.from}_${filters.to}`;
  return { fileName: `attendance-${filters.type}-${range}.csv`, content, rows: lines.length };
}

/* Used by the leave mock (same simulated backend; leave → attendance, never the other way) -------------- */

export const attendanceSchedule = {
  /** Whether `date` is a working day of the employee's shift in force on that date. */
  isWorkingDay(employeeId: string, date: string): boolean {
    const s = shifts.all().find((x) => x.id === shiftIdOn(employeeId, date));
    return Boolean(s && s.workDays.includes(weekday(date)));
  },
  /** Whether a check-in is recorded for the employee on `date` (leave cannot be approved over worked days). */
  hasCheckIn(employeeId: string, date: string): boolean {
    if (date > todayIso(now())) return false;
    allRows();
    return Boolean(records.get(recordId(date, employeeId))?.checkIn);
  },
};
