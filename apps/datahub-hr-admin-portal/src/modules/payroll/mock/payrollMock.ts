import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { attendanceFacts } from '@/modules/attendance/mock/attendanceMock';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { leaveFacts } from '@/modules/leave/mock/leaveMock';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import {
  validateAllowanceTypeInput,
  validateAssignmentInput,
  validateCompensationInput,
  validateDeductionTypeInput,
  validatePolicyInput,
  validateReason,
  validateRunInput,
  validateStructureInput,
  type FieldErrors,
} from '@/modules/payroll/schemas/payrollSchemas';
import {
  SYSTEM_DEDUCTION_CATEGORIES,
  type ActivityEntry,
  type AllowanceType,
  type AllowanceTypeInput,
  type AssignmentEvent,
  type AssignmentInput,
  type AssignmentState,
  type CalculationType,
  type CompensationFilters,
  type CompensationInput,
  type CompensationReason,
  type CompensationRecord,
  type CompensationStatus,
  type CsvExport,
  type Currency,
  type DeductionType,
  type DeductionTypeInput,
  type EmployeeAllowance,
  type EmployeeCompensationDetail,
  type EmployeeCompensationSummary,
  type EmployeeDeduction,
  type EmployeeOption,
  type EmployeeSnapshot,
  type LineFilters,
  type LineSummary,
  type Minor,
  type MyPayroll,
  type NamedRef,
  type PayrollLine,
  type PayrollPolicy,
  type PayrollReport,
  type PayrollReportFilters,
  type PayrollRun,
  type PayrollScope,
  type PayrollSummary,
  type Payslip,
  type PayslipFilters,
  type PayslipSummary,
  type PolicyInput,
  type RecordState,
  type RecordStatus,
  type Recurrence,
  type ReportCell,
  type RunFilters,
  type RunInput,
  type RunIssue,
  type RunStatus,
  type RunSummary,
  type SalaryStructure,
  type SalaryStructureInput,
  type StructureFilters,
  type TypeFilters,
} from '@/modules/payroll/types/payroll';
import { calculateLine, withDerivedEnds, type EngineAssignment, type EngineItemType } from '@/modules/payroll/utils/engine';
import { sumMinor, toDecimalString } from '@/modules/payroll/utils/money';
import {
  addDays,
  addMonths,
  BLOCKING_RUN_STATUSES,
  CALCULABLE_RUN_STATUSES,
  CANCELLABLE_RUN_STATUSES,
  EDITABLE_RUN_STATUSES,
  FINAL_RUN_STATUSES,
  isMonth,
  monthEnd,
  monthOf,
  monthStart,
  PENDING_RUN_STATUSES,
  rangesOverlap,
  todayIso,
} from '@/modules/payroll/utils/rules';
import {
  ALLOWANCE_TYPE_SEED,
  BASE_CURRENCY,
  BASIC_RANGE,
  CANCELLATION_REASON,
  COMPANY,
  CREATED,
  CSV_CATEGORY,
  CSV_STATUS,
  CSV_TEXT,
  DEDUCTION_TYPE_SEED,
  REJECTION_REASON,
  STRUCTURE_BY_LEVEL,
  STRUCTURE_SEED,
} from './seed';

/*
 * SIMULATED payroll backend (in memory, reset on reload) — part of the same simulated backend as the employees,
 * organization, attendance and leave mocks: compensation, lines and payslips reference EXISTING employee ids; attendance
 * and approved leave are read through those modules' backend accessors (`attendanceFacts`, `leaveFacts`). Rules the real
 * backend must enforce on every request:
 *
 * - Scope: `organization` (hr.payroll.view) or `own` (hr.payroll.view.own: own compensation and payslips only). Anything else
 *   → `FORBIDDEN`; another employee's payslip is `NOT_FOUND` for own scope (no existence leak through URLs).
 * - Writes need hr.payroll.manage; approving / rejecting needs hr.payroll.approve and NEVER the run's creator.
 * - Compensation and assignments are immutable history: changes start a new record; nothing may reach into a payroll
 *   period that is already approved or paid for the employee.
 * - Runs: one calendar month, no two non-cancelled runs over the same employees and overlapping periods; workflow
 *   draft → calculated → (validated) pending approval → approved → paid (simulated) — paid runs are immutable;
 *   rejected runs are corrected (recalculate / edit) and resubmitted; every transition is recorded.
 * - Calculations are stored as snapshots: later changes to compensation, assignments, leave or attendance never alter a
 *   calculated line (validation warns when a recalculation would differ).
 * - "Paid" is an administrative record only: no bank transfer or payment is made by this application.
 */

type StructureRow = Omit<SalaryStructure, 'assignedEmployees'>;
type AllowanceTypeRow = Omit<AllowanceType, 'assignedEmployees'>;
type DeductionTypeRow = Omit<DeductionType, 'assignedEmployees'>;

interface CompRow {
  id: string;
  employeeId: string;
  structureId: string;
  basicSalary: Minor;
  currency: Currency;
  payFrequency: 'monthly';
  effectiveFrom: string;
  reason: CompensationReason;
  note: string;
  createdAt: string;
  createdBy: Localized<string>;
}

interface AssignmentRow {
  id: string;
  kind: 'allowance' | 'deduction';
  employeeId: string;
  typeId: string;
  calculation: CalculationType;
  amount: Minor | null;
  percentage: number | null;
  currency: Currency;
  recurrence: Recurrence;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string;
  createdAt: string;
  history: AssignmentEvent[];
}

type LineRow = Omit<PayrollLine, 'runId' | 'payslipId'>;

interface RunRow extends Omit<PayrollRun, 'can' | 'approvalBlockedReason' | 'department' | 'payslipsGenerated'> {
  departmentId: string | null;
  lines: LineRow[];
}

type PayslipRow = Omit<Payslip, 'paymentStatus'>;

interface Db {
  policy: PayrollPolicy;
  structures: StructureRow[];
  comps: CompRow[];
  allowanceTypes: AllowanceTypeRow[];
  deductionTypes: DeductionTypeRow[];
  assignments: AssignmentRow[];
  runs: RunRow[];
  payslips: PayslipRow[];
  seq: { comp: number; assignment: number; run: number; structure: number; allowance: number; deduction: number };
}

let db: Db | null = null;

/** Restore the initial state (tests). Data is regenerated on next use, relative to the current date. */
export function resetPayrollMock(): void {
  db = null;
}

/* Helpers ------------------------------------------------------------------------------------------------------------ */

const pad = (n: number, w: number) => String(n).padStart(w, '0');
const nowIso = () => new Date().toISOString();

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}
function forbidden(message = 'Outside your payroll scope'): never {
  throw new ApiError('FORBIDDEN', message);
}
function notFound(what: string, id: string): never {
  throw new ApiError('NOT_FOUND', `${what} ${id} not found`);
}
function conflict(message: string): never {
  throw new ApiError('CONFLICT', message);
}

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Employee = ReturnType<typeof employeeRecords.all>[number];
const empRow = (id: string): Employee | undefined => employeeRecords.get(id);
const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const position = (id: string) => orgTables.positions().find((p) => p.id === id);
const location = (id: string) => orgTables.locations().find((l) => l.id === id);
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

function snapshot(e: Employee): EmployeeSnapshot {
  return {
    name: employeeRecords.fullName(e),
    employeeNumber: e.employeeNumber,
    department: deptRef(e.departmentId),
    position: { id: e.positionId, name: position(e.positionId)?.title ?? { en: e.positionId, ar: e.positionId } },
    location: { id: e.locationId, name: location(e.locationId)?.name ?? { en: e.locationId, ar: e.locationId } },
  };
}

/** Last employed day of an inactive employee (the day before deactivation), `null` while active. */
function lastDayOf(e: Employee): string | null {
  if (e.status === 'active') return null;
  const since = employeeRecords.inactiveSince(e.id);
  return since ? addDays(since, -1) : e.hireDate;
}

