import { createdId, http } from '@/core/api/http';
import { arr, asRaw, listOf, num, str, token, type Raw } from '@/core/api/read';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { ROLES, type Role } from '@/core/domain/training';
import type { CreateUserInput, RoleOption, UpdateUserInput, UserDto, UserFilters } from '../types/user';

/*
 * Users on the real backend: the identity API (`/api/v1/users`, paged and searched on the server).
 * - The list item has no Academy role or department (2026-11-24): the role is read from the item's roles when present,
 *   otherwise from `GET /api/v1/users/{id}/roles`; the department only when the item carries it. The role filter and the
 *   department filter are applied to the current page only.
 * - Roles are backend roles: the form's Role field lists `GET /api/v1/roles` and sends the chosen role's id. The app's
 *   own business role (permissions, chips) is still derived from the backend role keys (`roleOfBackendRoles`).
 * - There is no `GET /users/{id}`: a single user is found through the list.
 */

const BASE = '/api/v1/users';

/** The app role of a set of backend role keys / names. */
export function roleOfBackendRoles(keys: readonly string[]): Role {
  const tokens = keys.map(token);
  if (tokens.some((k) => k.includes('systemadmin') || k === 'superadmin')) return 'SuperAdmin';
  for (const role of ROLES) if (tokens.includes(token(role))) return role;
  if (tokens.some((k) => k.includes('departmentadmin'))) return 'DepartmentAdmin';
  return 'Employee';
}

const roleKeys = (items: Raw[]): string[] => items.map((r) => str(r, 'roleKey', 'key', 'name', 'nameEn') ?? '').filter(Boolean);

interface UserRoles {
  role: Role;
  /** The first backend role id ('' when unknown). */
  roleId: string;
  roleName: string | null;
}

/**
 * The user's department: `departmentId`, else the first of `departmentIds` / `departments[]` (the backend accepts both
 * on create/update since 2026-11-25). The name comes from the item, else from the organization departments list.
 */
function departmentOf(o: Raw, names: ReadonlyMap<string, string>): { departmentId: string | null; departmentName: string | null } {
  const first = arr(o, 'departments')[0];
  const ids = Array.isArray(o.departmentIds) ? (o.departmentIds as unknown[]).filter((v): v is string => typeof v === 'string') : [];
  const departmentId = str(o, 'departmentId') ?? ids[0] ?? (first ? str(first, 'id', 'departmentId') : null);
  const own = str(o, 'departmentName') ?? (typeof o.department === 'string' ? o.department : null) ?? (first ? str(first, 'name', 'nameEn', 'departmentName') : null);
  return { departmentId, departmentName: own ?? (departmentId ? (names.get(departmentId) ?? null) : null) };
}

/** Department id → name (`GET /api/v1/organization/departments`); empty when it cannot be read. */
async function departmentNames(signal?: AbortSignal): Promise<Map<string, string>> {
  try {
    const rows = listOf(await http.get('/api/v1/organization/departments', { query: { includeInactive: true }, signal }));
    return new Map(rows.flatMap((d) => { const id = str(d, 'id'); const name = str(d, 'name', 'nameEn'); return id && name ? [[id, name] as const] : []; }));
  } catch {
    return new Map();
  }
}

function toDto(o: Raw, { role, roleId, roleName }: UserRoles, names: ReadonlyMap<string, string>): UserDto {
  const status = token(str(o, 'status'));
  return {
    id: str(o, 'id', 'userId') ?? '',
    fullName: str(o, 'displayName', 'fullName', 'fullNameEn') ?? str(o, 'email') ?? '',
    email: str(o, 'email') ?? '',
    role,
    roleId,
    roleName,
    isActive: status ? status === 'active' : true,
    ...departmentOf(o, names),
    createdAt: str(o, 'createdAtUtc', 'createdAt') ?? new Date(0).toISOString(),
  };
}

const rolesOf = (items: Raw[]): UserRoles => ({
  role: roleOfBackendRoles(roleKeys(items)),
  roleId: str(items[0] ?? {}, 'roleId', 'id') ?? '',
  roleName: str(items[0] ?? {}, 'name', 'roleName', 'displayName', 'nameEn', 'roleKey', 'key'),
});

