/*
 * Roles and permissions — the backend's names (the access token's `permission` claims, e.g. `hr.leave.approve.team`).
 *
 * THIS IS NOT SECURITY. The frontend uses permissions only to decide what to show. Real authorization (who may read or
 * change which records, including team/self scoping) is enforced by the backend on every request.
 *
 * The signed-in user's permissions come from their token (`setSignedInPermissions`, called by the AuthProvider).
 * `ROLE_PERMISSIONS` is the reference definition of the backend roles: shown read-only in Users & Roles and used by the
 * simulated backend for accounts that are not signed in (and by tests).
 *
 * Naming: `<area>.<resource>.<action>`; a `.team` / `.own` suffix narrows the scope to the user's team / own records.
 * The `hr.*` ids below that the backend does not issue yet (see INTERIM_FALLBACKS) are granted from their nearest
 * existing permission until it does.
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
  'hr.dashboard.view',
  'hr.profile.view',
  'organization.employees.view',
  'hr.employees.view.team',
  /** Personal details (birth date, gender, nationality, marital status, personal contact, address, emergency contact, identity documents). */
  'hr.employees.view.personal',
  'organization.employees.manage',
  'organization.departments.view',
  'organization.departments.manage',
  'hr.attendance.view',
  'hr.attendance.view.team',
  'hr.attendance.view.own',
  'hr.attendance.manage',
  'hr.leave.view',
  'hr.leave.view.team',
  'hr.leave.view.own',
  'hr.leave.request',
  'hr.leave.approve',
  'hr.leave.approve.team',
  'hr.policies.manage',
  'hr.payroll.view',
  /** Own compensation, payslips (approved runs only) and payroll history. */
  'hr.payroll.view.own',
  'hr.payroll.manage',
  /** Approve or reject payroll runs submitted for approval (never one's own run). */
  'hr.payroll.approve',
  'recruitment.jobs.view',
  /** Requisitions of the departments the user manages (or where they are the hiring manager) and those candidates — read-only, no salaries or offers. */
  'hr.recruitment.view.team',
  'recruitment.jobs.manage',
  'hr.performance.view',
  /** The team's goals, reviews and development plans (departments the user manages). */
  'hr.performance.view.team',
  /** Own goals, self-assessments, review results and development plans. */
  'hr.performance.view.own',
  'hr.performance.manage',
  /** Write manager reviews, goals and development plans for the user's team. */
  'hr.performance.review.team',
  /** Review cycles, templates, competencies and the rating scale (performance configuration). */
  'hr.performance.config.manage',
  'hr.documents.view',
  /** Documents of the departments the user manages: standard confidentiality, manager-visible categories only. */
  'hr.documents.view.team',
  /** Own documents of employee-visible categories (never internal HR notes). */
  'hr.documents.view.own',
  'hr.documents.manage',
  /** Document categories, required-document rules and the expiry warning threshold. */
  'hr.documents.config.manage',
  'hr.reports.view',
  /** Reports on the departments the user manages (team scope of each source module; no payroll, no organization-wide views). */
  'hr.reports.view.team',
  'hr.settings.manage',
  'identity.users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Self-service: every role keeps these (all staff are also employees). */
export const SELF_SERVICE: readonly Permission[] = ['hr.profile.view', 'hr.attendance.view.own', 'hr.leave.view.own', 'hr.leave.request', 'hr.performance.view.own', 'hr.payroll.view.own', 'hr.documents.view.own'];

