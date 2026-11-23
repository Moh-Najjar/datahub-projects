import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission, ROLE_PERMISSIONS, ROLES, type Role } from '@/core/config/permissions';
import { DIRECTORY_SEED } from '@/modules/users/mock/seed';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import { auditLog } from '@/modules/settings/mock/settingsMock';
import type { AccountStatus, PermissionMatrix, RoleSummary, UserDetails, UserFilters, UserInput, UsersCaller, UserSummary, UserUpdate } from '@/modules/users/types/users';
import { PERMISSION_INFO } from '@/modules/users/utils/permissionRules';

/*
 * SIMULATED account directory (in memory, reset on reload), seeded with fictional accounts (`seed.ts`). The account ↔
 * employee LINK lives in the employees mock (every module scopes with it). Roles and their permissions are the backend's:
 * shown here read-only (reference definitions). Every change is written to the central audit log (settings mock).
 * Nobody signs in with these accounts — sign-in is the DataHub Workspace's (backend access token).
 */

interface AccountRow {
  id: string;
  email: string;
  name: Localized<string>;
  role: Role;
  status: AccountStatus;
  department: Localized<string> | undefined;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  origin: 'demo' | 'portal';
}

const SEEDED = '2026-01-05T09:00:00.000Z';
const seedAccounts = (): AccountRow[] => DIRECTORY_SEED.map((a) => ({ id: a.id, email: a.email, name: { ...a.name }, role: a.role, status: 'active', department: a.department ? { ...a.department } : undefined, lastLoginAt: null, createdAt: SEEDED, updatedAt: SEEDED, origin: 'demo' }));
let accounts: AccountRow[] = seedAccounts();
let next = DIRECTORY_SEED.length + 1;

export function resetUsersMock() {
  accounts = seedAccounts();
  next = DIRECTORY_SEED.length + 1;
}

/* Helpers ------------------------------------------------------------------------------------------------------------- */

const forbidden = (message = 'Not allowed'): never => {
  throw new ApiError('FORBIDDEN', message);
};
const invalid = (fieldErrors: Record<string, string[]>): never => {
  throw new ApiError('VALIDATION', 'Invalid input', fieldErrors);
};
const requireManage = (caller: UsersCaller) => {
  if (!hasPermission(caller.role, 'identity.users.manage')) forbidden();
};
const find = (id: string) => accounts.find((a) => a.id === id) ?? (() => {
  throw new ApiError('NOT_FOUND', 'User not found');
})();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ARABIC = /[؀-ۿ]/;
const reasonOf = (reason: string) => (reason ?? '').trim().slice(0, 300);
const roleLabel = (role: Role) => role;

/** An account that can sign in and manage the portal: active System Administrator. */
const usableAdmins = () => accounts.filter((a) => a.role === 'system-admin' && a.status === 'active');

function employeeOf(userId: string) {
  const employeeId = employeeRecords.employeeIdOf(userId);
  const e = employeeId ? employeeRecords.get(employeeId) : undefined;
  if (!e) return null;
  const dep = orgTables.departments().find((d) => d.id === e.departmentId);
  return { id: e.id, employeeNumber: e.employeeNumber, name: { en: `${e.name.first.en} ${e.name.last.en}`, ar: `${e.name.first.ar} ${e.name.last.ar}` }, department: { id: e.departmentId, name: dep ? { ...dep.name } : { en: e.departmentId, ar: e.departmentId } } };
}

function toSummary(a: AccountRow): UserSummary {
  return { id: a.id, email: a.email, name: { ...a.name }, role: a.role, status: a.status, employee: employeeOf(a.id), lastLoginAt: a.lastLoginAt, createdAt: a.createdAt, origin: a.origin };
}

/** Why the caller may not change this account's role or status (self-protection, last usable administrator). */
function protection(a: AccountRow, caller: UsersCaller): 'self' | 'last-admin' | null {
  if (a.id === caller.userId) return 'self';
  if (a.role === 'system-admin' && a.status === 'active' && usableAdmins().length <= 1) return 'last-admin';
  return null;
}

