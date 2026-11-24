import { createdId, http } from '@/core/api/http';
import { asRaw, listOf, num, str, token, type Raw } from '@/core/api/read';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { ROLES, type Role } from '@/core/domain/training';
import type { CreateUserInput, UpdateUserInput, UserDto, UserFilters } from '../types/user';

/*
 * Users on the real backend: the identity API (`/api/v1/users`, paged and searched on the server).
 * - The list item has no Academy role or department (2026-11-24): the role is read from the item's roles when present,
 *   otherwise from `GET /api/v1/users/{id}/roles`; the department only when the item carries it. The role filter and the
 *   department filter are applied to the current page only.
 * - Roles are backend roles: the app's role (SuperAdmin, DepartmentAdmin, Trainee, Employee, Intern) is matched to a
 *   backend role by its key / name (`/api/v1/roles`); without a match the user gets no role from here.
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

function toDto(o: Raw, role: Role): UserDto {
  const status = token(str(o, 'status'));
  return {
    id: str(o, 'id', 'userId') ?? '',
    fullName: str(o, 'displayName', 'fullName', 'fullNameEn') ?? str(o, 'email') ?? '',
    email: str(o, 'email') ?? '',
    role,
    isActive: status ? status === 'active' : true,
    departmentId: str(o, 'departmentId'),
    departmentName: str(o, 'departmentName', 'department'),
    createdAt: str(o, 'createdAtUtc', 'createdAt') ?? new Date(0).toISOString(),
  };
}

async function roleOf(o: Raw): Promise<Role> {
  const inline = Array.isArray(o.roles) ? (o.roles as unknown[]).map((r) => (typeof r === 'string' ? r : (str(asRaw(r), 'roleKey', 'key', 'name') ?? ''))) : null;
  if (inline) return roleOfBackendRoles(inline);
  try {
    return roleOfBackendRoles(roleKeys(listOf(await http.get(`${BASE}/${str(o, 'id')}/roles`))));
  } catch {
    return 'Employee';
  }
}

async function page(pageNumber: number, pageSize: number, search?: string, status?: string, signal?: AbortSignal) {
  const data = asRaw(await http.get(BASE, { query: { pageNumber, pageSize, searchTerm: search, status }, signal }));
  const items = await Promise.all(listOf(data).map(async (o) => toDto(o, await roleOf(o))));
  return { items, total: num(data, 'totalCount') ?? items.length, totalPages: num(data, 'totalPages') ?? 1 };
}

/** The backend role id for an app role (matched by key or name), or `null`. */
async function backendRoleId(role: Role): Promise<string | null> {
  const roles = listOf(await http.get('/api/v1/roles'));
  const match = roles.find((r) => roleKeys([r]).some((k) => token(k) === token(role)));
  return match ? str(match, 'id') : null;
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
    const items = result.items.filter((u) => (!f.role || u.role === f.role) && (!f.departmentId || u.departmentId === f.departmentId));
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
    const roleId = await backendRoleId(input.role);
    const id = createdId(await http.post(BASE, { email: input.email.trim(), displayName: input.fullName.trim(), roleIds: roleId ? [roleId] : [] }));
    if (input.departmentId) await http.put(`${BASE}/${id}`, { displayName: input.fullName.trim(), departmentId: input.departmentId });
    return find(id);
  },
  async update(id: string, input: UpdateUserInput): Promise<UserDto> {
    const before = await find(id);
    await http.put(`${BASE}/${id}`, { displayName: input.fullName.trim(), departmentId: input.departmentId });
    if (before.isActive !== input.isActive) await http.put(`${BASE}/${id}/status`, { isActive: input.isActive });
    if (before.role !== input.role) {
      const [oldId, newId] = await Promise.all([backendRoleId(before.role), backendRoleId(input.role)]);
      if (newId) await http.post(`${BASE}/${id}/roles/${newId}`);
      if (oldId && oldId !== newId) await http.delete(`${BASE}/${id}/roles/${oldId}`);
    }
    return find(id);
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};

