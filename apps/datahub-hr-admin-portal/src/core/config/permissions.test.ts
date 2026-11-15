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
    for (const x of ['employees:write', 'organization:write', 'attendance:write', 'leave:approve', 'leave:manage-policies', 'payroll:write', 'recruitment:write', 'performance:write', 'documents:write', 'settings:manage'] as const) {
      expect(p.has(x), x).toBe(true);
    }
    expect(p.has('users:manage')).toBe(false);
  });

  it('HR Manager: HR read/write and leave approval; payroll read-only; no settings', () => {
    const p = grants('hr-manager');
    expect(p.has('employees:write')).toBe(true);
    expect(p.has('leave:approve')).toBe(true);
    expect(p.has('payroll:read')).toBe(true);
    expect(p.has('payroll:write')).toBe(false);
    expect(p.has('settings:manage')).toBe(false);
    expect(p.has('users:manage')).toBe(false);
  });

  it('Department Manager: team scope only', () => {
    const p = grants('department-manager');
    for (const x of ['employees:read:team', 'attendance:read:team', 'leave:read:team', 'leave:approve:team'] as const) expect(p.has(x), x).toBe(true);
    for (const x of ['employees:read', 'attendance:read', 'leave:read', 'leave:approve', 'employees:write', 'payroll:read'] as const) expect(p.has(x), x).toBe(false);
  });

  it('Employee: self-service only (no dashboard, no other people)', () => {
    expect(grants('employee')).toEqual(new Set(['profile:view', 'attendance:read:own', 'leave:read:own', 'leave:request']));
  });

  it('Recruiter: recruitment read/write and positions read; no employee records', () => {
    const p = grants('recruiter');
    expect(p.has('recruitment:write')).toBe(true);
    expect(p.has('organization:read')).toBe(true);
    expect(p.has('organization:write')).toBe(false);
    expect(p.has('employees:read')).toBe(false);
  });

  it('Payroll Officer: payroll read/write and employees read', () => {
    const p = grants('payroll-officer');
    expect(p.has('payroll:write')).toBe(true);
    expect(p.has('employees:read')).toBe(true);
    expect(p.has('employees:write')).toBe(false);
    expect(p.has('leave:approve')).toBe(false);
  });

  it('every role can view its own profile and request leave; only valid permissions are granted', () => {
    for (const role of ROLES) {
      expect(hasPermission(role, 'profile:view'), role).toBe(true);
      expect(hasPermission(role, 'leave:request'), role).toBe(true);
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    }
  });

  it('hasAnyPermission matches org-wide OR scoped grants', () => {
    expect(hasAnyPermission('department-manager', ['employees:read', 'employees:read:team'])).toBe(true);
    expect(hasAnyPermission('employee', ['employees:read', 'employees:read:team'])).toBe(false);
  });

  it('every role and permission has an English and Arabic label', () => {
    for (const lang of ['en', 'ar'] as const) {
      const common = resources[lang].common;
      for (const role of ROLES) expect(common.roles[role], `${lang} role ${role}`).toBeTruthy();
      for (const p of PERMISSIONS) expect((common.permissions as Record<string, string>)[p.replaceAll(':', '_')], `${lang} ${p}`).toBeTruthy();
    }
  });
});
