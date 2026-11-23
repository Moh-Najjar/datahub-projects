import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from '@/core/config/permissions';
import { employeesApi } from '@/modules/employees';
import { usersApi as api } from '@/modules/users/api/usersApi';
import type { UsersCaller } from '@/modules/users/types/users';
import { PERMISSION_INFO } from '@/modules/users/utils/permissionRules';

/* Users & Roles backend on a fixed clock: Monday 16 Nov 2026, 10:30. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const ADMIN: UsersCaller = { userId: 'usr-0001', role: 'system-admin', name: { en: 'Omar Khalil', ar: 'عمر خليل' } };
const newUser = { name: { en: 'Nour Test', ar: 'نور تجربة' }, email: 'nour.test@demo.datahubhr.test', role: 'recruiter' as const, employeeId: null };

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const e = await promise.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e, 'expected an error').toBeInstanceOf(ApiError);
  return e as ApiError;
}

describe('directory', () => {
  it('lists the seven demo accounts with their linked employees; nothing invents a last sign-in', async () => {
    const all = await api.getUsers({ page: 1, pageSize: 50 }, ADMIN);
    expect(all.total).toBe(7);
    expect(all.items.every((u) => u.lastLoginAt === null)).toBe(true);
    const dana = all.items.find((u) => u.id === 'usr-0004')!;
    expect(dana.employee).toMatchObject({ id: 'emp-0001', employeeNumber: 'EMP-0001' });
    expect(dana.employee!.department.name.en).toBe('Engineering');
  });

  it('searches by name, e-mail and employee number; filters by role, status and department', async () => {
    expect((await api.getUsers({ page: 1, pageSize: 50, search: 'EMP-0025' }, ADMIN)).items.map((u) => u.id)).toEqual(['usr-0005']);
    expect((await api.getUsers({ page: 1, pageSize: 50, search: 'payroll@' }, ADMIN)).items.map((u) => u.id)).toEqual(['usr-0007']);
    expect((await api.getUsers({ page: 1, pageSize: 50, filters: { role: 'hr-manager' } }, ADMIN)).items.map((u) => u.id)).toEqual(['usr-0003']);
    const eng = await api.getUsers({ page: 1, pageSize: 50, filters: { departmentId: 'dep-eng' } }, ADMIN);
    expect(eng.items.map((u) => u.id).sort()).toEqual(['usr-0004', 'usr-0005']);
    expect((await api.getUsers({ page: 1, pageSize: 50, sortBy: 'email', sortDirection: 'asc' }, ADMIN)).items[0]!.email).toBe('dept.manager@demo.datahubhr.test');
  });
});

describe('create, edit, link', () => {
  it('creates an account (validated, unique e-mail) and audits it', async () => {
    expect((await failure(api.createUser({ ...newUser, email: 'bad', name: { en: '', ar: 'Latin' } }, '', ADMIN))).fieldErrors).toEqual({ 'name.en': ['required'], 'name.ar': ['arabicRequired'], email: ['invalidEmail'] });
    expect((await failure(api.createUser({ ...newUser, email: 'HR.Admin@demo.datahubhr.test' }, '', ADMIN))).fieldErrors).toEqual({ email: ['duplicateEmail'] });
    const u = await api.createUser(newUser, 'New recruiter', ADMIN);
    expect(u).toMatchObject({ id: 'usr-0008', role: 'recruiter', status: 'active', origin: 'portal', employee: null, lastLoginAt: null });
    expect(Object.keys(u)).not.toContain('password');
  });

  it('links one account per active employee; unlinking keeps the account', async () => {
    const u = await api.createUser(newUser, '', ADMIN);
    expect((await failure(api.linkEmployee(u.id, 'emp-0001', '', ADMIN))).fieldErrors).toEqual({ employeeId: ['employeeLinked'] });
    expect((await failure(api.linkEmployee(u.id, 'emp-9999', '', ADMIN))).fieldErrors).toEqual({ employeeId: ['notFound'] });
    const gone = (await employeesApi.getEmployees({ page: 1, pageSize: 1, filters: { status: 'inactive' } }, { kind: 'organization', role: 'system-admin' })).items[0]!;
    expect((await failure(api.linkEmployee(u.id, gone.id, '', ADMIN))).fieldErrors).toEqual({ employeeId: ['employeeInactive'] });
    expect((await api.linkEmployee(u.id, 'emp-0030', 'Joined as recruiter', ADMIN)).employee?.id).toBe('emp-0030');
    expect((await api.linkEmployee(u.id, null, 'Moved', ADMIN)).employee).toBeNull();
  });

  it('edits name and e-mail', async () => {
    const u = await api.updateUser('usr-0006', { name: { en: 'Maya Jaber-Saleh', ar: 'مايا جابر صالح' }, email: 'recruiter@demo.datahubhr.test' }, '', ADMIN);
    expect(u.name.en).toBe('Maya Jaber-Saleh');
  });
});

describe('role and status protection', () => {
  it('no administrator changes their own role or status', async () => {
    const me = await api.getUserById('usr-0001', ADMIN);
    expect(me.can).toMatchObject({ changeRole: false, changeStatus: false, reason: 'self' });
    expect((await failure(api.updateUserRole('usr-0001', 'hr-admin', 'x', ADMIN))).fieldErrors).toEqual({ role: ['self'] });
    expect((await failure(api.updateUserStatus('usr-0001', 'inactive', 'x', ADMIN))).fieldErrors).toEqual({ status: ['self'] });
  });

  it('the last active System Administrator keeps the role and stays active', async () => {
    const second = await api.createUser({ ...newUser, role: 'system-admin' }, 'Second administrator', ADMIN);
    // Signed in as the new administrator: the original one is not the last any more → may be changed…
    const NEW = { userId: second.id, role: 'system-admin' as const, name: second.name };
    expect((await api.getUserById('usr-0001', NEW)).can.changeRole).toBe(true);
    // …but once the second administrator is gone, the first is the last one again.
    await api.updateUserStatus(second.id, 'inactive', 'Temporary account ended', ADMIN);
    const OTHER = { userId: 'usr-0002', role: 'system-admin' as const, name: { en: 'x', ar: 'س' } };
    expect((await api.getUserById('usr-0001', OTHER)).can.reason).toBe('last-admin');
    expect((await failure(api.updateUserRole('usr-0001', 'employee', 'x', OTHER))).fieldErrors).toEqual({ role: ['last-admin'] });
    expect((await failure(api.updateUserStatus('usr-0001', 'suspended', 'x', OTHER))).fieldErrors).toEqual({ status: ['last-admin'] });
  });

  it('role and status changes need a reason and are audited', async () => {
    expect((await failure(api.updateUserRole('usr-0005', 'hr-manager', '', ADMIN))).fieldErrors).toEqual({ reason: ['reasonRequired'] });
    const u = await api.updateUserRole('usr-0005', 'hr-manager', 'Promotion', ADMIN);
    expect(u.permissions).toEqual([...ROLE_PERMISSIONS['hr-manager']]);
    expect((await failure(api.updateUserStatus('usr-0005', 'active', '', ADMIN))).code).toBe('CONFLICT');
    expect((await api.updateUserStatus('usr-0005', 'suspended', 'Investigation', ADMIN)).status).toBe('suspended');
    // The audit entries are checked in src/test/accessIntegration.test.ts (the log belongs to System Settings).
  });
});

describe('roles and the permission matrix', () => {
  it('seven system roles with account and permission counts', async () => {
    const roles = await api.getRoles(ADMIN);
    expect(roles.map((r) => r.role)).toEqual([...ROLES]);
    expect(roles.find((r) => r.role === 'system-admin')).toMatchObject({ users: 1, permissions: PERMISSIONS.length, locked: true, system: true });
  });

  it('every permission is grouped by module; roles show their reference definitions (read-only)', async () => {
    const m = await api.getPermissionMatrix(ADMIN);
    expect(m.permissions.map((p) => p.permission)).toEqual([...PERMISSIONS]);
    expect(PERMISSION_INFO.find((p) => p.permission === 'hr.payroll.view')).toMatchObject({ group: 'payroll', sensitive: true, scope: 'organization' });
    expect(PERMISSION_INFO.find((p) => p.permission === 'hr.leave.view.team')?.scope).toBe('team');
    expect(m.roles.find((r) => r.role === 'hr-manager')?.permissions).toEqual([...ROLE_PERMISSIONS['hr-manager']]);
  });
});
