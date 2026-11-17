import { describe, expect, it } from 'vitest';
import { failNextRequest } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import { organizationApi as api } from '@/modules/organization/api/organizationApi';
import { TOP_LEVEL, type DepartmentInput, type LocationInput, type PositionInput } from '@/modules/organization/types/organization';

/** The `fieldErrors` of the VALIDATION error a call rejects with. */
async function fieldErrors(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe('VALIDATION');
  return (error as ApiError).fieldErrors;
}

const newDepartment = (patch: Partial<DepartmentInput> = {}): DepartmentInput => ({
  code: 'new-01',
  name: { en: 'New Unit', ar: 'وحدة جديدة' },
  description: '',
  parentId: null,
  managerId: null,
  ...patch,
});

describe('departments API', () => {
  it('lists with search, filters, sorting and 1-based pagination', async () => {
    const page1 = await api.getDepartments({ page: 1, pageSize: 5, sortBy: 'code', sortDirection: 'asc' });
    expect(page1.items).toHaveLength(5);
    expect(page1.total).toBe(23);
    expect(page1.totalPages).toBe(5);
    expect(page1.items.map((d) => d.code)).toEqual([...page1.items.map((d) => d.code)].sort());

    const page5 = await api.getDepartments({ page: 5, pageSize: 5, sortBy: 'code', sortDirection: 'asc' });
    expect(page5.items).toHaveLength(3);
    expect(new Set([...page1.items, ...page5.items].map((d) => d.id)).size).toBe(8);

    // Search matches code and both names (case-insensitive).
    expect((await api.getDepartments({ page: 1, pageSize: 10, search: 'engin' })).items.map((d) => d.id)).toEqual(['dep-eng']);
    expect((await api.getDepartments({ page: 1, pageSize: 10, search: 'المالية' })).items.map((d) => d.id)).toEqual(['dep-fin']);

    const top = await api.getDepartments({ page: 1, pageSize: 50, filters: { parentId: TOP_LEVEL } });
    expect(top.total).toBe(8);
    expect(top.items.every((d) => d.parent === null)).toBe(true);
    const children = await api.getDepartments({ page: 1, pageSize: 50, filters: { parentId: 'dep-eng' } });
    expect(children.items.map((d) => d.id).sort()).toEqual(['dep-eng-data', 'dep-eng-lab', 'dep-eng-qa', 'dep-eng-swd']);
    expect((await api.getDepartments({ page: 1, pageSize: 50, filters: { status: 'inactive' } })).items.map((d) => d.id)).toEqual(['dep-eng-lab']);

    const byEmployees = await api.getDepartments({ page: 1, pageSize: 3, sortBy: 'employeeCount', sortDirection: 'desc' });
    expect(byEmployees.items.map((d) => d.employeeCount)).toEqual([33, 20, 18]);
    const arabicNames = await api.getDepartments({ page: 1, pageSize: 50, sortBy: 'name.ar', sortDirection: 'asc' });
    expect(arabicNames.items[0]!.name.ar.localeCompare(arabicNames.items[1]!.name.ar, 'en')).toBeLessThanOrEqual(0);
  });

  it('returns details with parent, manager and subdepartment count joined', async () => {
    const eng = await api.getDepartmentById('dep-eng');
    expect(eng.manager?.name.en).toBe('Dana Yousef');
    expect(eng.subdepartmentCount).toBe(4);
    expect((await api.getDepartmentById('dep-eng-mob')).parent).toEqual({ id: 'dep-eng-swd', name: { en: 'Software Development', ar: 'تطوير البرمجيات' } });
    await expect(api.getDepartmentById('dep-missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('creates a department (code normalised, active, now) and rejects duplicate codes', async () => {
    const created = await api.createDepartment(newDepartment({ parentId: 'dep-hr', managerId: 'emp-0004' }));
    expect(created).toMatchObject({ code: 'NEW-01', status: 'active', employeeCount: 0, parent: { id: 'dep-hr' }, manager: { id: 'emp-0004' } });
    expect((await api.getDepartmentById(created.id)).code).toBe('NEW-01');
    expect((await api.getOrganizationSummary()).units.total).toBe(24);

    expect(await fieldErrors(api.createDepartment(newDepartment({ code: 'eng' })))).toEqual({ code: ['duplicate'] });
    expect(await fieldErrors(api.createDepartment(newDepartment({ code: ' new-01 ' })))).toEqual({ code: ['duplicate'] });
  });

  it('validates fields like the backend would', async () => {
    const errors = await fieldErrors(api.createDepartment(newDepartment({ code: 'x', name: { en: '', ar: 'Latin only' } })));
    expect(errors).toEqual({ code: ['codeLength'], nameEn: ['required'], nameAr: ['arabicRequired'] });
    expect(await fieldErrors(api.createDepartment(newDepartment({ managerId: 'emp-9999' })))).toEqual({ managerId: ['not-found'] });
    expect(await fieldErrors(api.createDepartment(newDepartment({ parentId: 'dep-eng-lab' })))).toEqual({ parentId: ['inactive'] });
  });

  it('prevents circular parents: self, child and deeper descendants', async () => {
    const eng = await api.getDepartmentById('dep-eng');
    const input = (parentId: string): DepartmentInput => ({ code: eng.code, name: eng.name, description: eng.description, parentId, managerId: eng.manager?.id ?? null });
    expect(await fieldErrors(api.updateDepartment('dep-eng', input('dep-eng')))).toEqual({ parentId: ['self'] });
    expect(await fieldErrors(api.updateDepartment('dep-eng', input('dep-eng-swd')))).toEqual({ parentId: ['circular'] });
    expect(await fieldErrors(api.updateDepartment('dep-eng', input('dep-eng-mob')))).toEqual({ parentId: ['circular'] });
    // Moving under an unrelated department is fine.
    expect((await api.updateDepartment('dep-eng', input('dep-it'))).parent?.id).toBe('dep-it');
  });

  it('updates a department, keeping its own code and rejecting another department’s code', async () => {
    const qa = await api.getDepartmentById('dep-eng-qa');
    const input = { code: 'qa', name: { en: 'QA & Testing', ar: 'الاختبار وضمان الجودة' }, description: 'x', parentId: 'dep-eng', managerId: null };
    const updated = await api.updateDepartment('dep-eng-qa', input);
    expect(updated).toMatchObject({ code: 'QA', name: input.name, manager: null, createdAt: qa.createdAt });
    expect(await fieldErrors(api.updateDepartment('dep-eng-qa', { ...input, code: 'SWD' }))).toEqual({ code: ['duplicate'] });
  });

  it('status changes follow the hierarchy rules', async () => {
    expect(await fieldErrors(api.updateDepartmentStatus('dep-eng', 'inactive'))).toEqual({ status: ['active-subdepartments'] });
    expect((await api.updateDepartmentStatus('dep-eng-mob', 'inactive')).status).toBe('inactive');
    expect((await api.updateDepartmentStatus('dep-eng-swd', 'inactive')).status).toBe('inactive');
    expect(await fieldErrors(api.updateDepartmentStatus('dep-eng-mob', 'active'))).toEqual({ status: ['inactive-parent'] });
    expect((await api.updateDepartmentStatus('dep-eng-swd', 'active')).status).toBe('active');
    expect((await api.getOrganizationSummary()).units).toEqual({ total: 23, active: 21 });
  });

  it('hierarchy lists every unit with its parent link', async () => {
    const nodes = await api.getDepartmentHierarchy();
    expect(nodes).toHaveLength(23);
    expect(nodes.find((n) => n.id === 'dep-eng-mob')?.parentId).toBe('dep-eng-swd');
  });
});

describe('positions API', () => {
  const newPosition = (patch: Partial<PositionInput> = {}): PositionInput => ({
    code: 'ENG-ARCH',
    title: { en: 'Software Architect', ar: 'مهندس معماري للبرمجيات' },
    departmentId: 'dep-eng-swd',
    description: '',
    level: 'lead',
    ...patch,
  });

  it('lists with search and department (incl. subdepartments) / level / status filters', async () => {
    expect((await api.getPositions({ page: 1, pageSize: 50 })).total).toBe(36);
    expect((await api.getPositions({ page: 1, pageSize: 50, search: 'data' })).items.map((p) => p.code).sort()).toEqual(['DATA-ANL', 'DATA-SDE']);
    const eng = await api.getPositions({ page: 1, pageSize: 50, filters: { departmentId: 'dep-eng' } });
    expect(eng.items.map((p) => p.code)).toEqual(expect.arrayContaining(['ENG-EM', 'SWD-SE', 'MOB-DEV', 'QA-ENG', 'DATA-SDE']));
    expect(eng.items.some((p) => p.code === 'SLS-HEAD')).toBe(false);
    expect((await api.getPositions({ page: 1, pageSize: 50, filters: { level: 'director' } })).items.map((p) => p.code).sort()).toEqual(['OPS-DIR', 'SLS-HEAD']);
    expect((await api.getPositions({ page: 1, pageSize: 50, filters: { status: 'inactive' } })).total).toBe(2);
  });

  it('creates, updates and changes status; rejects duplicates and inactive departments', async () => {
    const created = await api.createPosition(newPosition());
    expect(created).toMatchObject({ code: 'ENG-ARCH', status: 'active', department: { id: 'dep-eng-swd' } });
    expect(await fieldErrors(api.createPosition(newPosition({ code: 'eng-arch' })))).toEqual({ code: ['duplicate'] });
    expect(await fieldErrors(api.createPosition(newPosition({ code: 'LAB-01', departmentId: 'dep-eng-lab' })))).toEqual({ departmentId: ['inactive'] });

    const updated = await api.updatePosition(created.id, newPosition({ level: 'senior', departmentId: 'dep-eng-mob' }));
    expect(updated).toMatchObject({ level: 'senior', department: { id: 'dep-eng-mob' } });
    expect((await api.updatePositionStatus(created.id, 'inactive')).status).toBe('inactive');
    // A position of an inactive department cannot be re-activated.
    expect(await fieldErrors(api.updatePositionStatus('pos-25', 'active'))).toEqual({ status: ['inactive-department'] });
  });
});

describe('locations API', () => {
  const newLocation = (patch: Partial<LocationInput> = {}): LocationInput => ({
    code: 'DOH-01',
    name: { en: 'Doha Office', ar: 'مكتب الدوحة' },
    address: 'West Bay, Tower 2',
    city: 'Doha',
    country: 'QA',
    ...patch,
  });

  it('lists with search (incl. city) and country / status filters', async () => {
    expect((await api.getLocations({ page: 1, pageSize: 10 })).total).toBe(6);
    expect((await api.getLocations({ page: 1, pageSize: 10, search: 'riyadh' })).items.map((l) => l.code)).toEqual(['RUH-01']);
    expect((await api.getLocations({ page: 1, pageSize: 10, filters: { country: 'JO' } })).total).toBe(4);
    expect((await api.getLocations({ page: 1, pageSize: 10, filters: { country: 'JO', status: 'active' } })).total).toBe(3);
  });

  it('creates, reads, updates and deactivates; rejects duplicate codes and unknown countries', async () => {
    const created = await api.createLocation(newLocation());
    expect(await api.getLocationById(created.id)).toMatchObject({ code: 'DOH-01', country: 'QA', status: 'active' });
    expect(await fieldErrors(api.createLocation(newLocation({ code: 'amm-hq' })))).toEqual({ code: ['duplicate'] });
    expect(await fieldErrors(api.createLocation(newLocation({ code: 'XX-01', country: 'ZZ' })))).toEqual({ country: ['required'] });
    expect((await api.updateLocation(created.id, newLocation({ city: 'Lusail' }))).city).toBe('Lusail');
    expect((await api.updateLocationStatus(created.id, 'inactive')).status).toBe('inactive');
    expect((await api.getOrganizationSummary()).locations).toEqual({ total: 7, active: 5 });
  });
});

describe('summary, lookups and simulated failures', () => {
  it('summary counts top-level departments separately from all units', async () => {
    expect(await api.getOrganizationSummary()).toEqual({
      departments: { total: 8, active: 8 },
      positions: { total: 36, active: 34 },
      locations: { total: 6, active: 5 },
      units: { total: 23, active: 22 },
    });
  });

  it('manager lookup searches active employees (employee-backed; at most 50 per request)', async () => {
    expect((await api.getManagerOptions('')).length).toBe(50);
    expect((await api.getManagerOptions('EMP-0007')).map((p) => p.name.en)).toEqual(['Nadia Fares']);
    expect((await api.getManagerOptions('nadia'))[0]!.jobTitle.en).toBe('Head of Sales');
    expect((await api.getManagerOptions('yousef')).map((p) => p.id)).toEqual(['emp-0001', 'emp-0016']);
  });

  it('surfaces simulated server errors as ApiError', async () => {
    failNextRequest('SERVER');
    await expect(api.getDepartments({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'SERVER', status: 500 });
  });
});
