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
  /** Personal details (birth date, gender, nationality, marital status, personal contact, address, emergency contact, identity documents). */
  'employees:read:personal',
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
  /** Own compensation, payslips (approved runs only) and payroll history. */
  'payroll:read:own',
  'payroll:write',
  /** Approve or reject payroll runs submitted for approval (never one's own run). */
  'payroll:approve',
  'recruitment:read',
  /** Requisitions of the departments the user manages (or where they are the hiring manager) and those candidates — read-only, no salaries or offers. */
  'recruitment:read:team',
  'recruitment:write',
  'performance:read',
  /** The team's goals, reviews and development plans (departments the user manages). */
  'performance:read:team',
  /** Own goals, self-assessments, review results and development plans. */
  'performance:read:own',
  'performance:write',
  /** Write manager reviews, goals and development plans for the user's team. */
  'performance:review:team',
  /** Review cycles, templates, competencies and the rating scale (performance configuration). */
  'performance:manage-config',
  'documents:read',
  /** Documents of the departments the user manages: standard confidentiality, manager-visible categories only. */
  'documents:read:team',
  /** Own documents of employee-visible categories (never internal HR notes). */
  'documents:read:own',
  'documents:write',
  /** Document categories, required-document rules and the expiry warning threshold. */
  'documents:manage-config',
  'reports:view',
  'settings:manage',
  'users:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** What every staff member can do for themselves (all roles are also employees). */
const SELF_SERVICE: readonly Permission[] = ['profile:view', 'attendance:read:own', 'leave:read:own', 'leave:request', 'performance:read:own', 'payroll:read:own', 'documents:read:own'];

/** Full read/write on the HR areas. */
const HR_CORE: readonly Permission[] = [
  'dashboard:view',
  'employees:read',
  'employees:read:personal',
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
  /** All HR modules (read/write), payroll approval and HR settings — not user/role management. */
  'hr-admin': [...SELF_SERVICE, ...HR_CORE, 'leave:manage-policies', 'performance:manage-config', 'payroll:read', 'payroll:write', 'payroll:approve', 'documents:manage-config', 'settings:manage'],
  /** HR modules (read/write) and leave approval; payroll read-only; no settings. */
  'hr-manager': [...SELF_SERVICE, ...HR_CORE, 'payroll:read'],
  /** Their own team only: employees, attendance and leave (incl. approving the team's leave), their team's recruitment (read-only) and performance (incl. manager reviews). */
  'department-manager': [...SELF_SERVICE, 'dashboard:view', 'employees:read:team', 'attendance:read:team', 'leave:read:team', 'leave:approve:team', 'recruitment:read:team', 'performance:read:team', 'performance:review:team', 'documents:read:team'],
  /** Self-service only: own profile, attendance, leave, performance and payslips. */
  employee: SELF_SERVICE,
  /** Recruitment (read/write) and positions (read). */
  recruiter: [...SELF_SERVICE, 'dashboard:view', 'recruitment:read', 'recruitment:write', 'organization:read'],
  /** Payroll processing (read/write, not approval) and employees (read). */
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
