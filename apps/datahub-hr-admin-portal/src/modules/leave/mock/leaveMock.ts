import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { attendanceSchedule, csvCell } from '@/modules/attendance/mock/attendanceMock';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import { validateLeaveTypeInput, validateRejectReason, validateRequestInput, type FieldErrors } from '@/modules/leave/schemas/leaveSchemas';
import {
  LEAVE_STATUSES,
  type BalanceEvent,
  type CalendarEntry,
  type CsvExport,
  type LeaveBalance,
  type LeaveBalanceFilters,
  type LeaveQuote,
  type LeaveReport,
  type LeaveReportFilters,
  type LeaveReportRows,
  type LeaveRequest,
  type LeaveRequestFilters,
  type LeaveRequestInput,
  type LeaveScope,
  type LeaveStatus,
  type LeaveSummary,
  type LeaveType,
  type LeaveTypeFilters,
  type LeaveTypeInput,
  type NamedRef,
  type RecordStatus,
  type UsageRow,
} from '@/modules/leave/types/leave';
import { addDays, allocationFor, countLeaveDays, isDate, isEligible, overlaps } from '@/modules/leave/utils/rules';
import { employeeSnapshot, leaveData, leaveTypes, todayIso, type LedgerEntry, type LeaveRow } from './leaveStore';

/*
 * SIMULATED leave backend — the RULES layer (in memory, reset on reload). Data lives in `leaveStore.ts`; this file
 * reads the attendance mock for each employee's working days and recorded check-ins (one-way: leave → attendance).
 * Rules the real backend must enforce:
 *
 * - Scope: `organization` (hr.leave.view), `team` (hr.leave.view.team — the departments the user manages, plus their own
 *   requests) or `own` (hr.leave.view.own). Outside the scope → `FORBIDDEN`; lists are filtered. Drafts are visible to
 *   their owner only. Reasons and documents are returned only to the requester and to whoever may decide the request.
 * - Requests: employees submit for THEMSELVES only (`hr.leave.request`; the matrix has no on-behalf permission). Days =
 *   working days of the employee's shift schedule, minus public holidays when the type excludes them. No overlaps with
 *   pending/approved leave, no days already worked (check-in recorded), inactive employees and inactive / ineligible
 *   types refused, document and balance required on submission, one calendar year per request.
 * - Balance: remaining = allocated − used − pending. Pending requests RESERVE days; approval turns the reservation
 *   into "used"; rejection or cancellation releases it; cancelling approved leave restores the days.
 * - Decisions: `hr.leave.approve` (organization) or `hr.leave.approve.team` (the manager's departments); never one's own
 *   request; only pending requests (`CONFLICT` otherwise — no double approval, no approving a rejected request).
 * - Attendance: approved leave shows as "On leave" there (attendance reads the approved index on every read).
 */

type Employee = ReturnType<typeof employeeRecords.all>[number];

const nowIso = () => new Date().toISOString();

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}
function forbidden(message = 'Outside your leave scope'): never {
  throw new ApiError('FORBIDDEN', message);
}
function conflict(message: string): never {
  throw new ApiError('CONFLICT', message);
}

/* Lookups (same simulated backend) ---------------------------------------------------------------------- */

const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const deptRef = (id: string): NamedRef => ({ id, name: department(id)?.name ?? { en: id, ar: id } });

function topLevel(departmentId: string): string {
  let current = department(departmentId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = department(current.parentId);
  }
  return current?.id ?? departmentId;
}

const unitsOf = (departmentId: string) => new Set([departmentId, ...orgTables.descendants(departmentId)]);
const typeById = (id: string) => leaveTypes.all().find((t) => t.id === id);
const typeRef = (t: LeaveType) => ({ id: t.id, name: t.name, code: t.code, paid: t.paid });
const meOf = (scope: LeaveScope) => employeeRecords.employeeIdOf(scope.userId) ?? null;
const SYSTEM: Localized<string> = { en: 'System (no approval required)', ar: 'النظام (لا يتطلب موافقة)' };

function actorName(scope: LeaveScope): Localized<string> {
  const id = meOf(scope);
  const e = id ? employeeRecords.get(id) : undefined;
  return e ? employeeRecords.fullName(e) : { en: scope.userId, ar: scope.userId };
}

/** Employed at some point during `year`. */
function employedIn(e: Employee, year: number): boolean {
  if (e.hireDate > `${year}-12-31`) return false;
  const since = employeeRecords.inactiveSince(e.id);
  return e.status === 'active' || (since !== null && since >= `${year}-01-01`);
}

/* Scope ------------------------------------------------------------------------------------------------- */

type Scoped = { employeeId: string; employee: { department: NamedRef } };

/** Rows the caller may read (team = the request's department at submission, or the caller's own). */
function readFilter(scope: LeaveScope): (row: Scoped) => boolean {
  const me = meOf(scope);
  if (scope.kind === 'organization') {
    if (!hasPermission(scope.role, 'hr.leave.view')) forbidden();
    return () => true;
  }
  if (scope.kind === 'team') {
    if (!hasPermission(scope.role, 'hr.leave.view.team')) forbidden();
    const units = employeeRecords.teamUnits(scope.userId);
    return (row) => row.employeeId === me || units.has(row.employee.department.id);
  }
  if (!hasPermission(scope.role, 'hr.leave.view.own')) forbidden();
  return (row) => row.employeeId === me;
}

