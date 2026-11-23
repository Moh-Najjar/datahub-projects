import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { createMockStore } from '@/core/api/mock/store';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import { validateEmployeeInput, type FieldErrors } from '@/modules/employees/schemas/employeeSchemas';
import type {
  Employee,
  EmployeeFilters,
  EmployeeInput,
  EmployeeOption,
  EmployeeScope,
  EmployeeSummary,
  EmploymentHistoryEntry,
  EmploymentStatus,
  HistoryEventType,
  ManagerOptionsQuery,
  NamedRef,
  PersonalDetails,
} from '@/modules/employees/types/employee';
import { ACCOUNT_EMPLOYEE, EMPLOYEE_SEED, HISTORY_SEED, type EmployeeRow, type HistoryRow } from './seed';

/*
 * SIMULATED employees backend: in-memory tables (reset on reload) plus the rules the real backend must enforce —
 * unique employee numbers and work e-mails, valid and ACTIVE organization references (department, position of that
 * department, location), valid managers (active, not the employee, not someone who reports to them, working in the
 * employee's department or a parent department), team scoping for Department Managers (`FORBIDDEN` outside the
 * team), field-level access (personal details and identity documents only with `hr.employees.view.personal`), and
 * status rules. Called only by `employeesApi.ts` — and by the organization mock, because both simulate
 * ONE backend (department counts, department managers and manager options come from employee records).
 *
 * Write authorization (`organization.employees.manage`, `hr.documents.manage`) is NOT simulated: the real backend must check it.
 */

const employees = createMockStore<EmployeeRow>(EMPLOYEE_SEED, 'emp');
const history = createMockStore<HistoryRow>(HISTORY_SEED, 'hist');

/** Restore the seed data (tests). */
/**
 * Sign-in accounts → their employee record (the backend links user accounts to employees). Every module scopes
 * "own" and "team" requests with it; Users & Roles links and unlinks accounts here (one link table, no copy).
 */
let accountLinks = new Map<string, string>(Object.entries(ACCOUNT_EMPLOYEE));

export function resetEmployeesMock(): void {
  employees.reset();
  history.reset();
  accountLinks = new Map(Object.entries(ACCOUNT_EMPLOYEE));
}

const today = () => new Date().toISOString().slice(0, 10);

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}

/* Organization lookups (same simulated backend) ---------------------------------------------------------- */

const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const position = (id: string) => orgTables.positions().find((p) => p.id === id);
const location = (id: string) => orgTables.locations().find((l) => l.id === id);
const ref = (row: { id: string; name?: Localized<string>; title?: Localized<string> } | undefined, id: string): NamedRef => ({
  id,
  name: row ? (row.name ?? row.title)! : { en: id, ar: id },
});

/** The department and all its parents (the units whose people may manage someone in it). */
function departmentChain(id: string): Set<string> {
  const chain = new Set<string>();
  for (let d = department(id); d && !chain.has(d.id); d = d.parentId ? department(d.parentId) : undefined) chain.add(d.id);
  return chain;
}

/* Scope ------------------------------------------------------------------------------------------------- */

/** Units a team-scoped user may see: the departments they manage and everything below them. */
function teamUnits(userId: string): Set<string> {
  const employeeId = accountLinks.get(userId);
  const units = new Set<string>();
  if (!employeeId) return units;
  const all = orgTables.departments();
  for (const d of all.filter((u) => u.managerId === employeeId)) {
    units.add(d.id);
    for (const id of orgTables.descendants(d.id)) units.add(id);
  }
  return units;
}

function visibleRows(scope: EmployeeScope): readonly EmployeeRow[] {
  if (scope.kind === 'organization') return employees.all();
  const units = teamUnits(scope.userId);
  return employees.all().filter((e) => units.has(e.departmentId));
}

function getVisible(id: string, scope: EmployeeScope): EmployeeRow {
  const row = employees.get(id);
  if (scope.kind === 'team' && !teamUnits(scope.userId).has(row.departmentId)) throw new ApiError('FORBIDDEN', 'Outside your team');
  return row;
}

/** Field-level access: personal details and sensitive documents require `hr.employees.view.personal`. */
export const canReadPersonal = (scope: EmployeeScope) => hasPermission(scope.role, 'hr.employees.view.personal');

/* Mapping ----------------------------------------------------------------------------------------------- */

export const fullName = (row: Pick<EmployeeRow, 'name'>): Localized<string> => ({
  en: `${row.name.first.en} ${row.name.last.en}`,
  ar: `${row.name.first.ar} ${row.name.last.ar}`,
});

