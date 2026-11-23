import { describe, expect, it } from 'vitest';
import { resources } from '@/i18n';
import { hasAnyPermission, hasPermission, PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Permission, type Role } from './permissions';

const grants = (role: Role) => new Set<Permission>(ROLE_PERMISSIONS[role]);

describe('role/permission matrix (Phase 1)', () => {
  it('System Administrator has every permission', () => {
    expect(grants('system-admin')).toEqual(new Set(PERMISSIONS));
  });

  it('HR Administrator: all HR areas and HR settings, but not user/role management', () => {
    const p = grants('hr-admin');
    for (const x of ['organization.employees.manage', 'organization.departments.manage', 'hr.attendance.manage', 'hr.leave.approve', 'hr.policies.manage', 'hr.payroll.manage', 'recruitment.jobs.manage', 'hr.performance.manage', 'hr.documents.manage', 'hr.settings.manage'] as const) {
      expect(p.has(x), x).toBe(true);
    }
    expect(p.has('identity.users.manage')).toBe(false);
  });

  it('HR Manager: HR read/write and leave approval; payroll read-only; no settings', () => {
    const p = grants('hr-manager');
    expect(p.has('organization.employees.manage')).toBe(true);
    expect(p.has('hr.leave.approve')).toBe(true);
    expect(p.has('hr.payroll.view')).toBe(true);
    expect(p.has('hr.payroll.manage')).toBe(false);
    expect(p.has('hr.settings.manage')).toBe(false);
    expect(p.has('identity.users.manage')).toBe(false);
  });

  it('Department Manager: team scope only', () => {
    const p = grants('department-manager');
    for (const x of ['hr.employees.view.team', 'hr.attendance.view.team', 'hr.leave.view.team', 'hr.leave.approve.team', 'hr.recruitment.view.team', 'hr.performance.view.team', 'hr.performance.review.team', 'hr.reports.view.team'] as const) expect(p.has(x), x).toBe(true);
    for (const x of ['organization.employees.view', 'hr.attendance.view', 'hr.leave.view', 'hr.leave.approve', 'organization.employees.manage', 'hr.payroll.view', 'hr.payroll.manage', 'hr.payroll.approve', 'recruitment.jobs.view', 'recruitment.jobs.manage', 'hr.performance.view', 'hr.performance.manage', 'hr.performance.config.manage', 'hr.reports.view'] as const) expect(p.has(x), x).toBe(false);
  });

  it("employees' personal information: only System Administrator, HR Administrator and HR Manager", () => {
    expect(ROLES.filter((role) => hasPermission(role, 'hr.employees.view.personal'))).toEqual(['system-admin', 'hr-admin', 'hr-manager']);
    // Roles that read employee records without personal details keep their existing access.
    expect(hasPermission('payroll-officer', 'organization.employees.view')).toBe(true);
    expect(hasPermission('department-manager', 'hr.employees.view.team')).toBe(true);
    // Every role that may write employees can also read what it edits.
    for (const role of ROLES) if (hasPermission(role, 'organization.employees.manage')) expect(hasPermission(role, 'hr.employees.view.personal'), role).toBe(true);
  });

  it('performance configuration: System Administrator and HR Administrator only; own performance for every role', () => {
    expect(ROLES.filter((role) => hasPermission(role, 'hr.performance.config.manage'))).toEqual(['system-admin', 'hr-admin']);
    for (const role of ROLES) expect(hasPermission(role, 'hr.performance.view.own'), role).toBe(true);
    expect(hasPermission('hr-manager', 'hr.performance.manage')).toBe(true);
  });

  it('Employee: self-service only (no dashboard, no other people)', () => {
    expect(grants('employee')).toEqual(new Set(['hr.profile.view', 'hr.attendance.view.own', 'hr.leave.view.own', 'hr.leave.request', 'hr.performance.view.own', 'hr.payroll.view.own', 'hr.documents.view.own']));
  });

  it('Recruiter: recruitment read/write and positions read; no employee records', () => {
    const p = grants('recruiter');
    expect(p.has('recruitment.jobs.manage')).toBe(true);
    expect(p.has('organization.departments.view')).toBe(true);
    expect(p.has('organization.departments.manage')).toBe(false);
    expect(p.has('organization.employees.view')).toBe(false);
  });

  it('Payroll Officer: payroll read/write and employees read', () => {
    const p = grants('payroll-officer');
    expect(p.has('hr.payroll.manage')).toBe(true);
    expect(p.has('organization.employees.view')).toBe(true);
    expect(p.has('organization.employees.manage')).toBe(false);
    expect(p.has('hr.leave.approve')).toBe(false);
    // Processing and approval are separated: the Payroll Officer prepares runs, the HR Administrator approves them.
    expect(p.has('hr.payroll.approve')).toBe(false);
  });

  it('documents: configuration for System and HR Administrators; team documents for the Department Manager; own documents for everyone', () => {
    expect(ROLES.filter((role) => hasPermission(role, 'hr.documents.config.manage'))).toEqual(['system-admin', 'hr-admin']);
    expect(ROLES.filter((role) => hasPermission(role, 'hr.documents.view.team'))).toEqual(['system-admin', 'department-manager']);
    expect(ROLES.filter((role) => hasPermission(role, 'hr.documents.view'))).toEqual(['system-admin', 'hr-admin', 'hr-manager']);
    expect(ROLES.filter((role) => hasPermission(role, 'hr.documents.manage'))).toEqual(['system-admin', 'hr-admin', 'hr-manager']);
    for (const role of ROLES) expect(hasPermission(role, 'hr.documents.view.own'), role).toBe(true);
  });

  it('payroll approval: System Administrator and HR Administrator only; own payslips for every role', () => {
    expect(ROLES.filter((role) => hasPermission(role, 'hr.payroll.approve'))).toEqual(['system-admin', 'hr-admin']);
    expect(ROLES.filter((role) => hasPermission(role, 'hr.payroll.view'))).toEqual(['system-admin', 'hr-admin', 'hr-manager', 'payroll-officer']);
    expect(ROLES.filter((role) => hasPermission(role, 'hr.payroll.manage'))).toEqual(['system-admin', 'hr-admin', 'payroll-officer']);
    for (const role of ROLES) expect(hasPermission(role, 'hr.payroll.view.own'), role).toBe(true);
  });

  it('every role can view its own profile and request leave; only valid permissions are granted', () => {
    for (const role of ROLES) {
      expect(hasPermission(role, 'hr.profile.view'), role).toBe(true);
      expect(hasPermission(role, 'hr.leave.request'), role).toBe(true);
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    }
  });

  it('hasAnyPermission matches org-wide OR scoped grants', () => {
    expect(hasAnyPermission('department-manager', ['organization.employees.view', 'hr.employees.view.team'])).toBe(true);
    expect(hasAnyPermission('employee', ['organization.employees.view', 'hr.employees.view.team'])).toBe(false);
  });

  it('every role and permission has an English and Arabic label', () => {
    for (const lang of ['en', 'ar'] as const) {
      const common = resources[lang].common;
      for (const role of ROLES) expect(common.roles[role], `${lang} role ${role}`).toBeTruthy();
      for (const p of PERMISSIONS) expect((common.permissions as Record<string, string>)[p.replaceAll('.', '_')], `${lang} ${p}`).toBeTruthy();
    }
  });
});

describe('reports (Phase 10: approved addition hr.reports.view.team)', () => {
  it('organisation-wide reports for HR roles; team reports for the Department Manager only', () => {
    expect(ROLES.filter((role) => hasPermission(role, 'hr.reports.view'))).toEqual(['system-admin', 'hr-admin', 'hr-manager']);
    expect(ROLES.filter((role) => hasPermission(role, 'hr.reports.view.team'))).toEqual(['system-admin', 'department-manager']);
    // Payroll Officer and Recruiter report only through their module permissions; Employees have no reports.
    for (const role of ['payroll-officer', 'recruiter', 'employee'] as const) expect(hasAnyPermission(role, ['hr.reports.view', 'hr.reports.view.team']), role).toBe(false);
  });
});