/** May the caller approve / reject this request (ignoring its status)? Never their own. */
function mayDecide(scope: LeaveScope, row: Scoped): boolean {
  if (row.employeeId === meOf(scope)) return false;
  if (hasPermission(scope.role, 'hr.leave.approve')) return true;
  return hasPermission(scope.role, 'hr.leave.approve.team') && employeeRecords.teamUnits(scope.userId).has(row.employee.department.id);
}

const editable = (row: LeaveRow, today: string) => row.status === 'draft' || (row.status === 'pending' && row.startDate > today);

function cancellable(row: LeaveRow, today: string, own: boolean, decider: boolean): boolean {
  if (row.status === 'draft' || row.status === 'pending') return own || decider;
  // Approvers may cancel approved leave at any time (e.g. recalled early); the employee only before it starts.
  if (row.status === 'approved') return decider || (own && row.startDate > today);
  return false;
}

function visibleRow(id: string, scope: LeaveScope): LeaveRow {
  const row = leaveData.get(id);
  if (!row) throw new ApiError('NOT_FOUND', `Leave request ${id} not found`);
  if (!readFilter(scope)(row) || (row.status === 'draft' && row.employeeId !== meOf(scope))) forbidden();
  return row;
}

/** The employee for `requested` (`'me'` = the caller's own record), if the caller may see them. */
function targetEmployee(requested: string, scope: LeaveScope): Employee {
  const id = requested === 'me' ? (meOf(scope) ?? '') : requested;
  const e = employeeRecords.get(id);
  if (!e) throw new ApiError('NOT_FOUND', `Employee ${id} not found`);
  if (!readFilter(scope)({ employeeId: e.id, employee: { department: deptRef(e.departmentId) } })) forbidden();
  return e;
}

/* Mapping ----------------------------------------------------------------------------------------------- */

function toRequest(row: LeaveRow, scope: LeaveScope, today = todayIso()): LeaveRequest {
  const type = typeById(row.leaveTypeId)!;
  const own = row.employeeId === meOf(scope);
  const decider = mayDecide(scope, row);
  const sensitive = own || decider;
  return {
    id: row.id,
    number: row.number,
    employeeId: row.employeeId,
    employee: row.employee,
    leaveType: typeRef(type),
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    reason: sensitive ? row.reason : null,
    document: sensitive ? row.document : null,
    status: row.status,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    rejectionReason: row.rejectionReason,
    cancelledAt: row.cancelledAt,
    history: row.history,
    can: {
      edit: own && hasPermission(scope.role, 'hr.leave.request') && editable(row, today),
      cancel: cancellable(row, today, own, decider),
      approve: decider && row.status === 'pending',
    },
  };
}

/* Leave types ------------------------------------------------------------------------------------------- */

function requireAnyRead(scope: LeaveScope) {
  if (!(['hr.leave.view', 'hr.leave.view.team', 'hr.leave.view.own'] as const).some((p) => hasPermission(scope.role, p))) forbidden();
}
function requirePolicies(scope: LeaveScope) {
  if (!hasPermission(scope.role, 'hr.policies.manage')) forbidden('hr.policies.manage is required');
}

export function listLeaveTypes(params: ListParams<LeaveTypeFilters>, scope: LeaveScope): Paginated<LeaveType> {
  requireAnyRead(scope);
  const rows = leaveTypes.all().map((t) => ({ ...t, 'name.en': t.name.en, 'name.ar': t.name.ar }));
  const page = queryCollection(rows, params, {
    searchFields: ['code', 'name.en', 'name.ar'],
    matches: (t, f) => (!f.status || t.status === f.status) && (!f.paid || (f.paid === 'paid') === t.paid),
  });
  return { ...page, items: page.items.map(({ 'name.en': _en, 'name.ar': _ar, ...t }) => t) };
}

export function getLeaveType(id: string, scope: LeaveScope): LeaveType {
  requireAnyRead(scope);
  return leaveTypes.get(id);
}

function normalizeType(input: LeaveTypeInput): LeaveTypeInput {
  return { ...input, code: input.code.trim().toUpperCase(), name: { en: input.name.en.trim(), ar: input.name.ar.trim() }, description: input.description.trim() };
}

function checkType(input: LeaveTypeInput, exceptId?: string): LeaveTypeInput {
  const errors = validateLeaveTypeInput(input);
  if (errors) invalid(errors);
  const value = normalizeType(input);
  if (leaveTypes.all().some((t) => t.id !== exceptId && t.code.toUpperCase() === value.code)) invalid({ code: ['duplicateCode'] });
  return value;
}

export function createLeaveType(input: LeaveTypeInput, scope: LeaveScope): LeaveType {
  requirePolicies(scope);
  return leaveTypes.create({ ...checkType(input), status: 'active', createdAt: nowIso() });
}

/** Changes apply to balances from now on (allocations are computed from the type's current rules). */
export function updateLeaveType(id: string, input: LeaveTypeInput, scope: LeaveScope): LeaveType {
  requirePolicies(scope);
  leaveTypes.get(id);
  return leaveTypes.update(id, checkType(input, id));
}

