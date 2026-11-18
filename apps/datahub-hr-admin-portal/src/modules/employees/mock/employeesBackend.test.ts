import { describe, expect, it } from 'vitest';
import { ApiError } from '@/core/api/types';
// Organization data comes from the same simulated backend (department managers and counts are employee-based).
import * as organization from '@/modules/organization/mock/organizationMock';
import { employeesApi as api } from '@/modules/employees/api/employeesApi';
import { employeeToInput } from '@/modules/employees/utils/employeeInput';
import type { EmployeeInput, EmployeeScope } from '@/modules/employees/types/employee';

/** An HR Administrator: whole organization, with personal details. */
const ORG: EmployeeScope = { kind: 'organization', role: 'hr-admin' };
/** usr-0004 = the Department Manager demo account (Dana Yousef, manager of Engineering). */
const TEAM: EmployeeScope = { kind: 'team', userId: 'usr-0004', role: 'department-manager' };
const ALL = { page: 1, pageSize: 100 };

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}
const fieldErrors = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error.code).toBe('VALIDATION');
  return error.fieldErrors;
};

const newEmployee = (patch: Partial<EmployeeInput> = {}): EmployeeInput => ({
  employeeNumber: 'emp-9001',
  name: { first: { en: 'Test', ar: 'تجربة' }, last: { en: 'Person', ar: 'شخص' } },
  dateOfBirth: '1995-04-12',
  gender: 'female',
  nationality: 'JO',
  maritalStatus: 'single',
  workEmail: 'test.person@staff.datahubhr.test',
  personalEmail: '',
  phone: '+962 79 000 1234',
  alternativePhone: '',
  address: 'Building 1, Street 2',
  city: 'Amman',
  country: 'JO',
  hireDate: '2026-09-01',
  employmentType: 'full-time',
  contractStartDate: '2026-09-01',
  contractEndDate: null,
  probationEndDate: '2026-12-01',
  departmentId: 'dep-eng-qa',
  positionId: 'pos-06',
  locationId: 'loc-01',
  managerId: 'emp-0015',
  reportingDepartmentId: null,
  emergencyContact: { name: 'Sam Person', relationship: 'parent', phone: '+962 78 000 9999', alternativePhone: '' },
  ...patch,
});

describe('seed data is fictional and consistent with Organization Management and the dashboard', () => {
  it('248 employees on record, 235 active; per-department counts match the organization data', async () => {
    const all = await api.getEmployees({ page: 1, pageSize: 100 }, ORG);
    expect(all.total).toBe(248);
    expect((await api.getEmployees({ ...ALL, filters: { status: 'active' } }, ORG)).total).toBe(235);
    // Engineering incl. subdepartments: 58 active + 4 inactive (the dashboard's figures).
    expect((await api.getEmployees({ ...ALL, filters: { departmentId: 'dep-eng', status: 'active' } }, ORG)).total).toBe(58);
    expect((await api.getEmployees({ ...ALL, filters: { departmentId: 'dep-eng', status: 'inactive' } }, ORG)).total).toBe(4);
    const tree = organization.departmentHierarchy();
    // Each unit's employee count (Organization Management) = its active employees assigned directly.
    for (const unit of tree) {
      const count = (await api.getEmployees({ ...ALL, filters: { status: 'active', departmentId: unit.id } }, ORG)).items.filter((e) => e.department.id === unit.id).length;
      expect(count, unit.code).toBe(unit.employeeCount);
    }
  });

  it('uses reserved, non-routable domains and unique numbers and e-mails', async () => {
    const seen = new Set<string>();
    for (let page = 1; page <= 3; page++) {
      for (const e of (await api.getEmployees({ page, pageSize: 100 }, ORG)).items) {
        expect(e.workEmail).toMatch(/@staff\.datahubhr\.test$/);
        expect(seen.has(e.employeeNumber)).toBe(false);
        expect(seen.has(e.workEmail)).toBe(false);
        seen.add(e.employeeNumber).add(e.workEmail);
      }
    }
    expect(seen.size).toBe(248 * 2);
  });

  it('department managers in Organization Management are employee records', async () => {
    const eng = organization.getDepartment('dep-eng');
    expect(eng.manager).toEqual({ id: 'emp-0001', name: { en: 'Dana Yousef', ar: 'دانا يوسف' } });
    const dana = await api.getEmployeeById('emp-0001', ORG);
    expect(dana.department.id).toBe('dep-eng');
    expect(dana.manager).toBeNull(); // top of her department
    expect((await api.getEmployeeById('emp-0013', ORG)).manager?.id).toBe('emp-0001'); // Software Development lead → Engineering head
  });
});

