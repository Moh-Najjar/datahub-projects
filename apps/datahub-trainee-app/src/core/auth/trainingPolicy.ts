import type { Role } from '@/core/domain/training';

/*
 * TRAINING business authorization — the permission model of the original Training Portal, as one pure table.
 * It decides what a user can DO inside the app, and nothing else: Workspace access (may the user open the app at
 * all) is `workspaceAccess.ts`, and a business role never grants any Workspace permission.
 *
 * UI guards, hidden navigation and these checks are conveniences; the (mock, later real) backend enforces the same
 * rules on every request — the mock handlers call these same helpers.
 *
 * The original has NO difference between Trainee, Intern and Employee: they are three roles with identical rights.
 */

export type TrainingPermission =
  | 'dashboard.view'
  | 'departments.manage'
  | 'users.manage'
  | 'trainings.manage'
  | 'enrollments.manage'
  | 'evaluations.manage'
  | 'rankings.view'
  | 'trainings.learn'
  | 'assignments.submit'
  | 'certificates.view';

const MANAGER_PERMISSIONS: readonly TrainingPermission[] = ['dashboard.view', 'users.manage', 'trainings.manage', 'enrollments.manage', 'evaluations.manage', 'rankings.view', 'certificates.view'];
const LEARNER_PERMISSIONS: readonly TrainingPermission[] = ['dashboard.view', 'trainings.learn', 'assignments.submit', 'certificates.view'];

/** Reference definition of every role's rights (also shown by tests; the UI reads it through `can`). */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly TrainingPermission[]>> = {
  SuperAdmin: [...MANAGER_PERMISSIONS, 'departments.manage'],
  DepartmentAdmin: MANAGER_PERMISSIONS,
  Trainee: LEARNER_PERMISSIONS,
  Intern: LEARNER_PERMISSIONS,
  Employee: LEARNER_PERMISSIONS,
};

/** Roles that learn (view enrolled trainings, submit assignments, can be enrolled and evaluated). */
export const LEARNER_ROLES: readonly Role[] = ['Trainee', 'Employee', 'Intern'];
/** Roles a DepartmentAdmin may assign to users and enroll — everything below DepartmentAdmin. */
export const DEPARTMENT_ASSIGNABLE_ROLES: readonly Role[] = ['Intern', 'Trainee', 'Employee'];
export const EVALUABLE_ROLES: readonly Role[] = LEARNER_ROLES;

/** The signed-in person as the training backend sees them (a record of the training user directory). */
export interface TrainingActor {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  /** The home department; a DepartmentAdmin manages exactly this one. */
  departmentId: string | null;
}

export const isManagerRole = (role: Role): boolean => role === 'SuperAdmin' || role === 'DepartmentAdmin';
export const isLearnerRole = (role: Role): boolean => LEARNER_ROLES.includes(role);

export function roleCan(role: Role, permission: TrainingPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function actorCan(actor: TrainingActor | null, permission: TrainingPermission): boolean {
  return !!actor && roleCan(actor.role, permission);
}

/** A DepartmentAdmin works inside one (known) department; SuperAdmin is global. With the real backend the department may
 * be unknown — the UI is then not scoped and the backend enforces the scope. */
export const isDepartmentScoped = (actor: TrainingActor): boolean => actor.role === 'DepartmentAdmin' && !!actor.departmentId;

/** May the actor manage things (trainings, enrollments, evaluations…) that belong to this department? */
export function canManageDepartment(actor: TrainingActor, departmentId: string | null): boolean {
  if (actor.role === 'SuperAdmin') return true;
  return actor.role === 'DepartmentAdmin' && !!actor.departmentId && actor.departmentId === departmentId;
}
