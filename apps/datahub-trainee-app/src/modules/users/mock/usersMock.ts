import { canSeeUser, conflict, forbidden, invalid, notFound, requirePermission } from '@/core/api/mock/access';
import { ROLES, type DbUser, type Role } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import { queryCollection } from '@/core/api/mock/mockUtils';
import type { ListParams, Paginated } from '@/core/api/types';
import { requireActor } from '@/core/auth/actor';
import { DEPARTMENT_ASSIGNABLE_ROLES, isDepartmentScoped, type TrainingActor } from '@/core/auth/trainingPolicy';
import type { CreateUserInput, UpdateUserInput, UserDto, UserFilters } from '../types/user';

/*
 * Simulated Users backend — the rules of the original Training Portal's UserService:
 *  - SuperAdmin manages everyone; a DepartmentAdmin manages only users of their own department, may assign only the
 *    Intern / Trainee / Employee roles and always keeps users in their own department;
 *  - the e-mail is normalised (trimmed, spaces removed) and must be unique (Conflict);
 *  - deleting a user removes their enrollments, evaluations and submissions.
 * Added: nobody can delete or deactivate themself (it would lock them out of their own session).
 * These are training-directory records: no passwords, and no effect on Workspace accounts.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string): string => email.trim().replace(/\s+/g, '');

function toDto(user: DbUser): UserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    departmentId: user.departmentId,
    departmentName: db().departments.find((d) => d.id === user.departmentId)?.name ?? null,
    createdAt: user.createdAt,
  };
}

function manager(): TrainingActor {
  const actor = requireActor();
  requirePermission(actor, 'users.manage');
  return actor;
}

/** A DepartmentAdmin needs a department of their own to manage anyone. */
function managedDepartment(actor: TrainingActor): string {
  return actor.departmentId ?? forbidden('user.noDepartment');
}

function assertRole(actor: TrainingActor, role: Role): void {
  if (!ROLES.includes(role)) invalid('role', 'user.roleInvalid');
  if (isDepartmentScoped(actor) && !DEPARTMENT_ASSIGNABLE_ROLES.includes(role)) forbidden('user.roleNotAllowed');
}

/** The department a saved user ends up in: forced to the DepartmentAdmin's own, otherwise as requested (must exist). */
function resolveDepartment(actor: TrainingActor, requested: string | null): string | null {
  if (isDepartmentScoped(actor)) {
    const own = managedDepartment(actor);
    if (requested && requested !== own) forbidden('user.departmentNotAllowed');
    return own;
  }
  if (requested && !db().departments.some((d) => d.id === requested)) notFound('department.notFound');
  return requested || null;
}

function cleanInput(input: CreateUserInput): { fullName: string; email: string } {
  const fullName = input.fullName.trim();
  if (!fullName) invalid('fullName', 'field.required');
  if (fullName.length > 200) invalid('fullName', 'field.tooLong');
  const email = normalizeEmail(input.email);
  if (!email) invalid('email', 'field.required');
  if (!EMAIL.test(email)) invalid('email', 'field.email');
  return { fullName, email };
}

function assertUniqueEmail(email: string, exceptId?: string): void {
  if (db().users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email.toLowerCase())) conflict('user.emailDuplicate');
}

/** Users the caller manages: SuperAdmin everyone; DepartmentAdmin their own department. */
function scoped(actor: TrainingActor): DbUser[] {
  const users = db().users;
  return isDepartmentScoped(actor) ? users.filter((u) => u.departmentId === managedDepartment(actor)) : users;
}

export const usersMock = {
  list(params: ListParams<UserFilters>): Paginated<UserDto> {
    const actor = manager();
    const rows = scoped(actor).map(toDto);
    return queryCollection(rows, params, {
      searchFields: (u) => [u.fullName, u.email, u.departmentName],
      matches: (u, f) => (!f.role || u.role === f.role) && (!f.departmentId || u.departmentId === f.departmentId) && (!f.isActive || u.isActive === (f.isActive === 'true')),
      sorters: {
        name: (a, b) => a.fullName.localeCompare(b.fullName),
        email: (a, b) => a.email.localeCompare(b.email),
        role: (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role),
        department: (a, b) => (a.departmentName ?? '').localeCompare(b.departmentName ?? ''),
        status: (a, b) => Number(b.isActive) - Number(a.isActive),
      },
      defaultSort: (a, b) => a.fullName.localeCompare(b.fullName),
    });
  },

  /** Active Intern / Trainee / Employee users — who a training can be assigned to (original: any department). */
  assignable(): UserDto[] {
    manager();
    return db()
      .users.filter((u) => u.isActive && DEPARTMENT_ASSIGNABLE_ROLES.includes(u.role))
      .map(toDto)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  get(id: string): UserDto {
    const actor = manager();
    const user = db().users.find((u) => u.id === id) ?? notFound('user.notFound');
    if (!canSeeUser(actor, user)) forbidden('user.outsideDepartment');
    return toDto(user);
  },

  create(input: CreateUserInput): UserDto {
    const actor = manager();
    const { fullName, email } = cleanInput(input);
    const departmentId = resolveDepartment(actor, input.departmentId);
    assertUniqueEmail(email);
    assertRole(actor, input.role);
    const user: DbUser = { id: newId('usr'), fullName, email, role: input.role, isActive: true, departmentId, createdAt: new Date().toISOString() };
    db().users.push(user);
    commit();
    return toDto(user);
  },

  update(id: string, input: UpdateUserInput): UserDto {
    const actor = manager();
    const user = db().users.find((u) => u.id === id) ?? notFound('user.notFound');
    if (isDepartmentScoped(actor) && user.departmentId !== managedDepartment(actor)) forbidden('user.outsideDepartment');
    const { fullName, email } = cleanInput(input);
    assertRole(actor, input.role);
    assertUniqueEmail(email, id);
    if (id === actor.userId && !input.isActive) forbidden('user.self');
    user.fullName = fullName;
    user.email = email;
    user.role = input.role;
    user.isActive = input.isActive;
    user.departmentId = resolveDepartment(actor, input.departmentId);
    commit();
    return toDto(user);
  },

  remove(id: string): void {
    const actor = manager();
    const database = db();
    const user = database.users.find((u) => u.id === id) ?? notFound('user.notFound');
    if (isDepartmentScoped(actor) && user.departmentId !== managedDepartment(actor)) forbidden('user.outsideDepartment');
    if (id === actor.userId) forbidden('user.self');
    const enrollmentIds = new Set(database.enrollments.filter((e) => e.userId === id).map((e) => e.id));
    database.enrollments = database.enrollments.filter((e) => e.userId !== id);
    database.evaluations = database.evaluations.filter((e) => e.userId !== id && !(e.enrollmentId && enrollmentIds.has(e.enrollmentId)));
    database.submissions = database.submissions.filter((s) => s.userId !== id);
    database.trainings.forEach((t) => {
      if (t.trainerId === id) t.trainerId = null;
    });
    database.users = database.users.filter((u) => u.id !== id);
    commit();
  },
};