describe('directory: search, filters, sorting, pagination', () => {
  it('searches by name (English or Arabic), employee number and e-mail', async () => {
    expect((await api.getEmployees({ ...ALL, search: 'dana yousef' }, ORG)).items.map((e) => e.id)).toEqual(['emp-0001']);
    expect((await api.getEmployees({ ...ALL, search: 'دانا' }, ORG)).items.map((e) => e.id)).toEqual(['emp-0001']);
    expect((await api.getEmployees({ ...ALL, search: 'emp-0007' }, ORG)).items.map((e) => e.name.first.en)).toEqual(['Nadia']);
    expect((await api.getEmployees({ ...ALL, search: 'laila.masri@' }, ORG)).items.map((e) => e.id)).toEqual(['emp-0013']);
  });

  it('filters by department (incl. subdepartments), position, location, status and employment type', async () => {
    const mob = await api.getEmployees({ ...ALL, filters: { departmentId: 'dep-eng-mob' } }, ORG);
    expect(mob.total).toBe(10);
    expect(mob.items.every((e) => e.position.id === 'pos-05')).toBe(true);
    const byPosition = await api.getEmployees({ ...ALL, filters: { positionId: 'pos-16' } }, ORG);
    expect(byPosition.items.every((e) => e.position.name.en === 'Customer Support Agent')).toBe(true);
    const riyadh = await api.getEmployees({ ...ALL, filters: { locationId: 'loc-04' } }, ORG);
    expect(riyadh.total).toBeGreaterThan(0);
    expect(riyadh.items.every((e) => e.location.id === 'loc-04')).toBe(true);
    const contracts = await api.getEmployees({ ...ALL, filters: { employmentType: 'contract' } }, ORG);
    expect(contracts.items.every((e) => e.employmentType === 'contract')).toBe(true);
    expect((await api.getEmployees({ ...ALL, filters: { status: 'inactive' } }, ORG)).total).toBe(13);
  });

  it('sorts and paginates (1-based)', async () => {
    const asc = await api.getEmployees({ page: 1, pageSize: 5, sortBy: 'employeeNumber', sortDirection: 'asc' }, ORG);
    expect(asc.items.map((e) => e.employeeNumber)).toEqual(['EMP-0001', 'EMP-0002', 'EMP-0003', 'EMP-0004', 'EMP-0005']);
    expect(asc.totalPages).toBe(50);
    const last = await api.getEmployees({ page: 50, pageSize: 5, sortBy: 'employeeNumber', sortDirection: 'asc' }, ORG);
    expect(last.items.map((e) => e.employeeNumber)).toEqual(['EMP-0246', 'EMP-0247', 'EMP-0248']);
    const newest = await api.getEmployees({ page: 1, pageSize: 3, sortBy: 'hireDate', sortDirection: 'desc' }, ORG);
    expect(newest.items[0]!.hireDate >= newest.items[1]!.hireDate).toBe(true);
  });
});