function toSummary(row: EmployeeRow): EmployeeSummary {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    name: row.name,
    workEmail: row.workEmail,
    department: ref(department(row.departmentId), row.departmentId),
    position: ref(position(row.positionId), row.positionId),
    location: ref(location(row.locationId), row.locationId),
    hireDate: row.hireDate,
    employmentType: row.employmentType,
    status: row.status,
  };
}

function personalDetails(row: EmployeeRow): PersonalDetails {
  return {
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    nationality: row.nationality,
    maritalStatus: row.maritalStatus,
    personalEmail: row.personalEmail,
    phone: row.phone,
    alternativePhone: row.alternativePhone,
    address: row.address,
    city: row.city,
    country: row.country,
    emergencyContact: { ...row.emergencyContact },
  };
}

/** The profile as `scope` may see it: without `hr.employees.view.personal` the personal block is not sent at all. */
function toEmployee(row: EmployeeRow, scope: EmployeeScope): Employee {
  const manager = row.managerId ? employees.all().find((e) => e.id === row.managerId) : undefined;
  return {
    ...toSummary(row),
    photoUrl: null,
    contractStartDate: row.contractStartDate,
    contractEndDate: row.contractEndDate,
    probationEndDate: row.probationEndDate,
    manager: manager ? { id: manager.id, name: fullName(manager) } : null,
    reportingDepartment: row.reportingDepartmentId ? ref(department(row.reportingDepartmentId), row.reportingDepartmentId) : null,
    createdAt: row.createdAt,
    personal: canReadPersonal(scope) ? personalDetails(row) : null,
  };
}

/* Directory --------------------------------------------------------------------------------------------- */

export function listEmployees(params: ListParams<EmployeeFilters>, scope: EmployeeScope): Paginated<EmployeeSummary> {
  const items = visibleRows(scope).map((row) => {
    const name = fullName(row);
    return { ...toSummary(row), 'name.en': name.en, 'name.ar': name.ar };
  });
  const page = queryCollection(items, params, {
    searchFields: ['employeeNumber', 'workEmail', 'name.en', 'name.ar'],
    matches: (e, f) =>
      (!f.status || e.status === f.status) &&
      (!f.employmentType || e.employmentType === f.employmentType) &&
      (!f.positionId || e.position.id === f.positionId) &&
      (!f.locationId || e.location.id === f.locationId) &&
      // A department filter includes its subdepartments.
      (!f.departmentId || e.department.id === f.departmentId || orgTables.descendants(f.departmentId).has(e.department.id)),
  });
  return {
    ...page,
    items: page.items.map((item) => {
      const { 'name.en': _en, 'name.ar': _ar, ...summary } = item;
      return summary as EmployeeSummary;
    }),
  };
}

export function getEmployee(id: string, scope: EmployeeScope): Employee {
  return toEmployee(getVisible(id, scope), scope);
}

/* Writes ------------------------------------------------------------------------------------------------ */

/** Everyone who reports to `id`, directly or indirectly. */
function reportsOf(id: string): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const e of employees.all()) {
      if (e.managerId === current && !result.has(e.id) && e.id !== id) {
        result.add(e.id);
        stack.push(e.id);
      }
    }
  }
  return result;
}

function checkInput(input: EmployeeInput, current?: EmployeeRow): void {
  const format = validateEmployeeInput(input);
  if (format) invalid(format);
  const errors: FieldErrors = {};
  const others = employees.all().filter((e) => e.id !== current?.id);
  if (others.some((e) => e.employeeNumber.toUpperCase() === input.employeeNumber.trim().toUpperCase())) errors.employeeNumber = ['duplicate'];
  if (others.some((e) => e.workEmail.toLowerCase() === input.workEmail.trim().toLowerCase())) errors.workEmail = ['duplicate'];

  // Organization references: must exist; must be active unless unchanged (existing assignments may stay).
  const dep = department(input.departmentId);
  if (!dep) errors.departmentId = ['not-found'];
  else if (dep.status !== 'active' && dep.id !== current?.departmentId) errors.departmentId = ['inactive'];
  const pos = position(input.positionId);
  if (!pos) errors.positionId = ['not-found'];
  else if (pos.departmentId !== input.departmentId) errors.positionId = ['position-department'];
  else if (pos.status !== 'active' && pos.id !== current?.positionId) errors.positionId = ['inactive'];
  const loc = location(input.locationId);
  if (!loc) errors.locationId = ['not-found'];
  else if (loc.status !== 'active' && loc.id !== current?.locationId) errors.locationId = ['inactive'];
  if (input.reportingDepartmentId) {
    const reporting = department(input.reportingDepartmentId);
    if (!reporting) errors.reportingDepartmentId = ['not-found'];
    else if (reporting.status !== 'active' && reporting.id !== current?.reportingDepartmentId) errors.reportingDepartmentId = ['inactive'];
  }

  if (input.managerId) {
    const manager = employees.all().find((e) => e.id === input.managerId);
    if (!manager) errors.managerId = ['not-found'];
    else if (current && manager.id === current.id) errors.managerId = ['self'];
    else if (current && reportsOf(current.id).has(manager.id)) errors.managerId = ['circular'];
    else if (manager.status !== 'active' && manager.id !== current?.managerId) errors.managerId = ['inactive'];
    else if (dep && !departmentChain(dep.id).has(manager.departmentId)) errors.managerId = ['manager-department'];
  }
  if (Object.keys(errors).length) invalid(errors);
}

