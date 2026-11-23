import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import { hasPermission, ROLE_PERMISSIONS, setSignedInPermissions } from '@/core/config/permissions';
import { authApi } from '@/modules/auth/api/authApi';
import { HandoffError } from '@/modules/auth/handoff/workspaceHandoff';
import { employeesApi } from '@/modules/employees/api/employeesApi';
import { payrollApi } from '@/modules/payroll/api/payrollApi';
import { reportsApi } from '@/modules/reports/api/reportsApi';
import { settingsApi } from '@/modules/settings/api/settingsApi';
import { usersApi } from '@/modules/users/api/usersApi';
import { handoffToken } from './handoffToken';

/*
 * Cross-module access rules (sign-in token ↔ permissions ↔ every module's scoping). Lives outside the
 * modules because it exercises several of them together, through their API services.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const ADMIN = { userId: 'usr-0001', role: 'system-admin' as const, name: { en: 'Omar Khalil', ar: 'عمر خليل' } };
async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const e = await promise.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e, 'expected an error').toBeTruthy();
  return e as ApiError;
}

describe('Workspace sign-in (backend access token)', () => {
  it('the session is read from the token: user, first known role, permissions and expiry', async () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    const session = await authApi.exchangeHandoff(handoffToken('admin@datahub.test', 120_000, { role: ['cms-editor', 'system-admin'], permission: ['hr.leave.view', 'cms.blogs.view'], exp }));
    expect(session.user).toMatchObject({ email: 'admin@datahub.test', role: 'system-admin' });
    expect(session.expiresAt).toBe(new Date(exp * 1000).toISOString());
    // Unknown claims are dropped; `hr.profile.view` is granted to everyone until the backend issues it.
    expect(session.permissions).toEqual(['hr.profile.view', 'hr.leave.view']);
  });

  it('interim fallbacks: an hr.* id the backend does not issue yet comes from its nearest existing permission', async () => {
    const session = await authApi.exchangeHandoff(handoffToken('x@datahub.test', 120_000, { role: 'hr-manager', permission: ['hr.dashboard.view', 'hr.policies.manage', 'organization.employees.manage', 'hr.attendance.view.team', 'recruitment.applications.view'] }));
    for (const p of ['hr.reports.view', 'hr.settings.manage', 'hr.employees.view.personal', 'hr.employees.view.team', 'hr.reports.view.team', 'hr.recruitment.view.team'] as const) expect(session.permissions).toContain(p);
  });

  it('a user without an HR role this portal knows is refused; so is an expired token', async () => {
    expect(((await failure(authApi.exchangeHandoff(handoffToken('editor@datahub.test', 120_000, { role: 'cms-editor', permission: ['cms.blogs.view'] })))) as unknown as HandoffError).reason).toBe('unknown-account');
    const past = Math.floor(Date.now() / 1000) - 1;
    expect(((await failure(authApi.exchangeHandoff(handoffToken('admin@datahub.test', 120_000, { role: 'system-admin', exp: past })))) as unknown as HandoffError).reason).toBe('expired');
  });
});

describe('the token\'s permissions take effect everywhere (UI and simulated backend)', () => {
  const HRM = { kind: 'organization' as const, userId: 'usr-0003', role: 'hr-manager' as const };

  it('an HR Manager whose token lacks hr.payroll.view gets no payroll data or reports; the reference role does', async () => {
    expect((await payrollApi.getPayrollSummary(HRM)).currency).toBe('JOD');
    setSignedInPermissions('hr-manager', ROLE_PERMISSIONS['hr-manager'].filter((p) => p !== 'hr.payroll.view'));
    expect(hasPermission('hr-manager', 'hr.payroll.view')).toBe(false);
    expect((await failure(payrollApi.getPayrollSummary(HRM))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getPayrollReports('payroll.summary', { from: '2026-09-01', to: '2026-11-16', departmentId: '', locationId: '', employmentType: '', employeeStatus: '' }, { userId: 'usr-0003', role: 'hr-manager' }))).code).toBe('FORBIDDEN');
    setSignedInPermissions(null);
    expect((await payrollApi.getPayrollSummary(HRM)).currency).toBe('JOD');
  });
});

describe('audit of user and role changes', () => {
  it('role and status changes are in the central audit log with who, what and why', async () => {
    await usersApi.updateUserRole('usr-0005', 'hr-manager', 'Promotion', ADMIN);
    await usersApi.updateUserStatus('usr-0005', 'suspended', 'Investigation', ADMIN);
    const log = await settingsApi.getAuditLog({ page: 1, pageSize: 10, filters: { target: 'user:usr-0005' } }, ADMIN);
    expect(log.items.map((a) => [a.module, a.action, a.previous, a.next, a.reason, a.actor.userId])).toEqual([
      ['users', 'status', 'active', 'suspended', 'Investigation', 'usr-0001'],
      ['users', 'role', 'employee', 'hr-manager', 'Promotion', 'usr-0001'],
    ]);
    // HR Administrators manage settings but not users: they never see account and role entries.
    const hr = await settingsApi.getAuditLog({ page: 1, pageSize: 50 }, { userId: 'usr-0002', role: 'hr-admin', name: { en: 'Lina', ar: 'لينا' } });
    expect(hr.items.every((a) => a.module === 'settings')).toBe(true);
  });
});

describe('scopes stay as they are', () => {
  it('Department Manager: own team only; unlinking the employee record removes the team', async () => {
    const team = await employeesApi.getEmployees({ page: 1, pageSize: 100 }, { kind: 'team', userId: 'usr-0004', role: 'department-manager' });
    expect(team.total).toBeGreaterThan(0);
    expect(team.items.every((e) => e.department.name.en !== 'Finance')).toBe(true);
    expect((await failure(employeesApi.getEmployeeById('emp-0005', { kind: 'team', userId: 'usr-0004', role: 'department-manager' }))).code).toBe('FORBIDDEN');
    await usersApi.linkEmployee('usr-0004', null, 'Account re-provisioned', ADMIN);
    expect((await employeesApi.getEmployees({ page: 1, pageSize: 100 }, { kind: 'team', userId: 'usr-0004', role: 'department-manager' })).total).toBe(0);
  });

  it('Payroll Officer sees employees without personal details; Recruiter has no salary access', async () => {
    const e = await employeesApi.getEmployeeById('emp-0025', { kind: 'organization', role: 'payroll-officer' });
    expect(e.personal).toBeNull();
    expect((await failure(payrollApi.getPayrollSummary({ kind: 'organization', userId: 'usr-0006', role: 'recruiter' }))).code).toBe('FORBIDDEN');
    expect(hasPermission('payroll-officer', 'identity.users.manage') || hasPermission('payroll-officer', 'hr.settings.manage')).toBe(false);
  });

  it('only the System Administrator manages users and roles', async () => {
    for (const role of ['hr-admin', 'hr-manager', 'department-manager', 'employee', 'recruiter', 'payroll-officer'] as const) {
      expect((await failure(usersApi.getUsers({ page: 1, pageSize: 10 }, { userId: 'x', role, name: { en: 'x', ar: 'س' } }))).code, role).toBe('FORBIDDEN');
    }
  });
});
