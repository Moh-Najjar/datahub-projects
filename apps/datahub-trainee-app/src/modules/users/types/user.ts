import type { Role } from '@/core/domain/training';

export type { Role };

export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

export interface UserFilters {
  role: Role;
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
  role: Role;
  departmentId: string | null;
}

export interface UpdateUserInput extends CreateUserInput {
  isActive: boolean;
}