const meOf = (scope: PayrollScope) => employeeRecords.employeeIdOf(scope.userId) ?? null;
function actor(scope: PayrollScope): Localized<string> {
  const id = meOf(scope);
  const e = id ? empRow(id) : undefined;
  return e ? employeeRecords.fullName(e) : { en: scope.userId, ar: scope.userId };
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

/** Search (custom text), sort (custom accessor, stable) and paginate like a list endpoint. */
function page<T>(items: readonly T[], params: ListParams<object>, opts: { search?: (item: T) => string; sort?: (item: T, field: string) => unknown } = {}): Paginated<T> {
  const term = params.search?.trim().toLowerCase();
  let list = term && opts.search ? items.filter((i) => opts.search!(i).toLowerCase().includes(term)) : [...items];
  if (params.sortBy && opts.sort) {
    const sign = params.sortDirection === 'desc' ? -1 : 1;
    const field = params.sortBy;
    list = list.map((item, index) => ({ item, index })).sort((a, b) => sign * compare(opts.sort!(a.item, field), opts.sort!(b.item, field)) || a.index - b.index).map((x) => x.item);
  }
  return queryCollection(list, { page: params.page, pageSize: params.pageSize });
}
const nameSearch = (n: Localized<string>, number = '') => `${n.en} ${n.ar} ${number}`;

/* Access --------------------------------------------------------------------------------------------------------------- */

interface Access {
  org: boolean;
  write: boolean;
  approve: boolean;
  me: string | null;
  userId: string;
  name: Localized<string>;
}

function access(scope: PayrollScope): Access {
  const base = { me: meOf(scope), userId: scope.userId, name: actor(scope) };
  if (scope.kind === 'organization') {
    if (!hasPermission(scope.role, 'hr.payroll.view')) forbidden();
    return { ...base, org: true, write: hasPermission(scope.role, 'hr.payroll.manage'), approve: hasPermission(scope.role, 'hr.payroll.approve') };
  }
  if (!hasPermission(scope.role, 'hr.payroll.view.own')) forbidden();
  return { ...base, org: false, write: false, approve: false };
}
const requireOrg = (a: Access) => !a.org && forbidden('hr.payroll.view is required');
const requireWrite = (a: Access) => !a.write && forbidden('hr.payroll.manage is required');

function data(): Db {
  if (!db) db = generate();
  return db;
}
function begin(scope: PayrollScope) {
  return { d: data(), a: access(scope) };
}

/* Compensation helpers ------------------------------------------------------------------------------------------------ */

function stateOf(from: string, to: string | null, today: string): RecordState {
  if (from > today) return 'scheduled';
  if (to !== null && to < today) return 'past';
  return 'current';
}

function compsOf(d: Db, employeeId: string) {
  return withDerivedEnds(d.comps.filter((c) => c.employeeId === employeeId));
}

function toRecord(d: Db, c: CompRow & { effectiveTo: string | null }, today = todayIso()): CompensationRecord {
  const s = d.structures.find((x) => x.id === c.structureId);
  return {
    id: c.id,
    employeeId: c.employeeId,
    structure: { id: c.structureId, code: s?.code ?? c.structureId, name: s?.name ?? { en: c.structureId, ar: c.structureId } },
    basicSalary: c.basicSalary,
    currency: c.currency,
    payFrequency: c.payFrequency,
    effectiveFrom: c.effectiveFrom,
    effectiveTo: c.effectiveTo,
    reason: c.reason,
    note: c.note,
    createdAt: c.createdAt,
    createdBy: c.createdBy,
    state: stateOf(c.effectiveFrom, c.effectiveTo, today),
  };
}

function compensationSummary(d: Db, e: Employee, today = todayIso()): EmployeeCompensationSummary {
  const records = compsOf(d, e.id).map((c) => toRecord(d, c, today));
  const current = records.find((r) => r.state === 'current') ?? null;
  const status: CompensationStatus = current ? 'active' : records.some((r) => r.state === 'scheduled') ? 'scheduled' : 'missing';
  return {
    employeeId: e.id,
    employee: { ...snapshot(e), employmentType: e.employmentType, status: e.status, hireDate: e.hireDate },
    current: current && { id: current.id, structure: current.structure, basicSalary: current.basicSalary, currency: current.currency, payFrequency: current.payFrequency, effectiveFrom: current.effectiveFrom },
    status,
  };
}

/** End of the latest approved / paid period that included the employee (changes may not reach into it). */
function lastFinalEnd(d: Db, employeeId: string): string | null {
  let last: string | null = null;
  for (const r of d.runs) if (FINAL_RUN_STATUSES.includes(r.status) && r.lines.some((l) => l.employeeId === employeeId) && (!last || r.periodEnd > last)) last = r.periodEnd;
  return last;
}

/* Assignment helpers --------------------------------------------------------------------------------------------------- */

function assignmentState(a: AssignmentRow, today: string): AssignmentState {
  if (a.effectiveFrom > today) return 'scheduled';
  if (a.recurrence === 'one-time') return monthOf(a.effectiveFrom) < monthOf(today) ? 'ended' : 'current';
  return a.effectiveTo !== null && a.effectiveTo < today ? 'ended' : 'current';
}

function toAllowance(d: Db, a: AssignmentRow, today = todayIso()): EmployeeAllowance {
  const t = d.allowanceTypes.find((x) => x.id === a.typeId);
  const { kind: _k, typeId: _t, ...rest } = a;
  return { ...rest, state: assignmentState(a, today), type: { id: a.typeId, code: t?.code ?? a.typeId, name: t?.name ?? { en: a.typeId, ar: a.typeId }, taxable: t?.taxable ?? false } };
}
function toDeduction(d: Db, a: AssignmentRow, today = todayIso()): EmployeeDeduction {
  const t = d.deductionTypes.find((x) => x.id === a.typeId);
  const { kind: _k, typeId: _t, ...rest } = a;
  return {
    ...rest,
    state: assignmentState(a, today),
    type: { id: a.typeId, code: t?.code ?? a.typeId, name: t?.name ?? { en: a.typeId, ar: a.typeId }, category: t?.category ?? 'other', maxAmount: t?.maxAmount ?? null, illustrative: t?.illustrative ?? false },
  };
}

const engineType = (t: AllowanceTypeRow | DeductionTypeRow): EngineItemType => ({
  code: t.code,
  name: t.name,
  category: 'category' in t ? t.category : null,
  maxAmount: 'maxAmount' in t ? t.maxAmount : null,
  illustrative: 'illustrative' in t ? t.illustrative : false,
});

/* Calculation ------------------------------------------------------------------------------------------------------------ */

/** Employees a run covers: current top-level department in scope, employed during the period. */
function runEmployees(run: Pick<RunRow, 'departmentId' | 'periodStart' | 'periodEnd'>): Employee[] {
  return employeeRecords
    .all()
    .filter((e) => (run.departmentId === null || topLevel(e.departmentId) === run.departmentId) && e.hireDate <= run.periodEnd && (lastDayOf(e) ?? '9999-12-31') >= run.periodStart)
    .sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
}

/** Gathers the engine input for one employee: compensation, assignments, policy types, approved leave, attendance. */
function engineInputFor(d: Db, run: Pick<RunRow, 'periodStart' | 'periodEnd' | 'currency'>, e: Employee) {
  const engineAssignment = (a: AssignmentRow, t: AllowanceTypeRow | DeductionTypeRow): EngineAssignment => ({
    id: a.id,
    type: engineType(t),
    calculation: a.calculation,
    amount: a.amount,
    percentage: a.percentage,
    currency: a.currency,
    recurrence: a.recurrence,
    effectiveFrom: a.effectiveFrom,
    effectiveTo: a.effectiveTo,
  });
  const mine = d.assignments.filter((a) => a.employeeId === e.id);
  const allowances = mine.flatMap((a) => {
    const t = a.kind === 'allowance' ? d.allowanceTypes.find((x) => x.id === a.typeId) : undefined;
    return t ? [engineAssignment(a, t)] : [];
  });
  const deductions = mine.flatMap((a) => {
    const t = a.kind === 'deduction' ? d.deductionTypes.find((x) => x.id === a.typeId) : undefined;
    return t ? [engineAssignment(a, t)] : [];
  });
  const active = d.deductionTypes.filter((t) => t.status === 'active');
  const statutory = active
    .filter((t) => t.category === 'statutory')
    .map<EngineAssignment>((t) => ({ id: t.id, type: engineType(t), calculation: t.calculation === 'percentage' ? 'percentage' : 'fixed', amount: t.amount, percentage: t.percentage, currency: t.currency, recurrence: 'recurring', effectiveFrom: '0000-01-01', effectiveTo: null }));
  const systemType = (category: 'unpaid-leave' | 'absence') => {
    const t = active.find((x) => x.category === category);
    return t ? engineType(t) : null;
  };
  const facts = attendanceFacts.forPeriod(e.id, run.periodStart, run.periodEnd);
  return {
    period: { start: run.periodStart, end: run.periodEnd },
    currency: run.currency,
    employee: { hireDate: e.hireDate, lastDay: lastDayOf(e) },
    compensation: compsOf(d, e.id).map((c) => ({ id: c.id, structureCode: d.structures.find((s) => s.id === c.structureId)?.code ?? c.structureId, basicSalary: c.basicSalary, currency: c.currency, effectiveFrom: c.effectiveFrom, effectiveTo: c.effectiveTo })),
    allowances,
    deductions,
    statutory,
    unpaidLeaveType: systemType('unpaid-leave'),
    absenceType: systemType('absence'),
    leave: leaveFacts.approvedInPeriod(e.id, run.periodStart, run.periodEnd).map((l) => ({ requestId: l.requestId, number: l.number, typeCode: l.leaveType.code, typeName: l.leaveType.name, paid: l.leaveType.paid, dates: l.dates })),
    attendance: {
      dataFrom: facts.dataFrom,
      dataTo: facts.dataTo,
      scheduledDays: facts.scheduledDays,
      present: facts.present,
      late: facts.late,
      absent: facts.absent,
      halfDay: facts.halfDay,
      incomplete: facts.incomplete,
      onLeave: facts.onLeave,
      lateMinutes: facts.lateMinutes,
      workedMinutes: facts.workedMinutes,
      minutesBeyondShift: facts.minutesBeyondShift,
      absentDates: facts.absentDates,
    },
    policy: { dailyRateDivisor: d.policy.dailyRateDivisor },
  };
}

const issueFor = (severity: RunIssue['severity'], code: string, e: Employee | null): RunIssue => ({ severity, code, employeeId: e?.id ?? null, employee: e ? { name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber } : null });

/** Runs the engine for every employee of the run (nothing is stored here). */
function computeRun(d: Db, run: RunRow): { lines: LineRow[]; issues: RunIssue[] } {
  const lines: LineRow[] = [];
  const issues: RunIssue[] = [];
  const others = d.runs.filter((r) => r.id !== run.id && BLOCKING_RUN_STATUSES.includes(r.status) && rangesOverlap(r.periodStart, r.periodEnd, run.periodStart, run.periodEnd));
  for (const e of runEmployees(run)) {
    // An employee who moved department may already be in another run for the period: never pay twice.
    if (others.some((r) => r.lines.some((l) => l.employeeId === e.id))) {
      issues.push(issueFor('warning', 'inAnotherRun', e));
      continue;
    }
    const result = calculateLine(engineInputFor(d, run, e));
    if (!result.included) {
      if (result.reason !== 'notEmployed') issues.push(issueFor('warning', result.reason, e));
      continue;
    }
    const top = topLevel(e.departmentId);
    lines.push({ employeeId: e.id, employee: snapshot(e), topDepartment: deptRef(top), currency: run.currency, ...result.line });
    for (const code of result.line.issues) if (code !== 'partialPeriod') issues.push(issueFor(code === 'negativeNet' ? 'error' : 'warning', code, e));
  }
  if (lines.length === 0) issues.unshift(issueFor('error', 'noEmployees', null));
  if (todayIso() < run.periodEnd) issues.unshift(issueFor('warning', 'periodNotEnded', null));
  return { lines, issues };
}

function totalsOf(lines: readonly LineRow[]) {
  return {
    employees: lines.length,
    basic: sumMinor(lines.map((l) => l.basic)),
    allowances: sumMinor(lines.map((l) => l.allowances)),
    overtime: sumMinor(lines.map((l) => l.overtime)),
    gross: sumMinor(lines.map((l) => l.gross)),
    deductions: sumMinor(lines.map((l) => l.deductions)),
    net: sumMinor(lines.map((l) => l.net)),
  };
}

function applyCalculation(d: Db, run: RunRow, by: Localized<string>, at: string) {
  const { lines, issues } = computeRun(d, run);
  const recalculated = run.calculatedAt !== null;
  run.history.push({ at, by, from: run.status, to: 'calculated', action: recalculated ? 'recalculated' : 'calculated', note: '' });
  run.lines = lines;
  run.issues = issues;
  run.totals = totalsOf(lines);
  run.calculatedAt = at;
  run.validatedAt = null;
  run.policy = { dailyRateDivisor: d.policy.dailyRateDivisor, rounding: d.policy.rounding, proration: d.policy.proration };
  run.status = 'calculated';
}

/** Re-checks the run against current data (`recheck` = false only while seeding, when nothing can have changed). */
function applyValidation(d: Db, run: RunRow, by: Localized<string>, at: string, recheck = true) {
  const fresh = recheck ? computeRun(d, run) : { lines: run.lines, issues: run.issues };
  const fingerprint = (lines: readonly LineRow[]) => lines.map((l) => `${l.employeeId}:${l.net}:${l.gross}`).join('|');
  const issues = [...fresh.issues];
  if (fingerprint(fresh.lines) !== fingerprint(run.lines)) issues.unshift(issueFor('warning', 'inputsChanged', null));
  run.issues = issues;
  run.validatedAt = at;
  run.history.push({ at, by, from: run.status, to: run.status, action: 'validated', note: '' });
}

/* Seed ------------------------------------------------------------------------------------------------------------------- */

function generate(): Db {
  const today = todayIso();
  const Y = Number(today.slice(0, 4));
  const thisMonth = monthOf(today);
  const d: Db = {
    policy: { dailyRateDivisor: 30, rounding: 'half-up-per-line', proration: 'calendar-days', allowNegativeNet: false, overtime: 'not-supported', updatedAt: CREATED, updatedBy: { en: 'System', ar: 'النظام' } },
    structures: STRUCTURE_SEED.map((s) => ({ ...s, name: { ...s.name }, employmentTypes: [...s.employmentTypes] })),
    comps: [],
    allowanceTypes: ALLOWANCE_TYPE_SEED.map((t) => ({ ...t, name: { ...t.name } })),
    deductionTypes: DEDUCTION_TYPE_SEED.map((t) => ({ ...t, name: { ...t.name } })),
    assignments: [],
    runs: [],
    payslips: [],
    seq: { comp: 0, assignment: 0, run: 0, structure: STRUCTURE_SEED.length, allowance: ALLOWANCE_TYPE_SEED.length, deduction: DEDUCTION_TYPE_SEED.length },
  };
  const hrEmp = empRow('emp-0002');
  const officerEmp = empRow('emp-0005');
  const hr = hrEmp ? employeeRecords.fullName(hrEmp) : { en: 'HR Administrator', ar: 'مسؤول الموارد البشرية' };
  const officer = officerEmp ? employeeRecords.fullName(officerEmp) : { en: 'Payroll Officer', ar: 'مسؤول الرواتب' };
  const at = (date: string, hour = 10) => {
    const [y, m, dd] = date.split('-').map(Number) as [number, number, number];
    const value = new Date(y, m - 1, dd, hour);
    return (value.getTime() > Date.now() ? new Date(Date.now() - 3_600_000) : value).toISOString();
  };
  const employees = employeeRecords.all();
  const newHireCutoff = addDays(today, -14);

  // Compensation history: hire record (+ an annual review on 1 January for earlier hires, a few scheduled promotions).
  const addComp = (e: Employee, structureId: string, basicSalary: Minor, effectiveFrom: string, reason: CompensationReason, note = '') => {
    d.seq.comp++;
    d.comps.push({ id: `cmp-${pad(d.seq.comp, 5)}`, employeeId: e.id, structureId, basicSalary, currency: BASE_CURRENCY, payFrequency: 'monthly', effectiveFrom, reason, note, createdAt: at(effectiveFrom < CREATED.slice(0, 10) ? CREATED.slice(0, 10) : addDays(effectiveFrom, -7) > today ? today : effectiveFrom, 9), createdBy: hr });
  };
  for (const e of employees) {
    if (e.hireDate >= newHireCutoff && e.status === 'active') continue; // new hires: compensation not set up yet
    const level = position(e.positionId)?.level ?? 'mid';
    const structureId = e.employmentType === 'part-time' ? 'sal-09' : e.employmentType === 'intern' ? 'sal-10' : (STRUCTURE_BY_LEVEL[level] ?? 'sal-03');
    const r = prng(hashString(`pay|${e.id}`));
    const [lo, hi] = BASIC_RANGE[structureId] ?? [900, 1400];
    const jod = lo + Math.floor(r() * ((hi - lo) / 5 + 1)) * 5;
    const fils = r() < 0.25 ? [250, 500, 750][Math.floor(r() * 3)]! : 0;
    const current = jod * 1000 + fils;
    const reviewDate = `${Y}-01-01`;
    if (e.hireDate < reviewDate) {
      addComp(e, structureId, Math.round((jod * 0.93) / 5) * 5 * 1000, e.hireDate, 'hire');
      addComp(e, structureId, current, reviewDate, 'annual-review');
    } else addComp(e, structureId, current, e.hireDate, 'hire');
    if (e.status === 'active' && r() < 0.03) addComp(e, structureId, Math.round((current * 1.06) / 1000) * 1000, monthStart(addMonths(thisMonth, 1)), 'promotion', 'Example scheduled change.');
  }

  // Allowance and deduction assignments.
  const assign = (kind: 'allowance' | 'deduction', e: Employee, typeId: string, effectiveFrom: string, effectiveTo: string | null, note = '') => {
    const t = (kind === 'allowance' ? d.allowanceTypes : d.deductionTypes).find((x) => x.id === typeId)!;
    d.seq.assignment++;
    const createdAt = at(effectiveFrom < CREATED.slice(0, 10) ? CREATED.slice(0, 10) : effectiveFrom, 9);
    d.assignments.push({
      id: `asg-${pad(d.seq.assignment, 5)}`,
      kind,
      employeeId: e.id,
      typeId,
      calculation: t.calculation === 'percentage' ? 'percentage' : 'fixed',
      amount: t.amount,
      percentage: t.percentage,
      currency: t.currency,
      recurrence: t.recurrence,
      effectiveFrom,
      effectiveTo: t.recurrence === 'one-time' ? null : effectiveTo,
      note,
      createdAt,
      history: [{ at: createdAt, by: hr, action: 'assigned', note }],
    });
  };
  const withComp = employees.filter((e) => d.comps.some((c) => c.employeeId === e.id));
  const senior = new Set(['senior', 'lead', 'manager', 'director', 'executive']);
  for (const e of withComp) {
    const end = lastDayOf(e);
    const top = topLevel(e.departmentId);
    assign('allowance', e, 'alw-02', e.hireDate, end);
    if (senior.has(position(e.positionId)?.level ?? '')) assign('allowance', e, 'alw-01', e.hireDate, end);
    if (top === 'dep-sales' || top === 'dep-support') assign('allowance', e, 'alw-03', e.hireDate, end);
    if (top === 'dep-ops') assign('allowance', e, 'alw-04', e.hireDate, end);
  }
  const ranked = withComp.filter((e) => e.status === 'active' && e.employmentType === 'full-time' && e.hireDate < `${Y - 1}-06-01`).sort((a, b) => hashString(`rank|${a.id}`) - hashString(`rank|${b.id}`));
  const lastMonth = addMonths(thisMonth, -1);
  for (const e of ranked.slice(0, 6)) assign('allowance', e, 'alw-05', `${lastMonth}-15`, null, 'Example one-time payment.');
  for (const e of ranked.slice(6, 14)) assign('deduction', e, 'ded-04', `${Y}-03-01`, `${Y + 1}-02-28`, 'Example loan (12 instalments).');
  const advance = ['dep-eng', 'dep-sales', 'dep-fin', 'dep-ops'].map((dep) => ranked.slice(14).find((e) => topLevel(e.departmentId) === dep)).filter((e): e is Employee => Boolean(e));
  for (const e of advance) assign('deduction', e, 'ded-03', monthStart(thisMonth), null, 'Example advance repayment.');

  // Payroll runs: 11 past months (organization-wide; paid, the last one approved) and this month's department runs.
  const makeRun = (month: string, departmentId: string | null, createdOn: string): RunRow => {
    d.seq.run++;
    const createdAt = at(createdOn, 9);
    return {
      id: `run-${pad(d.seq.run, 4)}`,
      number: `PR-${month.slice(0, 4)}-${pad(d.seq.run, 4)}`,
      periodStart: monthStart(month),
      periodEnd: monthEnd(month),
      paymentDate: monthEnd(month),
      payFrequency: 'monthly',
      departmentId,
      currency: BASE_CURRENCY,
      status: 'draft',
      createdAt,
      createdBy: { userId: 'usr-0007', name: officer },
      calculatedAt: null,
      validatedAt: null,
      issues: [],
      totals: null,
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      paidAt: null,
      paidBy: null,
      cancelledAt: null,
      cancellationReason: null,
      policy: null,
      history: [{ at: createdAt, by: officer, from: null, to: 'draft', action: 'created', note: '' }],
      lines: [],
    };
  };
  const progress = (run: RunRow, steps: Array<'calculate' | 'validate' | 'submit' | 'approve' | 'reject' | 'pay' | 'cancel'>, day: string) => {
    let hour = 10;
    for (const step of steps) {
      const when = at(day, hour++);
      if (step === 'calculate') applyCalculation(d, run, officer, when);
      else if (step === 'validate') applyValidation(d, run, officer, when, false);
      else if (step === 'submit') {
        run.history.push({ at: when, by: officer, from: run.status, to: 'pending-approval', action: 'submitted', note: '' });
        Object.assign(run, { status: 'pending-approval', submittedAt: when, submittedBy: officer });
      } else if (step === 'approve') {
        run.history.push({ at: when, by: hr, from: run.status, to: 'approved', action: 'approved', note: '' });
        Object.assign(run, { status: 'approved', approvedAt: when, approvedBy: hr });
        issuePayslips(d, run, undefined, officer, when);
      } else if (step === 'reject') {
        run.history.push({ at: when, by: hr, from: run.status, to: 'rejected', action: 'rejected', note: REJECTION_REASON });
        Object.assign(run, { status: 'rejected', rejectedAt: when, rejectedBy: hr, rejectionReason: REJECTION_REASON });
      } else if (step === 'pay') {
        run.history.push({ at: when, by: officer, from: run.status, to: 'paid', action: 'paid', note: '' });
        Object.assign(run, { status: 'paid', paidAt: when, paidBy: officer });
      } else {
        run.history.push({ at: when, by: officer, from: run.status, to: 'cancelled', action: 'cancelled', note: CANCELLATION_REASON });
        Object.assign(run, { status: 'cancelled', cancelledAt: when, cancellationReason: CANCELLATION_REASON });
      }
    }
  };
  for (let i = 11; i >= 1; i--) {
    const month = addMonths(thisMonth, -i);
    const run = makeRun(month, null, addDays(monthEnd(month), -8));
    d.runs.push(run);
    progress(run, ['calculate', 'validate', 'submit'], addDays(monthEnd(month), -6));
    progress(run, ['approve'], addDays(monthEnd(month), -3));
    if (i > 1) progress(run, ['pay'], monthEnd(month));
  }
  const day = (n: number) => addDays(today, -n);
  const current: Array<[string, Array<'calculate' | 'validate' | 'submit' | 'reject' | 'cancel'>, number]> = [
    ['dep-eng', ['calculate', 'validate', 'submit'], 2],
    ['dep-sales', ['calculate'], 1],
    ['dep-fin', ['calculate', 'validate', 'submit', 'reject'], 3],
    ['dep-ops', [], 1],
    ['dep-support', ['cancel'], 4],
  ];
  for (const [dep, steps, ago] of current) {
    if (!department(dep)) continue;
    const run = makeRun(thisMonth, dep, day(ago + 1));
    d.runs.push(run);
    progress(run, steps, day(ago));
  }
  return d;
}

/* Payslip issuing ------------------------------------------------------------------------------------------------------------ */

function issuePayslips(d: Db, run: RunRow, employeeIds: readonly string[] | undefined, by: Localized<string>, at: string): number {
  let count = 0;
  for (const line of run.lines) {
    if (employeeIds && !employeeIds.includes(line.employeeId)) continue;
    if (d.payslips.some((p) => p.runId === run.id && p.employeeId === line.employeeId)) continue;
    d.payslips.push({
      id: `ps-${run.id.slice(4)}-${line.employeeId.slice(4)}`,
      number: `PS-${monthOf(run.periodStart)}-${line.employee.employeeNumber}`,
      runId: run.id,
      runNumber: run.number,
      employeeId: line.employeeId,
      employee: line.employee,
      company: COMPANY,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      paymentDate: run.paymentDate,
      currency: line.currency,
      basic: line.basic,
      allowances: line.allowances,
      overtime: line.overtime,
      gross: line.gross,
      deductions: line.deductions,
      net: line.net,
      earnings: line.earnings,
      deductionItems: line.deductionItems,
      generatedAt: at,
      generatedBy: by,
    });
    count++;
  }
  if (count > 0) run.history.push({ at, by, from: run.status, to: run.status, action: 'payslips', note: String(count) });
  return count;
}

/* Policy ------------------------------------------------------------------------------------------------------------------------ */

export function getPolicy(scope: PayrollScope): PayrollPolicy {
  const { d, a } = begin(scope);
  requireOrg(a);
  return d.policy;
}

export function updatePolicy(input: PolicyInput, scope: PayrollScope): PayrollPolicy {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const errors = validatePolicyInput(input);
  if (errors) invalid(errors);
  d.policy = { ...d.policy, dailyRateDivisor: input.dailyRateDivisor, updatedAt: nowIso(), updatedBy: a.name };
  return d.policy;
}

/* Salary structures --------------------------------------------------------------------------------------------------------------- */

function toStructure(d: Db, s: StructureRow): SalaryStructure {
  const today = todayIso();
  const assigned = new Set(d.comps.filter((c) => c.structureId === s.id).map((c) => c.employeeId));
  let count = 0;
  for (const id of assigned) if (compsOf(d, id).some((c) => c.structureId === s.id && stateOf(c.effectiveFrom, c.effectiveTo, today) === 'current')) count++;
  return { ...s, assignedEmployees: count };
}

export function listStructures(params: ListParams<StructureFilters>, scope: PayrollScope): Paginated<SalaryStructure> {
  const { d, a } = begin(scope);
  requireOrg(a);
  const f = params.filters ?? {};
  const rows = d.structures.filter((s) => (!f.status || s.status === f.status) && (!f.currency || s.currency === f.currency)).map((s) => toStructure(d, s));
  return page(rows, params, { search: (s) => `${s.code} ${nameSearch(s.name)}`, sort: (s, field) => (field === 'name.en' ? s.name.en : field === 'name.ar' ? s.name.ar : (s as unknown as Record<string, unknown>)[field]) });
}

export function getStructure(id: string, scope: PayrollScope): SalaryStructure {
  const { d, a } = begin(scope);
  requireOrg(a);
  const s = d.structures.find((x) => x.id === id) ?? notFound('Structure', id);
  return toStructure(d, s);
}

function checkStructure(d: Db, input: SalaryStructureInput, exceptId?: string) {
  const errors = validateStructureInput(input) ?? {};
  if (d.structures.some((s) => s.id !== exceptId && s.code.toUpperCase() === input.code?.toUpperCase())) errors.code = [...(errors.code ?? []), 'duplicateCode'];
  if (Object.keys(errors).length) invalid(errors);
}

export function createStructure(input: SalaryStructureInput, scope: PayrollScope): SalaryStructure {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  checkStructure(d, input);
  d.seq.structure++;
  const row: StructureRow = { ...input, id: `sal-${pad(d.seq.structure, 2)}`, status: 'active', createdAt: nowIso() };
  d.structures.push(row);
  return toStructure(d, row);
}

export function updateStructure(id: string, input: SalaryStructureInput, scope: PayrollScope): SalaryStructure {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const s = d.structures.find((x) => x.id === id) ?? notFound('Structure', id);
  checkStructure(d, input, id);
  // Salary records keep their own amount and currency; the currency of a structure in use cannot change.
  if (input.currency !== s.currency && d.comps.some((c) => c.structureId === id)) invalid({ currency: ['structureInUse'] });
  Object.assign(s, input);
  return toStructure(d, s);
}

export function updateStructureStatus(id: string, status: RecordStatus, scope: PayrollScope): SalaryStructure {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const s = d.structures.find((x) => x.id === id) ?? notFound('Structure', id);
  if (s.status === status) conflict('Status unchanged');
  // Deactivation stops NEW assignments only: existing salary records keep their history and stay in force.
  s.status = status;
  return toStructure(d, s);
}

/* Employee compensation ------------------------------------------------------------------------------------------------------------ */

export function listCompensation(params: ListParams<CompensationFilters>, scope: PayrollScope): Paginated<EmployeeCompensationSummary> {
  const { d, a } = begin(scope);
  requireOrg(a);
  const f = params.filters ?? {};
  const today = todayIso();
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const rows = employeeRecords
    .all()
    .filter((e) => (!units || units.has(e.departmentId)) && (!f.locationId || e.locationId === f.locationId) && (!f.employmentStatus || e.status === f.employmentStatus))
    .map((e) => compensationSummary(d, e, today))
    .filter((r) => (!f.status || r.status === f.status) && (!f.structureId || r.current?.structure.id === f.structureId));
  return page(rows, params, {
    search: (r) => nameSearch(r.employee.name, r.employee.employeeNumber),
    sort: (r, field) =>
      field === 'employee.name.en' ? r.employee.name.en : field === 'employee.name.ar' ? r.employee.name.ar : field === 'employee.employeeNumber' ? r.employee.employeeNumber : field === 'basicSalary' ? (r.current?.basicSalary ?? null) : field === 'effectiveFrom' ? (r.current?.effectiveFrom ?? null) : r.status,
  });
}

function compensationDetail(d: Db, e: Employee, a: Access): EmployeeCompensationDetail {
  const today = todayIso();
  const history = compsOf(d, e.id)
    .map((c) => toRecord(d, c, today))
    .reverse();
  return {
    ...compensationSummary(d, e, today),
    history,
    allowances: d.assignments.filter((x) => x.kind === 'allowance' && x.employeeId === e.id).map((x) => toAllowance(d, x, today)).reverse(),
    deductions: d.assignments.filter((x) => x.kind === 'deduction' && x.employeeId === e.id).map((x) => toDeduction(d, x, today)).reverse(),
    can: { update: a.write && e.status === 'active' },
  };
}

export function getCompensation(employeeId: string, scope: PayrollScope): EmployeeCompensationDetail {
  const { d, a } = begin(scope);
  requireOrg(a);
  const e = empRow(employeeId) ?? notFound('Employee', employeeId);
  return compensationDetail(d, e, a);
}

export function salaryHistory(employeeId: string, scope: PayrollScope): CompensationRecord[] {
  const { d, a } = begin(scope);
  if (!a.org && employeeId !== a.me) forbidden();
  if (!empRow(employeeId)) notFound('Employee', employeeId);
  const today = todayIso();
  return compsOf(d, employeeId)
    .map((c) => toRecord(d, c, today))
    .reverse();
}

/** Every salary change is a NEW record (assigning a structure is the same operation); history is never overwritten. */
export function updateCompensation(employeeId: string, input: CompensationInput, scope: PayrollScope): EmployeeCompensationDetail {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const e = empRow(employeeId) ?? notFound('Employee', employeeId);
  const errors = validateCompensationInput(input) ?? {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  const s = d.structures.find((x) => x.id === input.structureId);
  if (!s) add('structureId', 'required');
  else if (s.status !== 'active') add('structureId', 'structureInactive');
  else if (!s.employmentTypes.includes(e.employmentType)) add('structureId', 'employmentTypeNotAllowed');
  if (e.status !== 'active') add('effectiveFrom', 'inactiveEmployee');
  if (input.effectiveFrom < e.hireDate) add('effectiveFrom', 'beforeHire');
  const latest = compsOf(d, employeeId).at(-1);
  if (latest && input.effectiveFrom <= latest.effectiveFrom) add('effectiveFrom', 'overlapsExisting');
  const closed = lastFinalEnd(d, employeeId);
  if (closed && input.effectiveFrom <= closed) add('effectiveFrom', 'periodClosed');
  if (Object.keys(errors).length) invalid(errors);
  d.seq.comp++;
  d.comps.push({ id: `cmp-${pad(d.seq.comp, 5)}`, employeeId, structureId: s!.id, basicSalary: input.basicSalary, currency: s!.currency, payFrequency: s!.payFrequency, effectiveFrom: input.effectiveFrom, reason: input.reason, note: input.note.trim(), createdAt: nowIso(), createdBy: a.name });
  return compensationDetail(d, e, a);
}

/* Allowance and deduction types ------------------------------------------------------------------------------------------------------ */

function assignedCount(d: Db, kind: 'allowance' | 'deduction', typeId: string): number {
  const today = todayIso();
  return new Set(d.assignments.filter((x) => x.kind === kind && x.typeId === typeId && assignmentState(x, today) === 'current').map((x) => x.employeeId)).size;
}
const toAllowanceType = (d: Db, t: AllowanceTypeRow): AllowanceType => ({ ...t, assignedEmployees: assignedCount(d, 'allowance', t.id) });
function toDeductionType(d: Db, t: DeductionTypeRow): DeductionType {
  // Statutory and system types apply to everyone in a run while active (no individual assignment).
  return { ...t, assignedEmployees: assignedCount(d, 'deduction', t.id) };
}

const typeSort = (t: { code: string; name: Localized<string>; status: string; assignedEmployees: number }, field: string) => (field === 'name.en' ? t.name.en : field === 'name.ar' ? t.name.ar : field === 'status' ? t.status : field === 'assignedEmployees' ? t.assignedEmployees : t.code);

export function listAllowanceTypes(params: ListParams<TypeFilters>, scope: PayrollScope): Paginated<AllowanceType> {
  const { d, a } = begin(scope);
  requireOrg(a);
  const rows = d.allowanceTypes.filter((t) => !params.filters?.status || t.status === params.filters.status).map((t) => toAllowanceType(d, t));
  return page(rows, params, { search: (t) => `${t.code} ${nameSearch(t.name)}`, sort: typeSort });
}

function checkCode(list: ReadonlyArray<{ id: string; code: string }>, code: string, exceptId: string | undefined, errors: FieldErrors) {
  if (list.some((t) => t.id !== exceptId && t.code.toUpperCase() === code?.toUpperCase())) errors.code = [...(errors.code ?? []), 'duplicateCode'];
}

export function createAllowanceType(input: AllowanceTypeInput, scope: PayrollScope): AllowanceType {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const errors = validateAllowanceTypeInput(input) ?? {};
  checkCode(d.allowanceTypes, input.code, undefined, errors);
  if (Object.keys(errors).length) invalid(errors);
  d.seq.allowance++;
  const row: AllowanceTypeRow = { ...input, amount: input.calculation === 'fixed' ? input.amount : null, percentage: input.calculation === 'percentage' ? input.percentage : null, id: `alw-${pad(d.seq.allowance, 2)}`, status: 'active', createdAt: nowIso() };
  d.allowanceTypes.push(row);
  return toAllowanceType(d, row);
}

export function updateAllowanceType(id: string, input: AllowanceTypeInput, scope: PayrollScope): AllowanceType {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const t = d.allowanceTypes.find((x) => x.id === id) ?? notFound('Allowance type', id);
  const errors = validateAllowanceTypeInput(input) ?? {};
  checkCode(d.allowanceTypes, input.code, id, errors);
  if (Object.keys(errors).length) invalid(errors);
  // Existing assignments keep the values they were made with; the new values apply to new assignments.
  Object.assign(t, { ...input, amount: input.calculation === 'fixed' ? input.amount : null, percentage: input.calculation === 'percentage' ? input.percentage : null });
  return toAllowanceType(d, t);
}

function hasOpenAssignments(d: Db, kind: 'allowance' | 'deduction', typeId: string) {
  const today = todayIso();
  return d.assignments.some((x) => x.kind === kind && x.typeId === typeId && assignmentState(x, today) !== 'ended');
}

export function updateAllowanceTypeStatus(id: string, status: RecordStatus, scope: PayrollScope): AllowanceType {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const t = d.allowanceTypes.find((x) => x.id === id) ?? notFound('Allowance type', id);
  if (t.status === status) conflict('Status unchanged');
  if (status === 'inactive' && hasOpenAssignments(d, 'allowance', id)) invalid({ status: ['typeInUse'] });
  t.status = status;
  return toAllowanceType(d, t);
}

export function listDeductionTypes(params: ListParams<TypeFilters>, scope: PayrollScope): Paginated<DeductionType> {
  const { d, a } = begin(scope);
  requireOrg(a);
  const rows = d.deductionTypes.filter((t) => !params.filters?.status || t.status === params.filters.status).map((t) => toDeductionType(d, t));
  return page(rows, params, { search: (t) => `${t.code} ${nameSearch(t.name)}`, sort: typeSort });
}

const isSystem = (category: DeductionType['category']) => SYSTEM_DEDUCTION_CATEGORIES.includes(category);

export function createDeductionType(input: DeductionTypeInput, scope: PayrollScope): DeductionType {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const errors = validateDeductionTypeInput(input) ?? {};
  checkCode(d.deductionTypes, input.code, undefined, errors);
  if (Object.keys(errors).length) invalid(errors);
  d.seq.deduction++;
  // New statutory / system types start INACTIVE: they apply to every employee once explicitly enabled.
  const policyType = input.category === 'statutory' || isSystem(input.category);
  const row: DeductionTypeRow = {
    ...input,
    amount: input.calculation === 'fixed' ? input.amount : null,
    percentage: input.calculation === 'percentage' ? input.percentage : null,
    illustrative: input.category === 'statutory',
    id: `ded-${pad(d.seq.deduction, 2)}`,
    status: policyType ? 'inactive' : 'active',
    createdAt: nowIso(),
  };
  d.deductionTypes.push(row);
  return toDeductionType(d, row);
}

export function updateDeductionType(id: string, input: DeductionTypeInput, scope: PayrollScope): DeductionType {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const t = d.deductionTypes.find((x) => x.id === id) ?? notFound('Deduction type', id);
  const errors = validateDeductionTypeInput(input) ?? {};
  checkCode(d.deductionTypes, input.code, id, errors);
  if (input.category !== t.category) errors.category = [...(errors.category ?? []), 'categoryLocked'];
  if (Object.keys(errors).length) invalid(errors);
  Object.assign(t, { ...input, amount: input.calculation === 'fixed' ? input.amount : null, percentage: input.calculation === 'percentage' ? input.percentage : null, illustrative: input.category === 'statutory' });
  return toDeductionType(d, t);
}

export function updateDeductionTypeStatus(id: string, status: RecordStatus, scope: PayrollScope): DeductionType {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const t = d.deductionTypes.find((x) => x.id === id) ?? notFound('Deduction type', id);
  if (t.status === status) conflict('Status unchanged');
  if (status === 'inactive' && hasOpenAssignments(d, 'deduction', id)) invalid({ status: ['typeInUse'] });
  // One active type per system cause, so the same leave or absence day is never deducted twice.
  if (status === 'active' && isSystem(t.category) && d.deductionTypes.some((x) => x.id !== id && x.status === 'active' && x.category === t.category)) invalid({ status: ['duplicateSystemType'] });
  t.status = status;
  return toDeductionType(d, t);
}

/* Assignments ------------------------------------------------------------------------------------------------------------------------- */

export function employeeAllowances(employeeId: string, scope: PayrollScope): EmployeeAllowance[] {
  const { d, a } = begin(scope);
  if (!a.org && employeeId !== a.me) forbidden();
  return d.assignments.filter((x) => x.kind === 'allowance' && x.employeeId === employeeId).map((x) => toAllowance(d, x)).reverse();
}

export function employeeDeductions(employeeId: string, scope: PayrollScope): EmployeeDeduction[] {
  const { d, a } = begin(scope);
  if (!a.org && employeeId !== a.me) forbidden();
  return d.assignments.filter((x) => x.kind === 'deduction' && x.employeeId === employeeId).map((x) => toDeduction(d, x)).reverse();
}

function assign(kind: 'allowance' | 'deduction', employeeId: string, input: AssignmentInput, scope: PayrollScope): AssignmentRow {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const e = empRow(employeeId) ?? notFound('Employee', employeeId);
  const type = kind === 'allowance' ? d.allowanceTypes.find((t) => t.id === input.typeId) : d.deductionTypes.find((t) => t.id === input.typeId);
  if (!type) invalid({ typeId: ['required'] });
  if ('category' in type && (isSystem(type.category) || type.category === 'statutory')) invalid({ typeId: ['notAssignable'] });
  const calculation: CalculationType = type.calculation === 'percentage' ? 'percentage' : 'fixed';
  const errors = validateAssignmentInput(input, calculation) ?? {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  if (type.status !== 'active') add('typeId', 'typeInactive');
  if (e.status !== 'active') add('effectiveFrom', 'inactiveEmployee');
  if (input.effectiveFrom < e.hireDate) add('effectiveFrom', 'beforeHire');
  const end = type.recurrence === 'one-time' ? input.effectiveFrom : input.effectiveTo;
  const today = todayIso();
  const clash = d.assignments.some((x) => x.kind === kind && x.employeeId === employeeId && x.typeId === type.id && assignmentState(x, today) !== 'ended' && rangesOverlap(x.effectiveFrom, x.recurrence === 'one-time' ? x.effectiveFrom : x.effectiveTo, input.effectiveFrom, end));
  if (clash) add('effectiveFrom', 'overlapsExisting');
  const closed = lastFinalEnd(d, employeeId);
  if (closed && input.effectiveFrom <= closed) add('effectiveFrom', 'periodClosed');
  if (Object.keys(errors).length) invalid(errors);
  d.seq.assignment++;
  const createdAt = nowIso();
  const row: AssignmentRow = {
    id: `asg-${pad(d.seq.assignment, 5)}`,
    kind,
    employeeId,
    typeId: type.id,
    calculation,
    amount: calculation === 'fixed' ? input.amount : null,
    percentage: calculation === 'percentage' ? input.percentage : null,
    currency: type.currency,
    recurrence: type.recurrence,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: type.recurrence === 'one-time' ? null : input.effectiveTo,
    note: input.note.trim(),
    createdAt,
    history: [{ at: createdAt, by: a.name, action: 'assigned', note: input.note.trim() }],
  };
  d.assignments.push(row);
  return row;
}

export function assignAllowance(employeeId: string, input: AssignmentInput, scope: PayrollScope): EmployeeAllowance {
  return toAllowance(data(), assign('allowance', employeeId, input, scope));
}

export function assignDeduction(employeeId: string, input: AssignmentInput, scope: PayrollScope): EmployeeDeduction {
  return toDeduction(data(), assign('deduction', employeeId, input, scope));
}

/** Ends a recurring assignment (its amounts and dates are otherwise never edited). */
export function endAssignment(id: string, endDate: string, note: string, scope: PayrollScope): EmployeeAllowance | EmployeeDeduction {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const row = d.assignments.find((x) => x.id === id) ?? notFound('Assignment', id);
  const today = todayIso();
  if (row.recurrence === 'one-time' || assignmentState(row, today) === 'ended') conflict('Assignment cannot be ended');
  const errors: FieldErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < row.effectiveFrom) errors.endDate = ['endBeforeStart'];
  else if (row.effectiveTo !== null && endDate >= row.effectiveTo) errors.endDate = ['notEarlier'];
  const closed = lastFinalEnd(d, row.employeeId);
  if (closed && endDate < closed) errors.endDate = [...(errors.endDate ?? []), 'periodClosed'];
  if (Object.keys(errors).length) invalid(errors);
  row.effectiveTo = endDate;
  row.history.push({ at: nowIso(), by: a.name, action: 'ended', note: note.trim() });
  return row.kind === 'allowance' ? toAllowance(d, row) : toDeduction(d, row);
}

/* Runs ------------------------------------------------------------------------------------------------------------------------------- */

function toRun(d: Db, r: RunRow, a: Access): PayrollRun {
  const { lines, departmentId, ...rest } = r;
  const write = a.write;
  const pending = r.status === 'pending-approval';
  const own = r.createdBy.userId === a.userId;
  const errors = r.issues.some((i) => i.severity === 'error');
  const generated = d.payslips.filter((p) => p.runId === r.id).length;
  const validated = r.validatedAt !== null && r.calculatedAt !== null && r.validatedAt >= r.calculatedAt;
  return {
    ...rest,
    department: departmentId ? deptRef(departmentId) : null,
    payslipsGenerated: generated,
    can: {
      edit: write && EDITABLE_RUN_STATUSES.includes(r.status),
      calculate: write && CALCULABLE_RUN_STATUSES.includes(r.status),
      validate: write && r.status === 'calculated',
      submit: write && r.status === 'calculated' && validated && !errors,
      approve: a.approve && pending && !own,
      reject: a.approve && pending && !own,
      markPaid: write && r.status === 'approved',
      cancel: write && CANCELLABLE_RUN_STATUSES.includes(r.status),
      generatePayslips: write && FINAL_RUN_STATUSES.includes(r.status) && generated < lines.length,
    },
    approvalBlockedReason: a.approve && pending && own ? 'ownRun' : null,
  };
}

function toRunSummary(d: Db, r: RunRow, a: Access): RunSummary {
  const { history: _h, issues, ...rest } = toRun(d, r, a);
  return { ...rest, errorCount: issues.filter((i) => i.severity === 'error').length, warningCount: issues.filter((i) => i.severity === 'warning').length };
}

const findRun = (d: Db, id: string) => d.runs.find((r) => r.id === id) ?? notFound('Payroll run', id);

export function listRuns(params: ListParams<RunFilters>, scope: PayrollScope): Paginated<RunSummary> {
  const { d, a } = begin(scope);
  requireOrg(a);
  const f = params.filters ?? {};
  const rows = d.runs
    .filter((r) => (!f.status || r.status === f.status) && (!f.departmentId || r.departmentId === f.departmentId) && (!f.month || (isMonth(f.month) && rangesOverlap(r.periodStart, r.periodEnd, monthStart(f.month), monthEnd(f.month)))))
    .sort((x, y) => y.periodStart.localeCompare(x.periodStart) || y.number.localeCompare(x.number))
    .map((r) => toRunSummary(d, r, a));
  return page(rows, params, { search: (r) => `${r.number} ${r.department ? nameSearch(r.department.name) : ''}`, sort: (r, field) => (field === 'totals.net' ? (r.totals?.net ?? null) : (r as unknown as Record<string, unknown>)[field]) });
}

export function getRun(id: string, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  return toRun(d, findRun(d, id), a);
}

function checkRunInput(d: Db, input: RunInput, exceptId?: string) {
  const errors = validateRunInput(input) ?? {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  if (input.departmentId !== null) {
    const dep = department(input.departmentId);
    if (!dep || dep.parentId !== null) add('departmentId', 'topLevelOnly');
    else if (dep.status !== 'active') add('departmentId', 'departmentInactive');
  }
  // No two non-cancelled runs over the same employees for overlapping periods.
  const duplicate = d.runs.some(
    (r) => r.id !== exceptId && BLOCKING_RUN_STATUSES.includes(r.status) && rangesOverlap(r.periodStart, r.periodEnd, input.periodStart, input.periodEnd) && (r.departmentId === null || input.departmentId === null || r.departmentId === input.departmentId),
  );
  if (duplicate) add('month', 'duplicatePeriod');
  if (Object.keys(errors).length) invalid(errors);
}

export function createRun(input: RunInput, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  checkRunInput(d, input);
  d.seq.run++;
  const createdAt = nowIso();
  const row: RunRow = {
    id: `run-${pad(d.seq.run, 4)}`,
    number: `PR-${input.periodStart.slice(0, 4)}-${pad(d.seq.run, 4)}`,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    paymentDate: input.paymentDate,
    payFrequency: input.payFrequency,
    departmentId: input.departmentId,
    currency: input.currency,
    status: 'draft',
    createdAt,
    createdBy: { userId: a.userId, name: a.name },
    calculatedAt: null,
    validatedAt: null,
    issues: [],
    totals: null,
    submittedAt: null,
    submittedBy: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    paidAt: null,
    paidBy: null,
    cancelledAt: null,
    cancellationReason: null,
    policy: null,
    history: [{ at: createdAt, by: a.name, from: null, to: 'draft', action: 'created', note: '' }],
    lines: [],
  };
  d.runs.push(row);
  return toRun(d, row, a);
}

/** Edits a draft or rejected run (a rejected run returns to draft and its calculation is discarded). */
export function updateRun(id: string, input: RunInput, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (!EDITABLE_RUN_STATUSES.includes(r.status)) invalid({ status: ['notEditable'] });
  checkRunInput(d, input, id);
  const at = nowIso();
  r.history.push({ at, by: a.name, from: r.status, to: 'draft', action: 'edited', note: '' });
  Object.assign(r, { periodStart: input.periodStart, periodEnd: input.periodEnd, paymentDate: input.paymentDate, payFrequency: input.payFrequency, departmentId: input.departmentId, currency: input.currency, status: 'draft', lines: [], totals: null, issues: [], calculatedAt: null, validatedAt: null, policy: null });
  return toRun(d, r, a);
}

export function calculateRun(id: string, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (!CALCULABLE_RUN_STATUSES.includes(r.status)) invalid({ status: ['notCalculable'] });
  applyCalculation(d, r, a.name, nowIso());
  return toRun(d, r, a);
}

export function validateRun(id: string, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (r.status !== 'calculated') invalid({ status: ['notCalculated'] });
  applyValidation(d, r, a.name, nowIso());
  return toRun(d, r, a);
}

export function submitRun(id: string, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (r.status !== 'calculated') invalid({ status: ['notCalculated'] });
  if (r.validatedAt === null || (r.calculatedAt !== null && r.validatedAt < r.calculatedAt)) invalid({ status: ['notValidated'] });
  if (r.issues.some((i) => i.severity === 'error')) invalid({ status: ['hasErrors'] });
  const at = nowIso();
  r.history.push({ at, by: a.name, from: r.status, to: 'pending-approval', action: 'submitted', note: '' });
  Object.assign(r, { status: 'pending-approval', submittedAt: at, submittedBy: a.name });
  return toRun(d, r, a);
}

function decide(id: string, scope: PayrollScope) {
  const { d, a } = begin(scope);
  requireOrg(a);
  if (!a.approve) forbidden('hr.payroll.approve is required');
  const r = findRun(d, id);
  if (r.status !== 'pending-approval') invalid({ status: ['notPending'] });
  // Segregation of duties: the creator of a run never approves or rejects it (no permission allows it).
  if (r.createdBy.userId === a.userId) invalid({ status: ['ownRun'] });
  return { d, a, r };
}

export function approveRun(id: string, scope: PayrollScope): PayrollRun {
  const { d, a, r } = decide(id, scope);
  const at = nowIso();
  r.history.push({ at, by: a.name, from: r.status, to: 'approved', action: 'approved', note: '' });
  Object.assign(r, { status: 'approved', approvedAt: at, approvedBy: a.name });
  return toRun(d, r, a);
}

export function rejectRun(id: string, reason: string, scope: PayrollScope): PayrollRun {
  const errors = validateReason(reason);
  if (errors) invalid(errors);
  const { d, a, r } = decide(id, scope);
  const at = nowIso();
  r.history.push({ at, by: a.name, from: r.status, to: 'rejected', action: 'rejected', note: reason.trim() });
  Object.assign(r, { status: 'rejected', rejectedAt: at, rejectedBy: a.name, rejectionReason: reason.trim() });
  return toRun(d, r, a);
}

/** SIMULATED administrative record: no bank transfer or payment is made. */
export function markRunPaid(id: string, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (r.status !== 'approved') invalid({ status: ['notApproved'] });
  const at = nowIso();
  r.history.push({ at, by: a.name, from: r.status, to: 'paid', action: 'paid', note: '' });
  Object.assign(r, { status: 'paid', paidAt: at, paidBy: a.name });
  return toRun(d, r, a);
}

export function cancelRun(id: string, reason: string, scope: PayrollScope): PayrollRun {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (!CANCELLABLE_RUN_STATUSES.includes(r.status)) invalid({ status: ['notCancellable'] });
  const errors = validateReason(reason);
  if (errors) invalid(errors);
  const at = nowIso();
  r.history.push({ at, by: a.name, from: r.status, to: 'cancelled', action: 'cancelled', note: reason.trim() });
  Object.assign(r, { status: 'cancelled', cancelledAt: at, cancellationReason: reason.trim() });
  return toRun(d, r, a);
}

function lineOf(d: Db, r: RunRow, l: LineRow): PayrollLine {
  return { ...l, runId: r.id, payslipId: d.payslips.find((p) => p.runId === r.id && p.employeeId === l.employeeId)?.id ?? null };
}

export function runLines(id: string, params: ListParams<LineFilters>, scope: PayrollScope): Paginated<LineSummary> {
  const { d, a } = begin(scope);
  requireOrg(a);
  const r = findRun(d, id);
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const rows = r.lines
    .filter((l) => (!f.status || l.status === f.status) && (!units || units.has(l.employee.department.id)))
    .map((l) => {
      const { earnings: _e, deductionItems: _d, inputs: _i, ...rest } = lineOf(d, r, l);
      return rest;
    });
  return page(rows, params, {
    search: (l) => nameSearch(l.employee.name, l.employee.employeeNumber),
    sort: (l, field) => (field === 'employee.name.en' ? l.employee.name.en : field === 'employee.name.ar' ? l.employee.name.ar : field === 'employee.employeeNumber' ? l.employee.employeeNumber : (l as unknown as Record<string, unknown>)[field]),
  });
}

export function runLine(id: string, employeeId: string, scope: PayrollScope): PayrollLine & { run: Pick<PayrollRun, 'id' | 'number' | 'status' | 'periodStart' | 'periodEnd' | 'paymentDate' | 'currency'> } {
  const { d, a } = begin(scope);
  requireOrg(a);
  const r = findRun(d, id);
  const l = r.lines.find((x) => x.employeeId === employeeId) ?? notFound('Payroll line', employeeId);
  return { ...lineOf(d, r, l), run: { id: r.id, number: r.number, status: r.status, periodStart: r.periodStart, periodEnd: r.periodEnd, paymentDate: r.paymentDate, currency: r.currency } };
}

/** Payslips come only from approved or paid runs (all lines, or the listed employees). Already issued ones are kept. */
export function generatePayslips(id: string, employeeIds: string[] | undefined, scope: PayrollScope): { run: PayrollRun; generated: number } {
  const { d, a } = begin(scope);
  requireOrg(a);
  requireWrite(a);
  const r = findRun(d, id);
  if (!FINAL_RUN_STATUSES.includes(r.status)) invalid({ status: ['notApproved'] });
  const generated = issuePayslips(d, r, employeeIds, a.name, nowIso());
  return { run: toRun(d, r, a), generated };
}

/* Payslips ------------------------------------------------------------------------------------------------------------------------------- */

function toPayslip(d: Db, p: PayslipRow): Payslip {
  const run = d.runs.find((r) => r.id === p.runId);
  return { ...p, paymentStatus: run?.status === 'paid' ? 'paid' : 'approved' };
}
function toPayslipSummary(d: Db, p: PayslipRow): PayslipSummary {
  const { earnings: _e, deductionItems: _d, company: _c, ...rest } = toPayslip(d, p);
  return rest;
}

export function listPayslips(params: ListParams<PayslipFilters>, scope: PayrollScope): Paginated<PayslipSummary> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const rows = d.payslips
    .filter((p) => (a.org || p.employeeId === a.me) && (!f.month || monthOf(p.periodStart) === f.month) && (!f.runId || p.runId === f.runId) && (!units || units.has(p.employee.department.id)))
    .sort((x, y) => y.periodStart.localeCompare(x.periodStart) || x.employee.employeeNumber.localeCompare(y.employee.employeeNumber))
    .map((p) => toPayslipSummary(d, p));
  return page(rows, params, {
    search: (p) => `${p.number} ${nameSearch(p.employee.name, p.employee.employeeNumber)}`,
    sort: (p, field) => (field === 'employee.name.en' ? p.employee.name.en : field === 'employee.name.ar' ? p.employee.name.ar : (p as unknown as Record<string, unknown>)[field]),
  });
}

/** Own scope: another employee's payslip is NOT_FOUND (the URL never reveals whether it exists). */
export function getPayslip(id: string, scope: PayrollScope): Payslip {
  const { d, a } = begin(scope);
  const p = d.payslips.find((x) => x.id === id);
  if (!p || (!a.org && p.employeeId !== a.me)) notFound('Payslip', id);
  return toPayslip(d, p);
}

/* Self-service --------------------------------------------------------------------------------------------------------------------------- */

export function myPayroll(scope: PayrollScope): MyPayroll {
  const { d, a } = begin(scope);
  const e = a.me ? empRow(a.me) : undefined;
  if (!e) notFound('Employee record for account', scope.userId);
  const today = todayIso();
  const records = compsOf(d, e.id).map((c) => toRecord(d, c, today));
  const snap = snapshot(e);
  return {
    employee: { id: e.id, name: snap.name, employeeNumber: e.employeeNumber, department: snap.department, position: snap.position },
    current: records.find((r) => r.state === 'current') ?? null,
    allowances: d.assignments.filter((x) => x.kind === 'allowance' && x.employeeId === e.id && assignmentState(x, today) !== 'ended').map((x) => toAllowance(d, x, today)),
    deductions: d.assignments.filter((x) => x.kind === 'deduction' && x.employeeId === e.id && assignmentState(x, today) !== 'ended').map((x) => toDeduction(d, x, today)),
    history: d.payslips
      .filter((p) => p.employeeId === e.id)
      .sort((x, y) => y.periodStart.localeCompare(x.periodStart))
      .map((p) => {
        const s = toPayslipSummary(d, p);
        return { id: s.id, number: s.number, periodStart: s.periodStart, periodEnd: s.periodEnd, paymentDate: s.paymentDate, currency: s.currency, gross: s.gross, deductions: s.deductions, net: s.net, paymentStatus: s.paymentStatus };
      }),
  };
}

export function myPayslips(params: ListParams<PayslipFilters>, scope: PayrollScope): Paginated<PayslipSummary> {
  // Always the caller's own payslips, whatever their scope.
  return listPayslips(params, { ...scope, kind: 'own' });
}

/* Overview ------------------------------------------------------------------------------------------------------------------------------- */

const RANGES: ReadonlyArray<[number, number | null]> = [
  [0, 500],
  [500, 1000],
  [1000, 1500],
  [1500, 2000],
  [2000, 3000],
  [3000, 4500],
  [4500, null],
];

export function summary(scope: PayrollScope): PayrollSummary {
  const { d, a } = begin(scope);
  requireOrg(a);
  const today = todayIso();
  const thisMonth = monthOf(today);
  const runs = d.runs.filter((r) => r.currency === BASE_CURRENCY);
  const final = runs.filter((r) => FINAL_RUN_STATUSES.includes(r.status));
  const linesOf = (list: readonly RunRow[]) => list.flatMap((r) => r.lines);

  const latestMonth = final.map((r) => monthOf(r.periodStart)).sort().at(-1) ?? null;
  const latestRuns = latestMonth ? final.filter((r) => monthOf(r.periodStart) === latestMonth) : [];
  const latestLines = linesOf(latestRuns);

  const current = employeeRecords
    .all()
    .map((e) => compsOf(d, e.id).find((c) => stateOf(c.effectiveFrom, c.effectiveTo, today) === 'current'))
    .filter((c): c is CompRow & { effectiveTo: string | null } => Boolean(c && c.currency === BASE_CURRENCY));

  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, i - 11));
  const byDepartment = new Map<string, { department: NamedRef; gross: Minor; net: Minor; employees: number }>();
  for (const l of latestLines) {
    const row = byDepartment.get(l.topDepartment.id) ?? { department: l.topDepartment, gross: 0, net: 0, employees: 0 };
    row.gross += l.gross;
    row.net += l.net;
    row.employees++;
    byDepartment.set(l.topDepartment.id, row);
  }
  const activity: ActivityEntry[] = d.runs.flatMap((r) => r.history.map((h) => ({ ...h, runId: r.id, runNumber: r.number })));
  activity.sort((x, y) => y.at.localeCompare(x.at));

  return {
    currency: BASE_CURRENCY,
    totalEmployees: current.length,
    latest: latestMonth
      ? { month: latestMonth, runs: latestRuns.length, employees: latestLines.length, gross: sumMinor(latestLines.map((l) => l.gross)), deductions: sumMinor(latestLines.map((l) => l.deductions)), net: sumMinor(latestLines.map((l) => l.net)) }
      : null,
    pendingRuns: d.runs.filter((r) => PENDING_RUN_STATUSES.includes(r.status)).length,
    awaitingApproval: d.runs.filter((r) => r.status === 'pending-approval').length,
    currentPeriod: {
      month: thisMonth,
      start: monthStart(thisMonth),
      end: monthEnd(thisMonth),
      runs: d.runs.filter((r) => rangesOverlap(r.periodStart, r.periodEnd, monthStart(thisMonth), monthEnd(thisMonth))).map((r) => ({ id: r.id, number: r.number, status: r.status, department: r.departmentId ? deptRef(r.departmentId) : null })),
    },
    monthly: months.map((month) => {
      const lines = linesOf(final.filter((r) => monthOf(r.periodStart) === month));
      return {
        month,
        basic: sumMinor(lines.map((l) => l.basic)),
        allowances: sumMinor(lines.map((l) => l.allowances)),
        overtime: sumMinor(lines.map((l) => l.overtime)),
        gross: sumMinor(lines.map((l) => l.gross)),
        deductions: sumMinor(lines.map((l) => l.deductions)),
        net: sumMinor(lines.map((l) => l.net)),
        employees: lines.length,
      };
    }),
    byDepartment: [...byDepartment.values()].sort((x, y) => y.gross - x.gross),
    salaryRanges: RANGES.map(([min, max]) => ({ min: min * 1000, max: max === null ? null : max * 1000, employees: current.filter((c) => c.basicSalary >= min * 1000 && (max === null || c.basicSalary < max * 1000)).length })),
    recentActivity: activity.slice(0, 8),
  };
}

