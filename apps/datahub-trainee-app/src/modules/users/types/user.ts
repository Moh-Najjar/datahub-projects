import type { Role } from '@/core/domain/training';

export type { Role };

export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** The user's role as a role-option value (see `RoleOption`): the app role (simulated backend) or a backend role id. */
  roleId: string;
  /** The backend role's display name (real API); null with the simulated backend (the UI translates `role`). */
  roleName: string | null;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

/**
 * One choice of the user form's Role field. Real API: a backend role (`GET /api/v1/roles`, value = its id, label = its
 * name). Simulated backend: one of the app roles (value = the role, label null → translated by the UI).
 */
export interface RoleOption {
  value: string;
  label: string | null;
}

export interface UserFilters {
  /** A `RoleOption` value. */
  role: string;
  departmentId: string;
  /** 'true' = active, 'false' = inactive. */
  isActive: 'true' | 'false';
}

/**
 * Training-directory records only: no password (sign-in is the DataHub Workspace) and no link to a Workspace account.
 * Managing a user here never changes anyone's Workspace identity or permissions.
 */
export interface CreateUserInput {
  fullName: string;
  email: string;
  /** A `RoleOption` value. */
  role: string;
  departmentId: string | null;
}

export interface UpdateUserInput extends CreateUserInput {
  isActive: boolean;
}