/** Inactive types accept no new requests; existing requests and balances keep them. */
export function updateLeaveTypeStatus(id: string, status: RecordStatus, scope: LeaveScope): LeaveType {
  requirePolicies(scope);
  return leaveTypes.transition(id, (t) => t.status !== status, { status });
}

/* Balances ---------------------------------------------------------------------------------------------- */

type Usage = { used: number; pending: number };
const usageKey = (employeeId: string, typeId: string) => `${employeeId}|${typeId}`;

/** Used (approved) and reserved (pending) days per employee and type, for requests starting in `year`. */
function usageIndex(year: number, exceptId?: string): Map<string, Usage> {
  const index = new Map<string, Usage>();
  for (const r of leaveData.rows()) {
    if (r.id === exceptId || Number(r.startDate.slice(0, 4)) !== year || (r.status !== 'approved' && r.status !== 'pending')) continue;
    const key = usageKey(r.employeeId, r.leaveTypeId);
    const u = index.get(key) ?? { used: 0, pending: 0 };
    if (r.status === 'approved') u.used += r.days;
    else u.pending += r.days;
    index.set(key, u);
  }
  return index;
}

function balanceOf(e: Employee, type: LeaveType, year: number, index: Map<string, Usage>): LeaveBalance {
  const allocated = allocationFor(type, e, year);
  const u = index.get(usageKey(e.id, type.id)) ?? { used: 0, pending: 0 };
  return {
    employeeId: e.id,
    employee: { name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId) },
    leaveType: typeRef(type),
    year,
    allocated,
    used: u.used,
    pending: u.pending,
    remaining: allocated === null ? null : allocated - u.used - u.pending,
  };
}

/**
 * Types shown in someone's balances: active types open to everyone, plus any type with usage. Gender-restricted types
 * (maternity, paternity) appear for other viewers only when used, so balances never disclose an employee's gender;
 * the employee always sees the types they are eligible for.
 */
function balanceTypes(e: Employee, index: Map<string, Usage>, own: boolean): LeaveType[] {
  return leaveTypes.all().filter((t) => {
    if (index.has(usageKey(e.id, t.id))) return true;
    if (t.status !== 'active') return false;
    return t.eligibility === 'all' || (own && isEligible(t, e));
  });
}

const currentYear = () => Number(todayIso().slice(0, 4));
function parseYear(value: string | number | undefined): number {
  const year = Number(value ?? currentYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) invalid({ year: ['invalidYear'] });
  return year;
}

function balanceRows(f: Partial<LeaveBalanceFilters>, scope: LeaveScope): LeaveBalance[] {
  const visible = readFilter(scope);
  const year = parseYear(f.year);
  const index = usageIndex(year);
  const units = f.departmentId ? unitsOf(f.departmentId) : null;
  const me = meOf(scope);
  const out: LeaveBalance[] = [];
  for (const e of employeeRecords.all()) {
    if (!employedIn(e, year) || (f.employeeId && e.id !== f.employeeId) || (units && !units.has(e.departmentId))) continue;
    if (!visible({ employeeId: e.id, employee: { department: { id: e.departmentId, name: { en: '', ar: '' } } } })) continue;
    for (const t of balanceTypes(e, index, e.id === me)) if (!f.leaveTypeId || t.id === f.leaveTypeId) out.push(balanceOf(e, t, year, index));
  }
  return out;
}

export function listBalances(params: ListParams<LeaveBalanceFilters>, scope: LeaveScope): Paginated<LeaveBalance> {
  const rows = balanceRows(params.filters ?? {}, scope).map((b) => ({ ...b, 'employee.name.en': b.employee.name.en, 'employee.name.ar': b.employee.name.ar, 'employee.employeeNumber': b.employee.employeeNumber }));
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['employee.name.en', 'employee.name.ar', 'employee.employeeNumber'] });
  return { ...page, items: page.items.map(({ 'employee.name.en': _a, 'employee.name.ar': _b, 'employee.employeeNumber': _c, ...b }) => b) };
}

export function employeeBalances(requestedId: string, year: number | undefined, scope: LeaveScope): LeaveBalance[] {
  const e = targetEmployee(requestedId, scope);
  const y = parseYear(year);
  const index = usageIndex(y);
  return balanceTypes(e, index, e.id === meOf(scope)).map((t) => balanceOf(e, t, y, index));
}

/** Balance movements of one request: recorded for edited requests, derived from the history otherwise. */
function ledgerOf(row: LeaveRow): LedgerEntry[] {
  if (row.ledger) return row.ledger;
  const out: LedgerEntry[] = [];
  let state: LeaveStatus = 'draft';
  let submittedAt = '';
  for (const h of row.history) {
    if (h.action === 'submitted') {
      out.push({ at: h.at, type: 'reserved', days: -row.days });
      state = 'pending';
      submittedAt = h.at;
    } else if (h.action === 'approved') {
      // Approved on submission (type without approval): no reservation step.
      if (h.at === submittedAt && out.at(-1)?.type === 'reserved') out.pop();
      else out.push({ at: h.at, type: 'released', days: row.days });
      out.push({ at: h.at, type: 'used', days: -row.days });
      state = 'approved';
    } else if (h.action === 'rejected') {
      out.push({ at: h.at, type: 'released', days: row.days });
      state = 'rejected';
    } else if (h.action === 'cancelled') {
      if (state === 'approved') out.push({ at: h.at, type: 'restored', days: row.days });
      else if (state === 'pending') out.push({ at: h.at, type: 'released', days: row.days });
      state = 'cancelled';
    }
  }
  return out;
}