/* Reports -------------------------------------------------------------------------------------------------------------------------------- */

const MAX_REPORT_MONTHS = 24;

function reportData(filters: PayrollReportFilters, d: Db): Pick<PayrollReport, 'columns' | 'rows' | 'totals'> {
  const errors: FieldErrors = {};
  if (!isMonth(filters.fromMonth ?? '')) errors.fromMonth = ['invalidMonth'];
  if (!isMonth(filters.toMonth ?? '')) errors.toMonth = ['invalidMonth'];
  else if (isMonth(filters.fromMonth) && filters.toMonth < filters.fromMonth) errors.toMonth = ['endBeforeStart'];
  else if (isMonth(filters.fromMonth) && filters.toMonth > addMonths(filters.fromMonth, MAX_REPORT_MONTHS - 1)) errors.toMonth = ['rangeTooLong'];
  if (Object.keys(errors).length) invalid(errors);

  const units = filters.departmentId ? new Set([filters.departmentId, ...orgTables.descendants(filters.departmentId)]) : null;
  // Reports use FINAL payroll only (approved or paid), in the organisation's currency.
  const runs = d.runs.filter((r) => FINAL_RUN_STATUSES.includes(r.status) && r.currency === BASE_CURRENCY && monthOf(r.periodStart) >= filters.fromMonth && monthOf(r.periodStart) <= filters.toMonth);
  const pick = (l: LineRow) => (!units || units.has(l.employee.department.id)) && (!filters.locationId || l.employee.location.id === filters.locationId) && (!filters.employeeId || l.employeeId === filters.employeeId);
  const entries = runs
    .sort((x, y) => x.periodStart.localeCompare(y.periodStart) || x.number.localeCompare(y.number))
    .flatMap((r) => r.lines.filter(pick).map((l) => ({ run: r, line: l })));
  const money = ['basic', 'allowances', 'overtime', 'gross', 'deductions', 'net'] as const;
  const moneyCols = money.map((key) => ({ key, kind: 'money' as const }));
  const sums = (list: readonly LineRow[]) => Object.fromEntries(money.map((k) => [k, sumMinor(list.map((l) => l[k]))]));

  let columns: PayrollReport['columns'];
  let rows: Array<Record<string, ReportCell>>;
  const group = <K,>(keyOf: (e: (typeof entries)[number]) => K) => {
    const map = new Map<K, Array<(typeof entries)[number]>>();
    for (const e of entries) map.set(keyOf(e), [...(map.get(keyOf(e)) ?? []), e]);
    return map;
  };
  switch (filters.type) {
    case 'summary':
      columns = [{ key: 'runNumber', kind: 'code' }, { key: 'month', kind: 'month' }, { key: 'department', kind: 'localized' }, { key: 'status', kind: 'status' }, { key: 'employees', kind: 'number' }, ...moneyCols];
      rows = [...group((e) => e.run).entries()].map(([run, list]) => ({ runNumber: run.number, month: monthOf(run.periodStart), department: run.departmentId ? deptRef(run.departmentId).name : null, status: run.status, employees: list.length, ...sums(list.map((x) => x.line)) }));
      break;
    case 'department':
      columns = [{ key: 'department', kind: 'localized' }, { key: 'employees', kind: 'number' }, ...moneyCols];
      rows = [...group((e) => e.line.topDepartment.id).values()].map((list): Record<string, ReportCell> => ({ department: list[0]!.line.topDepartment.name, employees: new Set(list.map((x) => x.line.employeeId)).size, ...sums(list.map((x) => x.line)) })).sort((x, y) => (y.gross as number) - (x.gross as number));
      break;
    case 'employee':
      columns = [{ key: 'employee', kind: 'localized' }, { key: 'employeeNumber', kind: 'code' }, { key: 'department', kind: 'localized' }, { key: 'periods', kind: 'number' }, ...moneyCols];
      rows = [...group((e) => e.line.employeeId).values()]
        .map((list) => {
          const last = list.at(-1)!.line;
          return { employee: last.employee.name, employeeNumber: last.employee.employeeNumber, department: last.employee.department.name, periods: list.length, ...sums(list.map((x) => x.line)) };
        })
        .sort((x, y) => String(x.employeeNumber).localeCompare(String(y.employeeNumber)));
      break;
    case 'allowances':
    case 'deductions': {
      const items = entries.flatMap((e) => (filters.type === 'allowances' ? e.line.earnings.filter((i) => i.kind === 'allowance') : e.line.deductionItems).map((i) => ({ item: i, employeeId: e.line.employeeId })));
      const byCode = new Map<string, typeof items>();
      for (const x of items) byCode.set(x.item.code, [...(byCode.get(x.item.code) ?? []), x]);
      columns = [{ key: 'item', kind: 'localized' }, { key: 'code', kind: 'code' }, { key: 'category', kind: 'status' }, { key: 'employees', kind: 'number' }, { key: 'amount', kind: 'money' }];
      rows = [...byCode.values()]
        .map((list) => ({ item: list[0]!.item.name, code: list[0]!.item.code, category: list[0]!.item.category ?? 'allowance', employees: new Set(list.map((x) => x.employeeId)).size, amount: sumMinor(list.map((x) => x.item.amount)) }))
        .sort((x, y) => (y.amount as number) - (x.amount as number));
      break;
    }
    case 'monthly':
      columns = [{ key: 'month', kind: 'month' }, { key: 'runs', kind: 'number' }, { key: 'employees', kind: 'number' }, ...moneyCols];
      rows = [...group((e) => monthOf(e.run.periodStart)).entries()].map(([month, list]) => ({ month, runs: new Set(list.map((x) => x.run.id)).size, employees: list.length, ...sums(list.map((x) => x.line)) }));
      break;
    default:
      columns = [{ key: 'month', kind: 'month' }, { key: 'runNumber', kind: 'code' }, { key: 'employee', kind: 'localized' }, { key: 'employeeNumber', kind: 'code' }, { key: 'gross', kind: 'money' }, { key: 'deductions', kind: 'money' }, { key: 'net', kind: 'money' }, { key: 'paymentDate', kind: 'date' }, { key: 'payslip', kind: 'code' }];
      rows = entries.map(({ run, line }) => ({
        month: monthOf(run.periodStart),
        runNumber: run.number,
        employee: line.employee.name,
        employeeNumber: line.employee.employeeNumber,
        gross: line.gross,
        deductions: line.deductions,
        net: line.net,
        paymentDate: run.paymentDate,
        payslip: d.payslips.find((p) => p.runId === run.id && p.employeeId === line.employeeId)?.number ?? null,
      }));
  }
  const totals: Record<string, number> = {};
  for (const c of columns) if ((c.kind === 'money' || c.kind === 'number') && c.key !== 'periods') totals[c.key] = rows.reduce((sum, r) => sum + ((r[c.key] as number) ?? 0), 0);
  return { columns, rows, totals };
}