function toDetails(a: AccountRow, caller: UsersCaller): UserDetails {
  const reason = protection(a, caller);
  return { ...toSummary(a), updatedAt: a.updatedAt, permissions: [...ROLE_PERMISSIONS[a.role]], can: { edit: true, changeRole: reason === null, changeStatus: reason === null, link: true, reason } };
}

function audit(target: AccountRow | Role, action: Parameters<typeof auditLog.append>[0]['action'], previous: string | null, nextValue: string | null, reason: string, caller: UsersCaller) {
  const isRole = typeof target === 'string';
  auditLog.append(
    {
      module: isRole ? 'roles' : 'users',
      target: isRole ? `role:${target}` : `user:${target.id}`,
      targetLabel: isRole ? { en: target, ar: target } : { en: `${target.name.en} (${target.email})`, ar: `${target.name.ar} (${target.email})` },
      action,
      previous,
      next: nextValue,
      reason: reasonOf(reason),
    },
    caller,
  );
}

/* Directory ----------------------------------------------------------------------------------------------------------- */

export function listUsers(params: ListParams<UserFilters>, caller: UsersCaller): Paginated<UserSummary> {
  requireManage(caller);
  const f = params.filters ?? {};
  const q = params.search?.trim().toLowerCase();
  const rows = accounts
    .map(toSummary)
    .filter((u) => (!f.role || u.role === f.role) && (!f.status || u.status === f.status) && (!f.departmentId || u.employee?.department.id === f.departmentId || (u.employee && orgTables.descendants(f.departmentId).has(u.employee.department.id))))
    .filter((u) => !q || [u.name.en, u.name.ar, u.email, u.employee?.employeeNumber ?? '', u.employee?.name.en ?? '', u.employee?.name.ar ?? ''].join(' ').toLowerCase().includes(q));
  const sortKey = params.sortBy ?? 'name.en';
  const keyed = rows.map((u) => ({ u, k: sortKey === 'name.en' ? u.name.en : sortKey === 'name.ar' ? u.name.ar : (u as unknown as Record<string, unknown>)[sortKey] }));
  const page = queryCollection(keyed, { ...params, search: '', filters: {}, sortBy: 'k' });
  return { ...page, items: page.items.map((x) => x.u) };
}

export function getUser(id: string, caller: UsersCaller): UserDetails {
  requireManage(caller);
  return toDetails(find(id), caller);
}

function checkIdentity(input: UserUpdate, exceptId: string | null) {
  const errors: Record<string, string[]> = {};
  const en = input.name?.en?.trim() ?? '';
  const ar = input.name?.ar?.trim() ?? '';
  if (!en) errors['name.en'] = ['required'];
  else if (en.length > 80) errors['name.en'] = ['tooLong'];
  if (!ar) errors['name.ar'] = ['required'];
  else if (!ARABIC.test(ar)) errors['name.ar'] = ['arabicRequired'];
  else if (ar.length > 80) errors['name.ar'] = ['tooLong'];
  const email = input.email?.trim().toLowerCase() ?? '';
  if (!EMAIL.test(email) || email.length > 160) errors.email = ['invalidEmail'];
  else if (accounts.some((a) => a.id !== exceptId && a.email.toLowerCase() === email)) errors.email = ['duplicateEmail'];
  if (Object.keys(errors).length) invalid(errors);
  return { name: { en, ar }, email };
}

function checkEmployee(employeeId: string | null, userId: string | null): string | null {
  if (employeeId === null) return null;
  const e = employeeRecords.get(employeeId);
  if (!e) invalid({ employeeId: ['notFound'] });
  if (e!.status !== 'active') invalid({ employeeId: ['employeeInactive'] });
  const owner = employeeRecords.accountOf(employeeId);
  if (owner && owner !== userId) invalid({ employeeId: ['employeeLinked'] });
  return employeeId;
}

