/*
 * Roles and permissions — the approved Phase 1 matrix.
 *
 * THIS IS NOT SECURITY. The frontend uses permissions only to decide what to show. Real authorization
 * (who may read or change which records, including team/self scoping) must be enforced by the backend
 * on every request. The same role/permission strings are intended as the contract with that backend.
 *
 * Naming: `<area>:<action>` applies to the whole organisation; a `:team` / `:own` suffix narrows the
 * scope to the user's team / the user's own records.
 */

export const ROLES = [
  'system-admin',
  'hr-admin',
  'hr-manager',
  'department-manager',
  'employee',
  'recruiter',
  'payroll-officer',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'dashboard:view',
  'profile:view',
  'employees:read',
  'employees:read:team',
  'employees:write',
  'organization:read',
  'organization:write',
  'attendance:read',
  'attendance:read:team',
  'attendance:read:own',
  'attendance:write',
  'leave:read',
  'leave:read:team',
  'leave:read:own',
  'leave:request',
  'leave:approve',
  'leave:approve:team',
  'leave:manage-policies',
  'payroll:read',
  'payroll:write',
  'recruitment:read',
  'recruitment:write',
  'performance:read',
  'performance:write',
  'documents:read',
  'documents:write',
  'reports:view',
  'settings:manage',
  'users:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** What every staff member can do for themselves (all roles are also employees). */
const SELF_SERVICE: readonly Permission[] = ['profile:view', 'attendance:read:own', 'leave:read:own', 'leave:request'];

/** Full read/write on the HR areas. */
const HR_CORE: readonly Permission[] = [
  'dashboard:view',
  'employees:read',
  'employees:write',
  'organization:read',
  'organization:write',
  'attendance:read',
  'attendance:write',
  'leave:read',
  'leave:approve',
  'recruitment:read',
  'recruitment:write',
  'performance:read',
  'performance:write',
  'documents:read',
  'documents:write',
  'reports:view',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  /** Everything, including system settings and user/role management. */
  'system-admin': PERMISSIONS,
  /** All HR modules (read/write) and HR settings — not user/role management. */
  'hr-admin': [...SELF_SERVICE, ...HR_CORE, 'leave:manage-policies', 'payroll:read', 'payroll:write', 'settings:manage'],
  /** HR modules (read/write) and leave approval; payroll read-only; no settings. */
  'hr-manager': [...SELF_SERVICE, ...HR_CORE, 'payroll:read'],
  /** Their own team only: employees, attendance and leave (incl. approving the team's leave). */
  'department-manager': [...SELF_SERVICE, 'dashboard:view', 'employees:read:team', 'attendance:read:team', 'leave:read:team', 'leave:approve:team'],
  /** Self-service only: own profile, attendance and leave. */
  employee: SELF_SERVICE,
  /** Recruitment (read/write) and positions (read). */
  recruiter: [...SELF_SERVICE, 'dashboard:view', 'recruitment:read', 'recruitment:write', 'organization:read'],
  /** Payroll (read/write) and employees (read). */
  'payroll-officer': [...SELF_SERVICE, 'dashboard:view', 'payroll:read', 'payroll:write', 'employees:read'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** True when the role has at least one of the permissions (e.g. org-wide OR team-scoped read). */
export function hasAnyPermission(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