export function report(params: ListParams<PayrollReportFilters>, scope: PayrollScope): PayrollReport {
  const { d, a } = begin(scope);
  requireOrg(a);
  const filters = params.filters as PayrollReportFilters;
  const { columns, rows, totals } = reportData(filters, d);
  const p = queryCollection(rows, { page: params.page, pageSize: params.pageSize });
  return { filters, currency: BASE_CURRENCY, columns, rows: p.items, totals, page: p.page, pageSize: p.pageSize, total: p.total, totalPages: p.totalPages };
}

/** One CSV cell, quoted; TEXT starting with = + - @ tab or CR is neutralised (spreadsheet formula injection). */
export function csvCell(value: string | number | null, numeric = false): string {
  let text = value === null ? '' : String(value);
  if (!numeric && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportReport(filters: PayrollReportFilters, language: 'en' | 'ar', scope: PayrollScope): CsvExport {
  const { d, a } = begin(scope);
  requireOrg(a);
  const { columns, rows } = reportData(filters, d);
  const text = CSV_TEXT[language];
  const header = columns.map((c) => {
    const label = c.key === 'item' ? text.item : (text as Record<string, string>)[c.key] ?? c.key;
    return { value: c.kind === 'money' ? `${label} (${BASE_CURRENCY})` : label, numeric: false };
  });
  const lines = rows.map((r) =>
    columns.map((c) => {
      const v = r[c.key];
      if (v === null || v === undefined) return { value: c.key === 'department' ? text.all : null, numeric: false };
      if (c.kind === 'money') return { value: toDecimalString(v as number, BASE_CURRENCY), numeric: true };
      if (c.kind === 'number') return { value: v as number, numeric: true };
      if (c.kind === 'localized') return { value: (v as Localized<string>)[language], numeric: false };
      if (c.kind === 'status') return { value: c.key === 'status' ? CSV_STATUS[language][v as RunStatus] : CSV_CATEGORY[language][v as keyof (typeof CSV_CATEGORY)['en']], numeric: false };
      return { value: v as string, numeric: false };
    }),
  );
  const content = '﻿' + [header, ...lines].map((line) => line.map((cell) => csvCell(cell.value, cell.numeric)).join(',')).join('\r\n') + '\r\n';
  return { fileName: `payroll-${filters.type}-${filters.fromMonth}_${filters.toMonth}.csv`, content, rows: lines.length };
}

/* Lookups -------------------------------------------------------------------------------------------------------------------------------- */

export function employeeOptions(search: string, scope: PayrollScope): EmployeeOption[] {
  const { a } = begin(scope);
  requireOrg(a);
  const term = search.trim().toLowerCase();
  return employeeRecords
    .all()
    .filter((e) => !term || nameSearch(employeeRecords.fullName(e), e.employeeNumber).toLowerCase().includes(term))
    .sort((x, y) => x.employeeNumber.localeCompare(y.employeeNumber))
    .slice(0, 25)
    .map((e) => ({ id: e.id, name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId) }));
}

/* Used by the documents mock (same simulated backend; documents → payroll, never the other way) ------------------ */

export const payslipRecords = {
  /** The employee's issued payslips (approved / paid runs), newest first — Documents only REFERENCES them. */
  forEmployee(employeeId: string): Array<{ id: string; number: string; periodStart: string; paymentDate: string }> {
    return data()
      .payslips.filter((p) => p.employeeId === employeeId)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((p) => ({ id: p.id, number: p.number, periodStart: p.periodStart, paymentDate: p.paymentDate }));
  },
};
