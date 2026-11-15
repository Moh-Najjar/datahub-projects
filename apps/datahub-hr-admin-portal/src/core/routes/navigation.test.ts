import { describe, expect, it } from 'vitest';
import { hasAnyPermission, type Role } from '@/core/config/permissions';
import { landingPath, NAV_ITEMS, visibleNavGroups } from './navigation';

const canAnyFor = (role: Role) => (perms: Parameters<typeof hasAnyPermission>[1]) => hasAnyPermission(role, perms);
const visibleKeys = (role: Role) => visibleNavGroups(canAnyFor(role)).flatMap((g) => g.items.map((i) => i.key));

describe('role-based navigation', () => {
  it('System Administrator sees every item', () => {
    expect(visibleKeys('system-admin')).toEqual(NAV_ITEMS.map((i) => i.key));
  });

  it('Employee sees only self-service items', () => {
    expect(visibleKeys('employee')).toEqual(['profile', 'attendance', 'leave']);
  });

  it('Department Manager sees team areas but not organisation-wide admin areas', () => {
    expect(visibleKeys('department-manager')).toEqual(['dashboard', 'profile', 'employees', 'attendance', 'leave']);
  });

  it('Recruiter sees recruitment and organization (positions)', () => {
    expect(visibleKeys('recruiter')).toEqual(['dashboard', 'profile', 'organization', 'attendance', 'leave', 'recruitment']);
  });

  it('Payroll Officer sees payroll and employees', () => {
    expect(visibleKeys('payroll-officer')).toEqual(['dashboard', 'profile', 'employees', 'attendance', 'leave', 'payroll']);
  });

  it('HR Administrator sees settings but not users & roles', () => {
    const keys = visibleKeys('hr-admin');
    expect(keys).toContain('settings');
    expect(keys).not.toContain('users');
  });

  it('lands on the dashboard, or the profile for roles without it', () => {
    expect(landingPath(canAnyFor('hr-manager'))).toBe('/dashboard');
    expect(landingPath(canAnyFor('employee'))).toBe('/profile');
  });

  it('only Phase 3 pages are available; planned areas are marked unavailable', () => {
    expect(NAV_ITEMS.filter((i) => i.available).map((i) => i.key)).toEqual(['dashboard', 'profile']);
  });
});