export function createUser(input: UserInput, reason: string, caller: UsersCaller): UserDetails {
  requireManage(caller);
  const identity = checkIdentity(input, null);
  if (!(ROLES as readonly string[]).includes(input.role)) invalid({ role: ['invalid'] });
  const employeeId = checkEmployee(input.employeeId ?? null, null);
  const now = new Date().toISOString();
  const row: AccountRow = { id: `usr-${String(next++).padStart(4, '0')}`, ...identity, role: input.role, status: 'active', department: undefined, lastLoginAt: null, createdAt: now, updatedAt: now, origin: 'portal' };
  accounts.push(row);
  if (employeeId) employeeRecords.linkAccount(row.id, employeeId);
  audit(row, 'created', null, `${row.email} · ${roleLabel(row.role)}`, reason, caller);
  return toDetails(row, caller);
}

export function updateUser(id: string, input: UserUpdate, reason: string, caller: UsersCaller): UserDetails {
  requireManage(caller);
  const row = find(id);
  const identity = checkIdentity(input, id);
  const before = `${row.name.en} / ${row.name.ar} · ${row.email}`;
  const changed = identity.email !== row.email || identity.name.en !== row.name.en || identity.name.ar !== row.name.ar;
  if (changed) {
    Object.assign(row, identity, { updatedAt: new Date().toISOString() });
    audit(row, 'updated', before, `${row.name.en} / ${row.name.ar} · ${row.email}`, reason, caller);
  }
  return toDetails(row, caller);
}

export function updateUserRole(id: string, role: Role, reason: string, caller: UsersCaller): UserDetails {
  requireManage(caller);
  const row = find(id);
  if (!(ROLES as readonly string[]).includes(role)) invalid({ role: ['invalid'] });
  if (row.role === role) return toDetails(row, caller);
  const guard = protection(row, caller);
  if (guard) invalid({ role: [guard] });
  if (!reasonOf(reason)) invalid({ reason: ['reasonRequired'] });
  const previous = row.role;
  Object.assign(row, { role, updatedAt: new Date().toISOString() });
  audit(row, 'role', previous, role, reason, caller);
  return toDetails(row, caller);
}

export function updateUserStatus(id: string, status: AccountStatus, reason: string, caller: UsersCaller): UserDetails {
  requireManage(caller);
  const row = find(id);
  if (row.status === status) throw new ApiError('CONFLICT', `Account already ${status}`);
  const guard = protection(row, caller);
  if (guard && status !== 'active') invalid({ status: [guard] });
  if (status !== 'active' && !reasonOf(reason)) invalid({ reason: ['reasonRequired'] });
  const previous = row.status;
  Object.assign(row, { status, updatedAt: new Date().toISOString() });
  audit(row, status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : 'status', previous, status, reason, caller);
  return toDetails(row, caller);
}

export function linkEmployee(id: string, employeeId: string | null, reason: string, caller: UsersCaller): UserDetails {
  requireManage(caller);
  const row = find(id);
  const current = employeeRecords.employeeIdOf(id) ?? null;
  if (current === employeeId) return toDetails(row, caller);
  checkEmployee(employeeId, id);
  const before = employeeOf(id);
  employeeRecords.linkAccount(id, employeeId);
  row.updatedAt = new Date().toISOString();
  const after = employeeOf(id);
  audit(row, employeeId ? 'linked' : 'unlinked', before ? `${before.employeeNumber} ${before.name.en}` : null, after ? `${after.employeeNumber} ${after.name.en}` : null, reason, caller);
  return toDetails(row, caller);
}

/* Roles & permissions --------------------------------------------------------------------------------------------------- */

export function listRoles(caller: UsersCaller): RoleSummary[] {
  requireManage(caller);
  return ROLES.map((role) => ({
    role,
    users: accounts.filter((a) => a.role === role).length,
    activeUsers: accounts.filter((a) => a.role === role && a.status === 'active').length,
    permissions: ROLE_PERMISSIONS[role].length,
    system: true,
    locked: role === 'system-admin',
  }));
}

export function permissionMatrix(caller: UsersCaller): PermissionMatrix {
  requireManage(caller);
  return {
    permissions: PERMISSION_INFO.map((p) => ({ ...p, requiresAnyOf: [...p.requiresAnyOf] })),
    roles: ROLES.map((role) => ({ role, permissions: [...ROLE_PERMISSIONS[role]], locked: role === 'system-admin' })),
  };
}
