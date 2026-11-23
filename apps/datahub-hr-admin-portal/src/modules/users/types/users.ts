import type { Localized } from '@datahub/shared-types';
import type { Permission, Role } from '@/core/config/permissions';

/*
 * Users & Roles contracts — a DRAFT of the future backend's. A user ACCOUNT (who signs in to the portal) is not an
 * employee record: an account may be linked to one employee (the link every module scopes "own" and "team" data with)
 * or to none, and most employees have no account. One role per account (the session carries one role). Roles are the
 * seven system roles; custom roles are not supported (roles are fixed identifiers across the portal and the backend).
 */

export const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface UserSummary {
  id: string;
  email: string;
  name: Localized<string>;
  role: Role;
  status: AccountStatus;
  /** Linked employee (Employee Management), if any. */
  employee: { id: string; employeeNumber: string; name: Localized<string>; department: { id: string; name: Localized<string> } } | null;
  /** Recorded when the account signs in through the Workspace; `null` = no sign-in recorded (never invented). */
  lastLoginAt: string | null;
  createdAt: string;
  /** Demo accounts also exist in DataHub Portals (they can sign in); accounts created here need a Portals account too. */
  origin: 'demo' | 'portal';
}

export interface UserDetails extends UserSummary {
  updatedAt: string;
  /** The role's permissions in force (what this account may do). */
  permissions: Permission[];
  /** What the caller may do with this account now (computed by the backend). */
  can: { edit: boolean; changeRole: boolean; changeStatus: boolean; link: boolean; reason: 'self' | 'last-admin' | null };
}

export interface UserFilters {
  role: Role;
  status: AccountStatus;
  departmentId: string;
}
export type UserSortField = 'name.en' | 'name.ar' | 'email' | 'role' | 'status' | 'lastLoginAt' | 'createdAt';

export interface UserInput {
  name: Localized<string>;
  email: string;
  role: Role;
  employeeId: string | null;
}

export interface UserUpdate {
  name: Localized<string>;
  email: string;
}

/* Roles & permissions ------------------------------------------------------------------------------------------------- */

export interface RoleSummary {
  role: Role;
  users: number;
  activeUsers: number;
  permissions: number;
  /** All roles are system roles (fixed identifiers); custom roles are not supported. */
  system: true;
  /** The System Administrator role always holds every permission. */
  locked: boolean;
}

export const PERMISSION_GROUPS = ['dashboard', 'profile', 'employees', 'organization', 'attendance', 'leave', 'recruitment', 'performance', 'payroll', 'documents', 'reports', 'settings', 'users'] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export interface PermissionInfo {
  permission: Permission;
  group: PermissionGroup;
  /** Scope of the permission: organisation-wide, the user's team, or their own records. */
  scope: 'organization' | 'team' | 'own';
  /** Salary, personal details, account or system administration. */
  sensitive: boolean;
  /** Every role keeps it (self-service) or only the System Administrator may hold it. */
  locked: 'self-service' | 'system-only' | null;
  /** Permissions it needs (a role must hold one of them). */
  requiresAnyOf: Permission[];
}

export interface PermissionMatrix {
  permissions: PermissionInfo[];
  roles: Array<{ role: Role; permissions: Permission[]; locked: boolean }>;
}

/** Who is asking (the mock derives permissions from the role; the backend from the token). */
export interface UsersCaller {
  userId: string;
  role: Role;
  name: Localized<string>;
}