function normalize(input: EmployeeInput) {
  const trim = (s: string) => s.trim();
  return {
    employeeNumber: input.employeeNumber.trim().toUpperCase(),
    name: { first: { en: trim(input.name.first.en), ar: trim(input.name.first.ar) }, last: { en: trim(input.name.last.en), ar: trim(input.name.last.ar) } },
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    nationality: input.nationality,
    maritalStatus: input.maritalStatus,
    workEmail: input.workEmail.trim().toLowerCase(),
    personalEmail: input.personalEmail.trim().toLowerCase(),
    phone: trim(input.phone),
    alternativePhone: trim(input.alternativePhone),
    address: trim(input.address),
    city: trim(input.city),
    country: input.country,
    hireDate: input.hireDate,
    employmentType: input.employmentType,
    contractStartDate: input.contractStartDate,
    contractEndDate: input.contractEndDate || null,
    probationEndDate: input.probationEndDate || null,
    departmentId: input.departmentId,
    positionId: input.positionId,
    locationId: input.locationId,
    managerId: input.managerId || null,
    reportingDepartmentId: input.reportingDepartmentId || null,
    emergencyContact: { ...input.emergencyContact, name: trim(input.emergencyContact.name), phone: trim(input.emergencyContact.phone), alternativePhone: trim(input.emergencyContact.alternativePhone) },
  };
}

function record(employeeId: string, type: HistoryEventType, from: Localized<string> | null, to: Localized<string> | null) {
  history.create({ employeeId, type, date: today(), from, to });
}

export function createEmployee(input: EmployeeInput, scope: EmployeeScope): Employee {
  checkInput(input);
  const row = employees.create({ ...normalize(input), status: 'active', createdAt: new Date().toISOString() });
  history.create({ employeeId: row.id, type: 'joined', date: row.hireDate, from: null, to: department(row.departmentId)!.name });
  return toEmployee(row, scope);
}

export function updateEmployee(id: string, input: EmployeeInput, scope: EmployeeScope): Employee {
  const current = employees.get(id);
  checkInput(input, current);
  const next = normalize(input);
  const nameOf = (eid: string | null) => {
    const e = eid ? employees.all().find((x) => x.id === eid) : undefined;
    return e ? fullName(e) : null;
  };
  // Employment history records organizational changes automatically.
  if (next.departmentId !== current.departmentId) record(id, 'department-changed', department(current.departmentId)?.name ?? null, department(next.departmentId)!.name);
  if (next.positionId !== current.positionId) record(id, 'position-changed', position(current.positionId)?.title ?? null, position(next.positionId)!.title);
  if (next.managerId !== current.managerId) record(id, 'manager-changed', nameOf(current.managerId), nameOf(next.managerId));
  return toEmployee(employees.update(id, next), scope);
}

const STATUS_LABEL: Record<EmploymentStatus, Localized<string>> = { active: { en: 'active', ar: 'active' }, inactive: { en: 'inactive', ar: 'inactive' } };

export function updateEmployeeStatus(id: string, status: EmploymentStatus, scope: EmployeeScope): Employee {
  const current = employees.get(id);
  if (current.status === status) return toEmployee(current, scope);
  if (status === 'inactive') {
    if (orgTables.departments().some((d) => d.managerId === id && d.status === 'active')) invalid({ status: ['department-manager'] });
    if (employees.all().some((e) => e.managerId === id && e.status === 'active')) invalid({ status: ['has-direct-reports'] });
  } else {
    const inactiveAssignment =
      department(current.departmentId)?.status !== 'active' || position(current.positionId)?.status !== 'active' || location(current.locationId)?.status !== 'active';
    if (inactiveAssignment) invalid({ status: ['inactive-assignment'] });
  }
  record(id, 'status-changed', STATUS_LABEL[current.status], STATUS_LABEL[status]);
  return toEmployee(employees.update(id, { status }), scope);
}