async function roleOf(o: Raw): Promise<UserRoles> {
  // Inline roles as objects carry ids; as plain keys they don't — then ask `/users/{id}/roles`.
  if (Array.isArray(o.roles) && o.roles.every((r) => r && typeof r === 'object')) return rolesOf((o.roles as unknown[]).map(asRaw));
  try {
    return rolesOf(listOf(await http.get(`${BASE}/${str(o, 'id')}/roles`)));
  } catch {
    return { role: 'Employee', roleId: '', roleName: null };
  }
}

/** Create/update body fields for one department (or none). */
const departmentFields = (departmentId: string | null) => ({ departmentId, departmentIds: departmentId ? [departmentId] : [] });

async function page(pageNumber: number, pageSize: number, search?: string, status?: string, signal?: AbortSignal) {
  const [data, names] = await Promise.all([http.get(BASE, { query: { pageNumber, pageSize, searchTerm: search, status }, signal }).then(asRaw), departmentNames(signal)]);
  const items = await Promise.all(listOf(data).map(async (o) => toDto(o, await roleOf(o), names)));
  return { items, total: num(data, 'totalCount') ?? items.length, totalPages: num(data, 'totalPages') ?? 1 };
}


async function find(id: string, signal?: AbortSignal): Promise<UserDto> {
  for (let n = 1; ; n++) {
    const current = await page(n, 100, undefined, undefined, signal);
    const user = current.items.find((u) => u.id === id);
    if (user) return user;
    if (n >= current.totalPages) throw new ApiError('NOT_FOUND', 'user.notFound');
  }
}

export const usersHttpApi = {
  async list(params: ListParams<UserFilters>, signal?: AbortSignal): Promise<Paginated<UserDto>> {
    const f = params.filters ?? {};
    const status = f.isActive === 'true' ? 'Active' : f.isActive === 'false' ? 'Inactive' : undefined;
    const result = await page(params.page, params.pageSize, params.search, status, signal);
    const items = result.items.filter((u) => (!f.role || u.roleId === f.role) && (!f.departmentId || u.departmentId === f.departmentId));
    return { items, page: params.page, pageSize: params.pageSize, total: result.total, totalPages: result.totalPages };
  },
  /** Active users who can be enrolled (first 500). */
  async assignable(signal?: AbortSignal): Promise<UserDto[]> {
    const users: UserDto[] = [];
    for (let n = 1; n <= 5; n++) {
      const current = await page(n, 100, undefined, 'Active', signal);
      users.push(...current.items);
      if (n >= current.totalPages) break;
    }
    return users.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
  get: find,
  async create(input: CreateUserInput): Promise<UserDto> {
    // The department goes with the create request (one call: it is kept even when the invitation e-mail then fails).
    const id = createdId(
      await http.post(BASE, { email: input.email.trim(), displayName: input.fullName.trim(), roleIds: input.role ? [input.role] : [], ...departmentFields(input.departmentId) }),
    );
    return find(id);
  },
  async update(id: string, input: UpdateUserInput): Promise<UserDto> {
    const before = await find(id);
    await http.put(`${BASE}/${id}`, { displayName: input.fullName.trim(), ...departmentFields(input.departmentId) });
    if (before.isActive !== input.isActive) await http.put(`${BASE}/${id}/status`, { isActive: input.isActive });
    // The form edits one role: add the chosen one, then remove the one it replaced (other backend roles are kept).
    if (input.role && before.roleId !== input.role) {
      await http.post(`${BASE}/${id}/roles/${input.role}`);
      if (before.roleId) await http.delete(`${BASE}/${id}/roles/${before.roleId}`);
    }
    return find(id);
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
  /** The backend roles (`GET /api/v1/roles`): value = id, label = display name (else key). */
  async roleOptions(signal?: AbortSignal): Promise<RoleOption[]> {
    return listOf(await http.get('/api/v1/roles', { signal }))
      .map((r) => ({ value: str(r, 'id', 'roleId') ?? '', label: str(r, 'name', 'displayName', 'nameEn', 'roleKey', 'key') }))
      .filter((r) => r.value)
      .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
  },
};

