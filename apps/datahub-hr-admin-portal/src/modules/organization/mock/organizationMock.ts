import { queryCollection } from '@/core/api/mock/collection';
import { createMockStore } from '@/core/api/mock/store';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import {
  validateDepartmentInput,
  validateLocationInput,
  validatePositionInput,
  type FieldErrors,
} from '@/modules/organization/schemas/organizationSchemas';
import {
  TOP_LEVEL,
  type Department,
  type DepartmentFilters,
  type DepartmentInput,
  type HierarchyNode,
  type Location,
  type LocationFilters,
  type LocationInput,
  type ManagerOption,
  type NamedRef,
  type OrganizationSummary,
  type Position,
  type PositionFilters,
  type PositionInput,
  type RecordStatus,
} from '@/modules/organization/types/organization';
import { descendantIds, parentProblem } from '@/modules/organization/utils/hierarchy';
import { employeeDirectory } from '@/modules/employees/mock/employeesMock';
import { DEPARTMENT_SEED, LOCATION_SEED, POSITION_SEED, type DepartmentRow, type LocationRow, type PositionRow } from './seed';

/*
 * SIMULATED organization backend: in-memory tables (reset on reload) and the rules the real backend must
 * enforce — unique codes, no circular department parents, only active departments as parents/assignments,
 * no deactivating a department that still has active subdepartments. Called by `organizationApi.ts` — and by the
 * employees mock (`orgTables`), because both simulate ONE backend: department managers are employees, employee
 * counts come from employee records, and employees reference departments, positions and locations.
 *
 * Authorization is NOT simulated here: the real backend must also check `organization:write` for every write.
 */

const departments = createMockStore<DepartmentRow>(DEPARTMENT_SEED, 'dep');
const positions = createMockStore<PositionRow>(POSITION_SEED, 'pos');
const locations = createMockStore<LocationRow>(LOCATION_SEED, 'loc');

/** Restore the seed data (tests). */
export function resetOrganizationMock(): void {
  departments.reset();
  positions.reset();
  locations.reset();
}

/* Helpers ---------------------------------------------------------------------------------------- */

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}

function check(errors: FieldErrors | undefined): void {
  if (errors) invalid(errors);
}

const normalizeCode = (code: string) => code.trim().toUpperCase();

function assertUniqueCode(rows: readonly { id: string; code: string }[], code: string, exceptId?: string): void {
  const wanted = normalizeCode(code);
  if (rows.some((r) => r.id !== exceptId && r.code.toUpperCase() === wanted)) invalid({ code: ['duplicate'] });
}

const personRef = (id: string | null): NamedRef | null => employeeDirectory.ref(id);

const departmentRef = (id: string): NamedRef => {
  const row = departments.get(id);
  return { id: row.id, name: row.name };
};

/** Adds flat `name.en`-style keys so the generic collection helper can search/sort localized fields. */
function withLocalizedKeys<T extends object>(item: T, field: 'name' | 'title'): T & Record<string, unknown> {
  const value = (item as Record<string, unknown>)[field] as { en: string; ar: string };
  return { ...item, [`${field}.en`]: value.en, [`${field}.ar`]: value.ar };
}

function stripLocalizedKeys<T extends object>(page: Paginated<T & Record<string, unknown>>, field: 'name' | 'title'): Paginated<T> {
  return {
    ...page,
    items: page.items.map((item) => {
      const { [`${field}.en`]: _en, [`${field}.ar`]: _ar, ...rest } = item;
      return rest as T;
    }),
  };
}

/* Departments ------------------------------------------------------------------------------------ */

function toDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    parent: row.parentId ? departmentRef(row.parentId) : null,
    manager: personRef(row.managerId),
    status: row.status,
    employeeCount: employeeDirectory.activeCounts().get(row.id) ?? 0,
    subdepartmentCount: departments.all().filter((d) => d.parentId === row.id).length,
    createdAt: row.createdAt,
  };
}