/** Allocation first, then every reservation / release / use / restoration; the sum equals `remaining`. */
export function balanceHistory(requestedId: string, leaveTypeId: string, year: number | undefined, scope: LeaveScope): BalanceEvent[] {
  const e = targetEmployee(requestedId, scope);
  const y = parseYear(year);
  const type = typeById(leaveTypeId);
  if (!type) throw new ApiError('NOT_FOUND', `Leave type ${leaveTypeId} not found`);
  const allocated = allocationFor(type, e, y);
  const events: BalanceEvent[] = [];
  if (allocated !== null) {
    const from = e.hireDate > `${y}-01-01` ? e.hireDate : `${y}-01-01`;
    events.push({ date: from, type: 'allocated', days: allocated, requestId: null, requestNumber: null, note: '' });
  }
  const me = meOf(scope);
  const rows = leaveData.rows().filter((r) => r.employeeId === e.id && r.leaveTypeId === type.id && Number(r.startDate.slice(0, 4)) === y && (r.status !== 'draft' || r.employeeId === me));
  const moves = rows.flatMap((r) => ledgerOf(r).map((l) => ({ date: l.at, type: l.type, days: l.days, requestId: r.id, requestNumber: r.number, note: `${r.startDate} – ${r.endDate}` })));
  moves.sort((a, b) => a.date.localeCompare(b.date));
  return [...events, ...moves];
}

/* Requests ---------------------------------------------------------------------------------------------- */

const SORT_FLAT = (r: LeaveRequest) => ({ ...r, 'employee.name.en': r.employee.name.en, 'employee.name.ar': r.employee.name.ar });

export function listRequests(params: ListParams<LeaveRequestFilters>, scope: LeaveScope): Paginated<LeaveRequest> {
  const visible = readFilter(scope);
  const me = meOf(scope);
  const today = todayIso();
  const f = params.filters ?? {};
  const units = f.departmentId ? unitsOf(f.departmentId) : null;
  const rows = leaveData
    .rows()
    .filter(
      (r) =>
        visible(r) &&
        (r.status !== 'draft' || r.employeeId === me) &&
        (!f.employeeId || r.employeeId === f.employeeId) &&
        (!units || units.has(r.employee.department.id)) &&
        (!f.leaveTypeId || r.leaveTypeId === f.leaveTypeId) &&
        (!f.status || r.status === f.status) &&
        (!f.from || r.endDate >= f.from) &&
        (!f.to || r.startDate <= f.to) &&
        (!f.awaitingMe || (r.status === 'pending' && mayDecide(scope, r))),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...SORT_FLAT(toRequest(r, scope, today)), search: `${r.number} ${r.employee.name.en} ${r.employee.name.ar} ${r.employee.employeeNumber}` }));
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['search'] });
  return { ...page, items: page.items.map(({ 'employee.name.en': _a, 'employee.name.ar': _b, search: _s, ...r }) => r) };
}

export function getRequest(id: string, scope: LeaveScope): LeaveRequest {
  return toRequest(visibleRow(id, scope), scope);
}

/** The caller's own employee record: requests are self-service only (no on-behalf permission in the matrix). */
function requester(input: Pick<LeaveRequestInput, 'employeeId'>, scope: LeaveScope): Employee {
  if (!hasPermission(scope.role, 'hr.leave.request')) forbidden('hr.leave.request is required');
  const me = meOf(scope);
  if (!me) forbidden('No employee record is linked to this account');
  if (input.employeeId && input.employeeId !== me) forbidden('Leave can only be requested for yourself');
  return employeeRecords.get(me)!;
}

interface Checked {
  type: LeaveType;
  days: number;
  countedDates: string[];
  excludedHolidays: LeaveQuote['excludedHolidays'];
}

/** Counts the days of a request for the employee (their schedule decides the weekend). */
function count(e: Employee, type: LeaveType, start: string, end: string) {
  return countLeaveDays(start, end, (d) => attendanceSchedule.isWorkingDay(e.id, d), type, leaveData.holidays);
}

/**
 * Every rule of a request. Drafts are checked too (so they can be submitted later), except the document and the
 * balance, which are required on submission. `exceptId` = the request being edited.
 */