describe('Department Manager team scoping (simulates the backend)', () => {
  it('lists only the team (Engineering and its subdepartments)', async () => {
    const team = await api.getEmployees({ page: 1, pageSize: 100 }, TEAM);
    expect(team.total).toBe(62);
    const departments = new Set(team.items.map((e) => e.department.id));
    expect([...departments].every((d) => d.startsWith('dep-eng'))).toBe(true);
  });

  it('refuses profiles and history outside the team (documents: see Documents Management)', async () => {
    expect((await api.getEmployeeById('emp-0014', TEAM)).department.id).toBe('dep-eng-mob');
    expect((await rejection(api.getEmployeeById('emp-0007', TEAM))).code).toBe('FORBIDDEN');
    expect((await rejection(api.getEmployeeEmploymentHistory('emp-0007', TEAM))).code).toBe('FORBIDDEN');
  });

  it('an account that manages no department sees nobody', async () => {
    expect((await api.getEmployees(ALL, { kind: 'team', userId: 'usr-0005', role: 'department-manager' })).total).toBe(0);
  });
});

describe('create and update', () => {
  it('creates an active employee with a "joined" history entry; organization counts follow', async () => {
    const before = organization.getDepartment('dep-eng-qa');
    const created = await api.createEmployee(newEmployee(), ORG);
    expect(created).toMatchObject({ employeeNumber: 'EMP-9001', status: 'active', department: { id: 'dep-eng-qa' }, position: { id: 'pos-06' }, manager: { id: 'emp-0015' } });
    expect((organization.getDepartment('dep-eng-qa')).employeeCount).toBe(before.employeeCount + 1);
    expect((await api.getEmployeeEmploymentHistory(created.id, ORG)).map((h) => h.type)).toEqual(['joined']);
  });

  it('rejects duplicate employee numbers and work e-mails (case-insensitive)', async () => {
    expect(await fieldErrors(api.createEmployee(newEmployee({ employeeNumber: 'emp-0001' }), ORG))).toEqual({ employeeNumber: ['duplicate'] });
    expect(await fieldErrors(api.createEmployee(newEmployee({ workEmail: 'DANA.YOUSEF@staff.datahubhr.test' }), ORG))).toEqual({ workEmail: ['duplicate'] });
  });

  it('validates organization references: existing, active, and the position must belong to the department', async () => {
    expect(await fieldErrors(api.createEmployee(newEmployee({ departmentId: 'dep-eng-lab', positionId: 'pos-25', managerId: null }), ORG))).toEqual({ departmentId: ['inactive'], positionId: ['inactive'] });
    expect(await fieldErrors(api.createEmployee(newEmployee({ positionId: 'pos-02' }), ORG))).toEqual({ positionId: ['position-department'] });
    expect(await fieldErrors(api.createEmployee(newEmployee({ locationId: 'loc-06' }), ORG))).toEqual({ locationId: ['inactive'] });
    expect(await fieldErrors(api.createEmployee(newEmployee({ departmentId: 'dep-nope' }), ORG))).toMatchObject({ departmentId: ['not-found'] });
  });

  it('validates managers: same or parent department, active, not self, no reporting cycles', async () => {
    expect(await fieldErrors(api.createEmployee(newEmployee({ managerId: 'emp-0007' }), ORG))).toEqual({ managerId: ['manager-department'] });
    expect((await api.createEmployee(newEmployee({ managerId: 'emp-0001' }), ORG)).manager?.id).toBe('emp-0001'); // parent department head
    const dana = await api.getEmployeeById('emp-0001', ORG);
    expect(await fieldErrors(api.updateEmployee('emp-0001', { ...employeeToInput(dana), managerId: 'emp-0001' }, ORG))).toEqual({ managerId: ['self'] });
    // Laila (SWD lead) reports to Dana: Dana cannot report to Laila.
    expect(await fieldErrors(api.updateEmployee('emp-0001', { ...employeeToInput(dana), managerId: 'emp-0013' }, ORG))).toEqual({ managerId: ['circular'] });
  });

  it('validates fields like the form (dates, formats) on the server too', async () => {
    const errors = await fieldErrors(api.createEmployee(newEmployee({ workEmail: 'not-an-email', contractStartDate: '2026-08-01', employmentType: 'contract', dateOfBirth: '2015-01-01' }), ORG));
    expect(errors).toEqual({ workEmail: ['email'], contractStartDate: ['contractBeforeHire'], contractEndDate: ['contractEndRequired'], dateOfBirth: ['tooYoung'] });
  });

  it('records department, position and manager changes in the employment history', async () => {
    const before = await api.getEmployeeById('emp-0050', ORG);
    const target = { departmentId: 'dep-eng-qa', positionId: 'pos-06', managerId: 'emp-0015' };
    const updated = await api.updateEmployee('emp-0050', { ...employeeToInput(before), ...target, reportingDepartmentId: 'dep-eng' }, ORG);
    expect(updated).toMatchObject({ department: { id: 'dep-eng-qa' }, reportingDepartment: { id: 'dep-eng' } });
    const history = await api.getEmployeeEmploymentHistory('emp-0050', ORG);
    const types = history.map((h) => h.type);
    if (before.department.id !== 'dep-eng-qa') expect(types).toContain('department-changed');
    if (before.position.id !== 'pos-06') expect(types).toContain('position-changed');
    expect(types).toContain('manager-changed');
    expect(history.find((h) => h.type === 'manager-changed')?.to?.en).toBe('Nour Haddadin');
  });
});