export function listDepartments(params: ListParams<DepartmentFilters>): Paginated<Department> {
  const items = departments.all().map((row) => withLocalizedKeys(toDepartment(row), 'name'));
  const page = queryCollection(items, params, {
    searchFields: ['code', 'name.en', 'name.ar'],
    matches: (d, filters) =>
      (!filters.status || d.status === filters.status) &&
      (!filters.parentId || (filters.parentId === TOP_LEVEL ? d.parent === null : d.parent?.id === filters.parentId)),
  });
  return stripLocalizedKeys<Department>(page, 'name');
}

export function getDepartment(id: string): Department {
  return toDepartment(departments.get(id));
}

/** Checks parent and manager references; `current` is the stored row when updating. */
function checkDepartmentRefs(input: DepartmentInput, current?: DepartmentRow): void {
  const errors: FieldErrors = {};
  if (input.parentId) {
    const parent = departments.all().find((d) => d.id === input.parentId);
    if (!parent) errors.parentId = ['not-found'];
    else {
      const problem = parentProblem(departments.all(), current?.id, input.parentId);
      if (problem) errors.parentId = [problem];
      // An inactive parent may stay (unchanged) but cannot be newly chosen.
      else if (parent.status === 'inactive' && parent.id !== current?.parentId) errors.parentId = ['inactive'];
    }
  }
  if (input.managerId) {
    if (!employeeDirectory.exists(input.managerId)) errors.managerId = ['not-found'];
    // An inactive employee may stay assigned (unchanged) but cannot be newly chosen.
    else if (!employeeDirectory.isActive(input.managerId) && input.managerId !== current?.managerId) errors.managerId = ['inactive'];
  }
  if (Object.keys(errors).length) invalid(errors);
}

export function createDepartment(input: DepartmentInput): Department {
  check(validateDepartmentInput(input));
  assertUniqueCode(departments.all(), input.code);
  checkDepartmentRefs(input);
  const row = departments.create({
    code: normalizeCode(input.code),
    name: { en: input.name.en.trim(), ar: input.name.ar.trim() },
    description: input.description.trim(),
    parentId: input.parentId,
    managerId: input.managerId,
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  return toDepartment(row);
}

export function updateDepartment(id: string, input: DepartmentInput): Department {
  const current = departments.get(id);
  check(validateDepartmentInput(input));
  assertUniqueCode(departments.all(), input.code, id);
  checkDepartmentRefs(input, current);
  return toDepartment(
    departments.update(id, {
      code: normalizeCode(input.code),
      name: { en: input.name.en.trim(), ar: input.name.ar.trim() },
      description: input.description.trim(),
      parentId: input.parentId,
      managerId: input.managerId,
    }),
  );
}

export function updateDepartmentStatus(id: string, status: RecordStatus): Department {
  const current = departments.get(id);
  if (status === 'inactive' && departments.all().some((d) => d.parentId === id && d.status === 'active')) {
    invalid({ status: ['active-subdepartments'] });
  }
  if (status === 'active' && current.parentId && departments.get(current.parentId).status === 'inactive') {
    invalid({ status: ['inactive-parent'] });
  }
  return toDepartment(departments.update(id, { status }));
}

export function departmentHierarchy(): HierarchyNode[] {
  const counts = employeeDirectory.activeCounts();
  return departments.all().map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
    manager: personRef(row.managerId),
    status: row.status,
    employeeCount: counts.get(row.id) ?? 0,
  }));
}

/* Positions -------------------------------------------------------------------------------------- */