/** Full read/write on the HR areas. */
const HR_CORE: readonly Permission[] = [
  'hr.dashboard.view',
  'organization.employees.view',
  'hr.employees.view.personal',
  'organization.employees.manage',
  'organization.departments.view',
  'organization.departments.manage',
  'hr.attendance.view',
  'hr.attendance.manage',
  'hr.leave.view',
  'hr.leave.approve',
  'recruitment.jobs.view',
  'recruitment.jobs.manage',
  'hr.performance.view',
  'hr.performance.manage',
  'hr.documents.view',
  'hr.documents.manage',
  'hr.reports.view',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  /** Everything, including system settings and user/role management. */
  'system-admin': PERMISSIONS,
  /** All HR modules (read/write), payroll approval and HR settings — not user/role management. */
  'hr-admin': [...SELF_SERVICE, ...HR_CORE, 'hr.policies.manage', 'hr.performance.config.manage', 'hr.payroll.view', 'hr.payroll.manage', 'hr.payroll.approve', 'hr.documents.config.manage', 'hr.settings.manage'],
  /** HR modules (read/write) and leave approval; payroll read-only; no settings. */
  'hr-manager': [...SELF_SERVICE, ...HR_CORE, 'hr.payroll.view'],
  /** Their own team only: employees, attendance and leave (incl. approving the team's leave), their team's recruitment (read-only) and performance (incl. manager reviews). */
  'department-manager': [...SELF_SERVICE, 'hr.dashboard.view', 'hr.employees.view.team', 'hr.attendance.view.team', 'hr.leave.view.team', 'hr.leave.approve.team', 'hr.recruitment.view.team', 'hr.performance.view.team', 'hr.performance.review.team', 'hr.documents.view.team', 'hr.reports.view.team'],
  /** Self-service only: own profile, attendance, leave, performance and payslips. */
  employee: SELF_SERVICE,
  /** Recruitment (read/write) and positions (read). */
  recruiter: [...SELF_SERVICE, 'hr.dashboard.view', 'recruitment.jobs.view', 'recruitment.jobs.manage', 'organization.departments.view'],
  /** Payroll processing (read/write, not approval) and employees (read). */
  'payroll-officer': [...SELF_SERVICE, 'hr.dashboard.view', 'hr.payroll.view', 'hr.payroll.manage', 'organization.employees.view'],
};

/*
 * Permissions the backend does not issue yet, granted from their nearest existing permission (agreed interim mapping).
 * Remove an entry once the backend puts the `hr.*` id in its tokens.
 */
export const INTERIM_FALLBACKS: Partial<Record<Permission, readonly string[] | 'everyone'>> = {
  'hr.profile.view': 'everyone',
  'hr.employees.view.team': ['hr.attendance.view.team'],
  'hr.employees.view.personal': ['organization.employees.manage'],
  'hr.recruitment.view.team': ['recruitment.applications.view'],
  'hr.reports.view': ['hr.dashboard.view'],
  'hr.reports.view.team': ['hr.attendance.view.team'],
  'hr.settings.manage': ['hr.policies.manage'],
};

/** A token's permission claims → the portal permissions they grant (unknown ids dropped, interim fallbacks added). */
export function permissionsFromToken(claims: readonly string[]): Permission[] {
  return PERMISSIONS.filter((p) => {
    if (claims.includes(p)) return true;
    const fallback = INTERIM_FALLBACKS[p];
    return fallback === 'everyone' || (fallback?.some((c) => claims.includes(c)) ?? false);
  });
}

/* The signed-in user ------------------------------------------------------------------------------------------------ */

let signedIn: { role: Role; permissions: readonly Permission[] } | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** The signed-in user's role and token permissions (`null` on sign-out). Called by the AuthProvider only. */
export function setSignedInPermissions(role: Role | null, permissions: readonly Permission[] = []): void {
  signedIn = role ? { role, permissions } : null;
  version++;
  for (const listener of listeners) listener();
}

/** The permissions of a role: the signed-in user's token for their role, otherwise the reference definition. */
export function rolePermissions(role: Role): readonly Permission[] {
  return signedIn?.role === role ? signedIn.permissions : ROLE_PERMISSIONS[role];
}

export function subscribePermissions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const permissionsVersion = () => version;

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions(role).includes(permission);
}

/** True when the role has at least one of the permissions (e.g. org-wide OR team-scoped read). */
export function hasAnyPermission(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