/* History (documents live in Documents Management) ------------------------------------------------- */

export function employmentHistory(id: string, scope: EmployeeScope): EmploymentHistoryEntry[] {
  getVisible(id, scope);
  return history
    .all()
    .filter((h) => h.employeeId === id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map((h) => ({ ...h }));
}

/* Lookups ----------------------------------------------------------------------------------------------- */

const matchesSearch = (e: EmployeeRow, term: string) => {
  const name = fullName(e);
  return !term || name.en.toLowerCase().includes(term) || name.ar.includes(term) || e.employeeNumber.toLowerCase().includes(term);
};

/** Valid managers for an employee in `departmentId` (see `ManagerOptionsQuery`). */
export function managerOptions({ search = '', departmentId, excludeEmployeeId }: ManagerOptionsQuery): EmployeeOption[] {
  const term = search.trim().toLowerCase();
  const chain = departmentId ? departmentChain(departmentId) : null;
  const excluded = excludeEmployeeId ? new Set([excludeEmployeeId, ...reportsOf(excludeEmployeeId)]) : new Set<string>();
  return employees
    .all()
    .filter((e) => e.status === 'active' && !excluded.has(e.id) && (!chain || chain.has(e.departmentId)) && matchesSearch(e, term))
    .sort((a, b) => fullName(a).en.localeCompare(fullName(b).en))
    .slice(0, 50)
    .map((e) => ({ id: e.id, name: e.name, employeeNumber: e.employeeNumber, position: ref(position(e.positionId), e.positionId), department: ref(department(e.departmentId), e.departmentId) }));
}

/* Used by the attendance mock (same simulated backend) ------------------------------------------------ */

export const employeeRecords = {
  /** Every employee record (any status) — attendance references these ids, it never copies the table. */
  all: (): readonly EmployeeRow[] => employees.all(),
  get: (id: string): EmployeeRow | undefined => employees.all().find((e) => e.id === id),
  fullName,
  /** Date an inactive employee was deactivated (latest status change), or null while active. */
  inactiveSince(id: string): string | null {
    const row = employees.all().find((e) => e.id === id);
    if (!row || row.status === 'active') return null;
    const changes = history.all().filter((h) => h.employeeId === id && h.type === 'status-changed' && h.to?.en === 'inactive');
    return changes.map((h) => h.date).sort().at(-1) ?? null;
  },
  /** The employee record linked to a sign-in account (the backend links accounts to employees). */
  employeeIdOf: (userId: string): string | undefined => accountLinks.get(userId),
  /** The account linked to an employee, if any (one account per employee). */
  accountOf: (employeeId: string): string | undefined => [...accountLinks].find(([, e]) => e === employeeId)?.[0],
  /** Link an account to an employee (`null` unlinks). Validated by the Users mock. */
  linkAccount(userId: string, employeeId: string | null): void {
    if (employeeId) accountLinks.set(userId, employeeId);
    else accountLinks.delete(userId);
  },
  /** Departments a team-scoped user manages, with their subdepartments. */
  teamUnits: (userId: string): Set<string> => teamUnits(userId),
};

/* Used by the organization mock (same simulated backend) ---------------------------------------------- */

export const employeeDirectory = {
  /** Display reference for an employee id (department managers). */
  ref(id: string | null): NamedRef | null {
    const e = id ? employees.all().find((x) => x.id === id) : undefined;
    return e ? { id: e.id, name: fullName(e) } : null;
  },
  isActive: (id: string) => employees.all().some((e) => e.id === id && e.status === 'active'),
  exists: (id: string) => employees.all().some((e) => e.id === id),
  /** Active employees per department (direct members only). */
  activeCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of employees.all()) if (e.status === 'active') counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1);
    return counts;
  },
  /** Active employees for "department manager" (name + job title = position). */
  candidates(search: string) {
    const term = search.trim().toLowerCase();
    return employees
      .all()
      .filter((e) => e.status === 'active' && matchesSearch(e, term))
      .sort((a, b) => fullName(a).en.localeCompare(fullName(b).en))
      .slice(0, 50)
      .map((e) => ({ id: e.id, name: fullName(e), jobTitle: position(e.positionId)?.title ?? { en: '', ar: '' } }));
  },
};