function checkRequest(e: Employee, input: LeaveRequestInput, submit: boolean, exceptId?: string): Checked {
  const schema = validateRequestInput(input);
  if (schema) invalid(schema);
  const errors: FieldErrors = {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  const type = typeById(input.leaveTypeId);
  if (!type) invalid({ leaveTypeId: ['required'] });
  if (e.status !== 'active') add('employeeId', 'inactiveEmployee');
  if (type.status !== 'active') add('leaveTypeId', 'typeInactive');
  else if (!isEligible(type, e)) add('leaveTypeId', 'notEligible');
  if (input.startDate < e.hireDate) add('startDate', 'beforeHire');
  const c = count(e, type, input.startDate, input.endDate);
  if (c.days === 0) add('endDate', 'noWorkingDays');
  if (type.maxConsecutiveDays !== null && c.days > type.maxConsecutiveDays) add('endDate', 'tooManyDays');
  const clash = leaveData.rows().some((r) => r.employeeId === e.id && r.id !== exceptId && (r.status === 'pending' || r.status === 'approved') && overlaps(r, input));
  if (clash) add('startDate', 'overlap');
  if (c.countedDates.some((d) => attendanceSchedule.hasCheckIn(e.id, d))) add('startDate', 'attendanceRecorded');
  if (submit) {
    if (type.requiresDocument && !input.document) add('document', 'documentRequired');
    const allocation = allocationFor(type, e, Number(input.startDate.slice(0, 4)));
    const u = usageIndex(Number(input.startDate.slice(0, 4)), exceptId).get(usageKey(e.id, type.id)) ?? { used: 0, pending: 0 };
    if (allocation !== null && !errors.leaveTypeId && u.used + u.pending + c.days > allocation) add('leaveTypeId', 'insufficientBalance');
  }
  if (Object.keys(errors).length > 0) invalid(errors);
  return { type, days: c.days, countedDates: c.countedDates, excludedHolidays: c.excludedHolidays };
}

/** Preview: days counted and the balance after the request (no rules beyond the form's are enforced here). */
export function quote(input: LeaveRequestInput, scope: LeaveScope, exceptId?: string): LeaveQuote {
  const e = requester(input, scope);
  const schema = validateRequestInput(input);
  if (schema) invalid(schema);
  const type = typeById(input.leaveTypeId);
  if (!type) invalid({ leaveTypeId: ['required'] });
  const c = count(e, type, input.startDate, input.endDate);
  const year = Number(input.startDate.slice(0, 4));
  const balance = balanceOf(e, type, year, usageIndex(year, exceptId));
  return { days: c.days, countedDates: c.countedDates, excludedHolidays: c.excludedHolidays, balance, remainingAfter: balance.remaining === null ? null : balance.remaining - c.days };
}

/** Status, history and ledger entries when a request is submitted now. */
function submission(type: LeaveType, days: number, by: Localized<string>, at: string) {
  if (!type.requiresApproval) {
    return {
      status: 'approved' as const,
      decidedAt: at,
      decidedBy: null,
      history: [{ at, action: 'submitted' as const, by, note: '' }, { at, action: 'approved' as const, by: SYSTEM, note: '' }],
      ledger: [{ at, type: 'used' as const, days: -days }],
    };
  }
  return { status: 'pending' as const, decidedAt: null, decidedBy: null, history: [{ at, action: 'submitted' as const, by, note: '' }], ledger: [{ at, type: 'reserved' as const, days: -days }] };
}

export function createRequest(input: LeaveRequestInput, scope: LeaveScope): LeaveRequest {
  const e = requester(input, scope);
  const c = checkRequest(e, input, input.submit);
  const at = nowIso();
  const by = employeeRecords.fullName(e);
  const sub = input.submit ? submission(c.type, c.days, by, at) : null;
  const row = leaveData.insert({
    employeeId: e.id,
    employee: employeeSnapshot(e.id),
    leaveTypeId: c.type.id,
    startDate: input.startDate,
    endDate: input.endDate,
    days: c.days,
    reason: input.reason.trim(),
    document: input.document,
    status: sub?.status ?? 'draft',
    createdAt: at,
    submittedAt: sub ? at : null,
    decidedAt: sub?.decidedAt ?? null,
    decidedBy: sub?.decidedBy ?? null,
    rejectionReason: null,
    cancelledAt: null,
    history: [{ at, action: 'created', by, note: '' }, ...(sub?.history ?? [])],
    ledger: sub?.ledger ?? [],
  });
  return toRequest(row, scope);
}

/** The owner edits a draft (and may submit it) or a pending request that has not started. */
export function updateRequest(id: string, input: LeaveRequestInput, scope: LeaveScope): LeaveRequest {
  const row = visibleRow(id, scope);
  const e = requester({ employeeId: input.employeeId ?? row.employeeId }, scope);
  if (row.employeeId !== e.id) forbidden('Only the requester can edit a request');
  if (!editable(row, todayIso())) conflict(`Leave request ${row.number} can no longer be edited`);
  const submit = row.status === 'pending' || input.submit;
  const c = checkRequest(e, input, submit, row.id);
  const at = nowIso();
  const by = employeeRecords.fullName(e);
  const ledger = [...ledgerOf(row)];
  const history = [...row.history, { at, action: 'updated' as const, by, note: '' }];
  let patch: Partial<LeaveRow> = {};
  if (row.status === 'pending' && c.days !== row.days) ledger.push({ at, type: 'released', days: row.days }, { at, type: 'reserved', days: -c.days });
  if (row.status === 'draft' && input.submit) {
    const sub = submission(c.type, c.days, by, at);
    history.push(...sub.history);
    ledger.push(...sub.ledger);
    patch = { status: sub.status, submittedAt: at, decidedAt: sub.decidedAt, decidedBy: sub.decidedBy };
  }
  const next = leaveData.replace({ ...row, ...patch, leaveTypeId: c.type.id, startDate: input.startDate, endDate: input.endDate, days: c.days, reason: input.reason.trim(), document: input.document, history, ledger });
  return toRequest(next, scope);
}

function decidable(id: string, scope: LeaveScope): LeaveRow {
  const row = visibleRow(id, scope);
  if (row.employeeId === meOf(scope)) forbidden('You cannot decide your own leave request');
  if (!mayDecide(scope, row)) forbidden('Outside your approval scope');
  if (row.status !== 'pending') conflict(`Leave request ${row.number} is ${row.status}, not pending`);
  return row;
}

/** Approval turns the reservation into used days; attendance shows the dates as "On leave" from now on. */
export function approveRequest(id: string, scope: LeaveScope): LeaveRequest {
  const row = decidable(id, scope);
  const e = employeeRecords.get(row.employeeId)!;
  if (e.status !== 'active') invalid({ form: ['inactiveEmployee'] });
  if (leaveData.rows().some((r) => r.id !== row.id && r.employeeId === row.employeeId && r.status === 'approved' && overlaps(r, row))) invalid({ form: ['overlapApproved'] });
  const type = typeById(row.leaveTypeId)!;
  if (count(e, type, row.startDate, row.endDate).countedDates.some((d) => attendanceSchedule.hasCheckIn(e.id, d))) invalid({ form: ['attendanceRecorded'] });
  const at = nowIso();
  const by = actorName(scope);
  const next = leaveData.replace({
    ...row,
    status: 'approved',
    decidedAt: at,
    decidedBy: by,
    history: [...row.history, { at, action: 'approved', by, note: '' }],
    ledger: [...ledgerOf(row), { at, type: 'released', days: row.days }, { at, type: 'used', days: -row.days }],
  });
  return toRequest(next, scope);
}

/** Rejection needs a reason and releases the reserved days. */
export function rejectRequest(id: string, reason: string, scope: LeaveScope): LeaveRequest {
  const errors = validateRejectReason(reason);
  const row = decidable(id, scope);
  if (errors) invalid(errors);
  const at = nowIso();
  const by = actorName(scope);
  const note = reason.trim();
  const next = leaveData.replace({
    ...row,
    status: 'rejected',
    decidedAt: at,
    decidedBy: by,
    rejectionReason: note,
    history: [...row.history, { at, action: 'rejected', by, note }],
    ledger: [...ledgerOf(row), { at, type: 'released', days: row.days }],
  });
  return toRequest(next, scope);
}

/**
 * Cancels a draft, a pending request (releases the reservation) or approved leave (restores the days; attendance
 * shows those dates as working days again — past ones without a check-in become "absent").
 */
export function cancelRequest(id: string, scope: LeaveScope): LeaveRequest {
  const row = visibleRow(id, scope);
  if (row.status === 'rejected' || row.status === 'cancelled') conflict(`Leave request ${row.number} is already ${row.status}`);
  const own = row.employeeId === meOf(scope);
  if (!cancellable(row, todayIso(), own, mayDecide(scope, row))) forbidden(own ? 'Approved leave that has started can only be cancelled by an approver' : 'Outside your approval scope');
  const at = nowIso();
  const by = actorName(scope);
  const move: LedgerEntry[] = row.status === 'approved' ? [{ at, type: 'restored', days: row.days }] : row.status === 'pending' ? [{ at, type: 'released', days: row.days }] : [];
  const next = leaveData.replace({ ...row, status: 'cancelled', cancelledAt: at, history: [...row.history, { at, action: 'cancelled', by, note: '' }], ledger: [...ledgerOf(row), ...move] });
  return toRequest(next, scope);
}

/* Calendar ---------------------------------------------------------------------------------------------- */

export interface CalendarFilters {
  departmentId?: string;
  leaveTypeId?: string;
  status?: 'approved' | 'pending';
}

const monthEnd = (month: string) => addDays(`${addDays(`${month}-28`, 4).slice(0, 7)}-01`, -1);

/** Approved and pending leave overlapping `month` (`YYYY-MM`) in the caller's scope. */
export function calendar(month: string, filters: CalendarFilters, scope: LeaveScope): CalendarEntry[] {
  if (!/^\d{4}-\d{2}$/.test(month) || !isDate(`${month}-01`)) invalid({ month: ['invalidMonth'] });
  const visible = readFilter(scope);
  const range = { startDate: `${month}-01`, endDate: monthEnd(month) };
  const units = filters.departmentId ? unitsOf(filters.departmentId) : null;
  return leaveData
    .rows()
    .filter(
      (r) =>
        visible(r) &&
        (r.status === 'approved' || r.status === 'pending') &&
        (!filters.status || r.status === filters.status) &&
        (!filters.leaveTypeId || r.leaveTypeId === filters.leaveTypeId) &&
        (!units || units.has(r.employee.department.id)) &&
        overlaps(r, range),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.employee.name.en.localeCompare(b.employee.name.en))
    .map((r) => {
      const t = typeById(r.leaveTypeId)!;
      return {
        requestId: r.id,
        number: r.number,
        employeeId: r.employeeId,
        name: r.employee.name,
        department: r.employee.department,
        leaveType: { id: t.id, name: t.name, code: t.code },
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status as 'approved' | 'pending',
      };
    });
}

/* Overview ---------------------------------------------------------------------------------------------- */

/**
 * Employees on approved leave today. Counted only where today is a working day of their schedule and they are active
 * — exactly the "On leave" records Attendance shows for today, so both modules report the same figure.
 */
function onLeaveToday(scope: LeaveScope): number {
  const visible = readFilter(scope);
  const today = todayIso();
  const people = new Set<string>();
  for (const r of leaveData.rows()) {
    if (r.status !== 'approved' || r.startDate > today || r.endDate < today || !visible(r)) continue;
    if (employeeRecords.get(r.employeeId)?.status !== 'active' || !attendanceSchedule.isWorkingDay(r.employeeId, today)) continue;
    people.add(r.employeeId);
  }
  return people.size;
}

export function summary(year: number | undefined, scope: LeaveScope): LeaveSummary {
  const y = parseYear(year);
  const visible = readFilter(scope);
  const rows = leaveData.rows().filter((r) => visible(r) && r.status !== 'draft' && Number(r.startDate.slice(0, 4)) === y);
  const byStatus = Object.fromEntries(LEAVE_STATUSES.map((s) => [s, 0])) as Record<LeaveStatus, number>;
  for (const r of rows) byStatus[r.status]++;
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: `${y}-${String(i + 1).padStart(2, '0')}`, pending: 0, approved: 0, rejected: 0, cancelled: 0 }));
  const types = new Map<string, { leaveType: NamedRef; days: number; requests: number }>();
  const depts = new Map<string, { department: NamedRef; days: number; requests: number }>();
  for (const r of rows) {
    const m = monthly[Number(r.startDate.slice(5, 7)) - 1]!;
    if (r.status !== 'draft') m[r.status]++;
    if (r.status !== 'approved') continue;
    const t = typeById(r.leaveTypeId)!;
    const te = types.get(t.id) ?? { leaveType: { id: t.id, name: t.name }, days: 0, requests: 0 };
    te.days += r.days;
    te.requests++;
    types.set(t.id, te);
    const top = topLevel(r.employee.department.id);
    const de = depts.get(top) ?? { department: deptRef(top), days: 0, requests: 0 };
    de.days += r.days;
    de.requests++;
    depts.set(top, de);
  }
  const byDays = <T extends { days: number }>(list: T[]) => list.sort((a, b) => b.days - a.days);
  return {
    year: y,
    total: rows.length,
    byStatus,
    onLeaveToday: onLeaveToday(scope),
    daysUsed: rows.filter((r) => r.status === 'approved').reduce((s, r) => s + r.days, 0),
    monthly,
    byType: byDays([...types.values()]),
    byDepartment: byDays([...depts.values()]),
  };
}