function toPosition(row: PositionRow): Position {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    department: departmentRef(row.departmentId),
    description: row.description,
    level: row.level,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function listPositions(params: ListParams<PositionFilters>): Paginated<Position> {
  const items = positions.all().map((row) => withLocalizedKeys(toPosition(row), 'title'));
  const page = queryCollection(items, params, {
    searchFields: ['code', 'title.en', 'title.ar'],
    matches: (p, filters) =>
      (!filters.status || p.status === filters.status) &&
      (!filters.level || p.level === filters.level) &&
      // A department filter includes its subdepartments' positions.
      (!filters.departmentId || p.department.id === filters.departmentId || descendantIds(departments.all(), filters.departmentId).has(p.department.id)),
  });
  return stripLocalizedKeys<Position>(page, 'title');
}

export function getPosition(id: string): Position {
  return toPosition(positions.get(id));
}

function checkPositionDepartment(input: PositionInput, current?: PositionRow): void {
  const department = departments.all().find((d) => d.id === input.departmentId);
  if (!department) invalid({ departmentId: ['not-found'] });
  if (department.status === 'inactive' && department.id !== current?.departmentId) invalid({ departmentId: ['inactive'] });
}

export function createPosition(input: PositionInput): Position {
  check(validatePositionInput(input));
  assertUniqueCode(positions.all(), input.code);
  checkPositionDepartment(input);
  const row = positions.create({
    code: normalizeCode(input.code),
    title: { en: input.title.en.trim(), ar: input.title.ar.trim() },
    departmentId: input.departmentId,
    description: input.description.trim(),
    level: input.level,
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  return toPosition(row);
}

export function updatePosition(id: string, input: PositionInput): Position {
  const current = positions.get(id);
  check(validatePositionInput(input));
  assertUniqueCode(positions.all(), input.code, id);
  checkPositionDepartment(input, current);
  return toPosition(
    positions.update(id, {
      code: normalizeCode(input.code),
      title: { en: input.title.en.trim(), ar: input.title.ar.trim() },
      departmentId: input.departmentId,
      description: input.description.trim(),
      level: input.level,
    }),
  );
}

export function updatePositionStatus(id: string, status: RecordStatus): Position {
  const current = positions.get(id);
  if (status === 'active' && departments.get(current.departmentId).status === 'inactive') invalid({ status: ['inactive-department'] });
  return toPosition(positions.update(id, { status }));
}

/* Locations -------------------------------------------------------------------------------------- */

const toLocation = (row: LocationRow): Location => ({ ...row });

export function listLocations(params: ListParams<LocationFilters>): Paginated<Location> {
  const items = locations.all().map((row) => withLocalizedKeys(toLocation(row), 'name'));
  const page = queryCollection(items, params, {
    searchFields: ['code', 'name.en', 'name.ar', 'city', 'address'],
    matches: (l, filters) => (!filters.status || l.status === filters.status) && (!filters.country || l.country === filters.country),
  });
  return stripLocalizedKeys<Location>(page, 'name');
}

export function getLocation(id: string): Location {
  return toLocation(locations.get(id));
}

export function createLocation(input: LocationInput): Location {
  check(validateLocationInput(input));
  assertUniqueCode(locations.all(), input.code);
  return toLocation(
    locations.create({
      code: normalizeCode(input.code),
      name: { en: input.name.en.trim(), ar: input.name.ar.trim() },
      address: input.address.trim(),
      city: input.city.trim(),
      country: input.country,
      status: 'active',
      createdAt: new Date().toISOString(),
    }),
  );
}

export function updateLocation(id: string, input: LocationInput): Location {
  locations.get(id);
  check(validateLocationInput(input));
  assertUniqueCode(locations.all(), input.code, id);
  return toLocation(
    locations.update(id, {
      code: normalizeCode(input.code),
      name: { en: input.name.en.trim(), ar: input.name.ar.trim() },
      address: input.address.trim(),
      city: input.city.trim(),
      country: input.country,
    }),
  );
}

export function updateLocationStatus(id: string, status: RecordStatus): Location {
  return toLocation(locations.update(id, { status }));
}

/* Overview and lookups --------------------------------------------------------------------------- */

const counts = (rows: readonly { status: RecordStatus }[]) => ({ total: rows.length, active: rows.filter((r) => r.status === 'active').length });

export function summary(): OrganizationSummary {
  return {
    departments: counts(departments.all().filter((d) => d.parentId === null)),
    positions: counts(positions.all()),
    locations: counts(locations.all()),
    units: counts(departments.all()),
  };
}

/** Active employees who can be assigned as a department manager (from employee records). */
export function managerOptions(search = ''): ManagerOption[] {
  return employeeDirectory.candidates(search);
}

/* Read access for the employees mock (same simulated backend) ------------------------------------------- */

export const orgTables = {
  departments: (): readonly DepartmentRow[] => departments.all(),
  positions: (): readonly PositionRow[] => positions.all(),
  locations: (): readonly LocationRow[] => locations.all(),
  descendants: (id: string): Set<string> => descendantIds(departments.all(), id),
};
