import { PERMISSIONS, SELF_SERVICE, type Permission } from '@/core/config/permissions';
import type { PermissionGroup, PermissionInfo } from '@/modules/users/types/users';

/*
 * Display metadata of the permissions in the (read-only) matrix: module group, scope, sensitivity, locks and
 * prerequisites. The roles themselves are the backend's.
 */

/** Module group of a permission id (`hr.leave.approve` → leave, `organization.employees.view` → employees…). */
function groupOf(permission: Permission): PermissionGroup {
  if (permission.startsWith('identity.')) return 'users';
  if (permission.startsWith('recruitment.')) return 'recruitment';
  if (permission.startsWith('organization.employees.')) return 'employees';
  if (permission.startsWith('organization.')) return 'organization';
  if (permission === 'hr.policies.manage') return 'leave';
  return permission.split('.')[1] as PermissionGroup;
}

/** Salary, personal details, approval of payroll, and system administration. */
export const SENSITIVE: ReadonlySet<Permission> = new Set<Permission>(['hr.employees.view.personal', 'hr.payroll.view', 'hr.payroll.manage', 'hr.payroll.approve', 'hr.settings.manage', 'identity.users.manage']);
export const SYSTEM_ONLY: ReadonlySet<Permission> = new Set<Permission>(['identity.users.manage']);

/** A permission needs at least one of these in the same role. */
export const REQUIRES: Partial<Record<Permission, Permission[]>> = {
  'organization.employees.manage': ['organization.employees.view'],
  'hr.employees.view.personal': ['organization.employees.view', 'hr.employees.view.team'],
  'organization.departments.manage': ['organization.departments.view'],
  'hr.attendance.manage': ['hr.attendance.view'],
  'hr.leave.approve': ['hr.leave.view'],
  'hr.leave.approve.team': ['hr.leave.view.team', 'hr.leave.view'],
  'hr.policies.manage': ['hr.leave.view'],
  'recruitment.jobs.manage': ['recruitment.jobs.view'],
  'hr.performance.manage': ['hr.performance.view'],
  'hr.performance.review.team': ['hr.performance.view.team', 'hr.performance.view'],
  'hr.performance.config.manage': ['hr.performance.view'],
  'hr.payroll.manage': ['hr.payroll.view'],
  'hr.payroll.approve': ['hr.payroll.view'],
  'hr.documents.manage': ['hr.documents.view'],
  'hr.documents.config.manage': ['hr.documents.view'],
};

export const PERMISSION_INFO: readonly PermissionInfo[] = PERMISSIONS.map((permission) => ({
  permission,
  group: groupOf(permission),
  scope: permission.endsWith('.team') ? 'team' : permission.endsWith('.own') || permission === 'hr.profile.view' || permission === 'hr.leave.request' ? 'own' : 'organization',
  sensitive: SENSITIVE.has(permission),
  locked: SELF_SERVICE.includes(permission) ? 'self-service' : SYSTEM_ONLY.has(permission) ? 'system-only' : null,
  requiresAnyOf: REQUIRES[permission] ?? [],
}));