/* Reports ----------------------------------------------------------------------------------------------- */

const MAX_REPORT_DAYS = 366;

function checkReportFilters(f: LeaveReportFilters) {
  const errors: FieldErrors = {};
  if (!isDate(f.from ?? '')) errors.from = ['invalidDate'];
  if (!isDate(f.to ?? '')) errors.to = ['invalidDate'];
  if (!errors.from && !errors.to) {
    if (f.to < f.from) errors.to = ['endBeforeStart'];
    else if ((new Date(`${f.to}T00:00`).getTime() - new Date(`${f.from}T00:00`).getTime()) / 86_400_000 + 1 > MAX_REPORT_DAYS) errors.to = ['reportTooLong'];
  }
  if (Object.keys(errors).length > 0) invalid(errors);
}

function reportRows(f: LeaveReportFilters, scope: LeaveScope): LeaveReportRows {
  checkReportFilters(f);
  if (f.type === 'balances') return { type: 'balances', rows: balanceRows({ year: f.from.slice(0, 4), departmentId: f.departmentId, leaveTypeId: f.leaveTypeId }, scope) };
  const visible = readFilter(scope);
  const units = f.departmentId ? unitsOf(f.departmentId) : null;
  const range = { startDate: f.from, endDate: f.to };
  const rows = leaveData
    .rows()
    .filter((r) => visible(r) && r.status !== 'draft' && overlaps(r, range) && (!units || units.has(r.employee.department.id)) && (!f.leaveTypeId || r.leaveTypeId === f.leaveTypeId))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.number.localeCompare(b.number));
  if (f.type === 'requests') {
    const today = todayIso();
    return { type: 'requests', rows: rows.map((r) => toRequest(r, scope, today)) };
  }
  const groups = new Map<string, UsageRow & { people: Set<string> }>();
  for (const r of rows) {
    const key: NamedRef = f.type === 'by-type' ? { id: r.leaveTypeId, name: typeById(r.leaveTypeId)!.name } : deptRef(topLevel(r.employee.department.id));
    const g = groups.get(key.id) ?? { key, requests: 0, approvedDays: 0, pendingDays: 0, employees: 0, people: new Set<string>() };
    g.requests++;
    if (r.status === 'approved') {
      g.approvedDays += r.days;
      g.people.add(r.employeeId);
    }
    if (r.status === 'pending') g.pendingDays += r.days;
    groups.set(key.id, g);
  }
  const usage = [...groups.values()].map(({ people, ...g }) => ({ ...g, employees: people.size })).sort((a, b) => b.approvedDays - a.approvedDays || a.key.id.localeCompare(b.key.id));
  return { type: f.type === 'by-type' ? 'by-type' : 'by-department', rows: usage };
}