describe('status changes', () => {
  it('deactivates and re-activates, recording both in the history', async () => {
    expect((await api.updateEmployeeStatus('emp-0200', 'inactive', ORG)).status).toBe('inactive');
    expect((await api.updateEmployeeStatus('emp-0200', 'active', ORG)).status).toBe('active');
    const statusChanges = (await api.getEmployeeEmploymentHistory('emp-0200', ORG)).filter((h) => h.type === 'status-changed');
    expect(statusChanges.map((h) => h.to?.en)).toEqual(['active', 'inactive']);
  });

  it('refuses to deactivate a department manager or someone with active direct reports', async () => {
    expect(await fieldErrors(api.updateEmployeeStatus('emp-0001', 'inactive', ORG))).toEqual({ status: ['department-manager'] });
    // emp-0002 Lina has no reports and manages nothing → allowed.
    expect((await api.updateEmployeeStatus('emp-0002', 'inactive', ORG)).status).toBe('inactive');
  });

  it('refuses to activate an employee whose assignment is inactive', async () => {
    const inactive = (await api.getEmployees({ ...ALL, filters: { status: 'inactive', locationId: 'loc-06' } }, ORG)).items[0]!;
    expect(await fieldErrors(api.updateEmployeeStatus(inactive.id, 'active', ORG))).toEqual({ status: ['inactive-assignment'] });
  });
});

describe('history', () => {
  it('every employee has a "joined" entry on their hire date; inactive employees have a status change', async () => {
    const dana = await api.getEmployeeById('emp-0001', ORG);
    const history = await api.getEmployeeEmploymentHistory('emp-0001', ORG);
    expect(history.at(-1)).toMatchObject({ type: 'joined', date: dana.hireDate, to: { en: 'Engineering' } });
    const inactive = (await api.getEmployees({ ...ALL, filters: { status: 'inactive' } }, ORG)).items[0]!;
    expect((await api.getEmployeeEmploymentHistory(inactive.id, ORG)).some((h) => h.type === 'status-changed')).toBe(true);
  });
});

describe('manager options', () => {
  it('only active employees of the department or its parents, excluding the employee and their reports', async () => {
    const forMobile = await api.getManagerOptions({ departmentId: 'dep-eng-mob' });
    expect(forMobile.every((o) => ['dep-eng-mob', 'dep-eng-swd', 'dep-eng'].includes(o.department.id))).toBe(true);
    expect(forMobile.map((o) => o.id)).toEqual(expect.arrayContaining(['emp-0001', 'emp-0013', 'emp-0014']));
    const forDana = await api.getManagerOptions({ departmentId: 'dep-eng', excludeEmployeeId: 'emp-0001' });
    expect(forDana.map((o) => o.id)).not.toContain('emp-0001');
    expect(forDana.map((o) => o.id)).not.toContain('emp-0013'); // reports to Dana
    expect((await api.getManagerOptions({ search: 'nadia' })).map((o) => o.id)).toEqual(['emp-0007']);
  });
});