export function report(params: ListParams<LeaveReportFilters>, scope: LeaveScope): LeaveReport {
  const filters = params.filters as LeaveReportFilters;
  const data = reportRows(filters, scope);
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize)));
  const page = Math.max(1, Math.floor(params.page));
  const all = data.rows as unknown[];
  const slice = all.slice((page - 1) * pageSize, page * pageSize);
  return { filters, page, pageSize, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / pageSize)), data: { ...data, rows: slice } as LeaveReportRows };
}

const CSV_TEXT = {
  en: {
    number: 'Request number', employee: 'Employee', employeeNumber: 'Employee number', department: 'Department', type: 'Leave type', code: 'Code', start: 'Start date', end: 'End date', days: 'Days',
    submitted: 'Submitted', status: 'Status', year: 'Year', allocated: 'Allocated', used: 'Used', pending: 'Pending', remaining: 'Remaining', noLimit: 'No limit',
    requests: 'Requests', approvedDays: 'Approved days', pendingDays: 'Pending days', employees: 'Employees on leave',
    statuses: { draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' },
  },
  ar: {
    number: 'رقم الطلب', employee: 'الموظف', employeeNumber: 'الرقم الوظيفي', department: 'القسم', type: 'نوع الإجازة', code: 'الرمز', start: 'تاريخ البداية', end: 'تاريخ النهاية', days: 'الأيام',
    submitted: 'تاريخ التقديم', status: 'الحالة', year: 'السنة', allocated: 'المخصص', used: 'المستخدم', pending: 'قيد الانتظار', remaining: 'المتبقي', noLimit: 'بلا حد',
    requests: 'الطلبات', approvedDays: 'الأيام المعتمدة', pendingDays: 'الأيام قيد الانتظار', employees: 'الموظفون في إجازة',
    statuses: { draft: 'مسودة', pending: 'قيد الانتظار', approved: 'معتمد', rejected: 'مرفوض', cancelled: 'ملغى' },
  },
} as const;

export function exportReport(filters: LeaveReportFilters, language: 'en' | 'ar', scope: LeaveScope): CsvExport {
  const data = reportRows(filters, scope);
  const t = CSV_TEXT[language];
  let header: string[];
  let lines: Array<Array<string | number | null>>;
  if (data.type === 'requests') {
    header = [t.number, t.employee, t.employeeNumber, t.department, t.type, t.code, t.start, t.end, t.days, t.submitted, t.status];
    lines = data.rows.map((r) => [r.number, r.employee.name[language], r.employee.employeeNumber, r.employee.department.name[language], r.leaveType.name[language], r.leaveType.code, r.startDate, r.endDate, r.days, r.submittedAt?.slice(0, 10) ?? null, t.statuses[r.status]]);
  } else if (data.type === 'balances') {
    header = [t.employee, t.employeeNumber, t.department, t.type, t.year, t.allocated, t.used, t.pending, t.remaining];
    lines = data.rows.map((b) => [b.employee.name[language], b.employee.employeeNumber, b.employee.department.name[language], b.leaveType.name[language], b.year, b.allocated ?? t.noLimit, b.used, b.pending, b.remaining ?? t.noLimit]);
  } else {
    header = [data.type === 'by-type' ? t.type : t.department, t.requests, t.approvedDays, t.pendingDays, t.employees];
    lines = data.rows.map((u) => [u.key.name[language], u.requests, u.approvedDays, u.pendingDays, u.employees]);
  }
  const content = '﻿' + [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return { fileName: `leave-${filters.type}-${filters.from}_${filters.to}.csv`, content, rows: lines.length };
}

/* Used by the payroll mock (same simulated backend; payroll → leave, never the other way) ------------------- */

export interface ApprovedLeaveInPeriod {
  requestId: string;
  number: string;
  leaveType: { id: string; code: string; name: Localized<string>; paid: boolean };
  startDate: string;
  endDate: string;
  /** The request's counted leave days (employee's working days, minus excluded holidays) that fall inside the period. */
  dates: string[];
}

/** Approved requests per employee, rebuilt when the request list changes (new array or new row). */
let approvedCache: { rows: readonly LeaveRow[]; length: number; byEmployee: Map<string, LeaveRow[]> } | null = null;
function approvedByEmployee(): Map<string, LeaveRow[]> {
  const rows = leaveData.rows();
  if (approvedCache?.rows === rows && approvedCache.length === rows.length) return approvedCache.byEmployee;
  const byEmployee = new Map<string, LeaveRow[]>();
  for (const r of rows) if (r.status === 'approved') byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
  approvedCache = { rows, length: rows.length, byEmployee };
  return byEmployee;
}

export const leaveFacts = {
  /**
   * APPROVED leave of the employee overlapping [from, to]: pending, rejected, cancelled and draft requests never
   * count. Days are counted exactly as Leave Management counts them for the request.
   */
  approvedInPeriod(employeeId: string, from: string, to: string): ApprovedLeaveInPeriod[] {
    const e = employeeRecords.get(employeeId);
    if (!e) return [];
    const result: ApprovedLeaveInPeriod[] = [];
    for (const r of approvedByEmployee().get(employeeId) ?? []) {
      if (r.startDate > to || r.endDate < from) continue;
      const type = typeById(r.leaveTypeId);
      if (!type) continue;
      const dates = count(e, type, r.startDate, r.endDate).countedDates.filter((d) => d >= from && d <= to);
      if (dates.length === 0) continue;
      result.push({ requestId: r.id, number: r.number, leaveType: { id: type.id, code: type.code, name: type.name, paid: type.paid }, startDate: r.startDate, endDate: r.endDate, dates });
    }
    return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  },
};
