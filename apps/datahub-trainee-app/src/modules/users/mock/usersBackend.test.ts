import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_DEPARTMENTS as D, SEED_USERS as U } from '@/core/api/mock/seedData';
import { db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { actAs } from '@/test/actors';
import { usersMock } from './usersMock';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const list = (over: Record<string, unknown> = {}) => usersMock.list({ page: 1, pageSize: 100, ...over });
const newUser = (over: Record<string, unknown> = {}) => ({ fullName: 'Reem Saleh', email: 'reem.saleh@example.test', role: 'Trainee' as const, departmentId: D.cloud as string | null, ...over });

describe('SuperAdmin manages everyone', () => {
  beforeEach(() => actAs(U.superAdmin));

  it('creates a user with any of the five roles and an optional department', () => {
    for (const role of ['SuperAdmin', 'DepartmentAdmin', 'Trainee', 'Employee', 'Intern'] as const) {
      const created = usersMock.create(newUser({ role, email: `${role.toLowerCase()}@example.test` }));
      expect(created).toMatchObject({ role, isActive: true, departmentName: 'Cloud' });
    }
    expect(usersMock.create(newUser({ email: 'nodept@example.test', departmentId: null })).departmentId).toBeNull();
  });

  it('keeps no password and no Workspace link on a user record', () => {
    const created = usersMock.create(newUser());
    expect(Object.keys(created).sort()).toEqual(['createdAt', 'departmentId', 'departmentName', 'email', 'fullName', 'id', 'isActive', 'role', 'roleId', 'roleName']);
    expect(JSON.stringify(db().users.find((u) => u.id === created.id))).not.toMatch(/password|token/i);
  });

  it('normalises the e-mail (trim, no spaces) and refuses duplicates (Conflict)', () => {
    expect(usersMock.create(newUser({ email: '  reem . saleh@example.test ' })).email).toBe('reem.saleh@example.test');
    expect(error(() => usersMock.create(newUser({ email: 'REEM.SALEH@example.test' }))).reason).toBe('user.emailDuplicate');
    expect(error(() => usersMock.create(newUser({ email: 'layla.haddad@example.test' }))).code).toBe('CONFLICT');
  });

  it('validates name (≤ 200), e-mail format, role and department', () => {
    expect(error(() => usersMock.create(newUser({ fullName: '' }))).fieldErrors).toEqual({ fullName: ['field.required'] });
    expect(error(() => usersMock.create(newUser({ fullName: 'x'.repeat(201) }))).fieldErrors).toEqual({ fullName: ['field.tooLong'] });
    expect(error(() => usersMock.create(newUser({ email: 'not-an-email' }))).fieldErrors).toEqual({ email: ['field.email'] });
    expect(error(() => usersMock.create(newUser({ role: 'Trainer' as never }))).code).toBe('VALIDATION');
    expect(error(() => usersMock.create(newUser({ departmentId: 'dep-9999' }))).code).toBe('NOT_FOUND');
  });

  it('edits a user and activates / deactivates them', () => {
    const updated = usersMock.update(U.yousef, { fullName: 'Yousef D.', email: 'yousef.darwish@example.test', role: 'Employee', isActive: false, departmentId: D.ai });
    expect(updated).toMatchObject({ fullName: 'Yousef D.', role: 'Employee', isActive: false, departmentName: 'Artificial Intelligence' });
    expect(usersMock.update(U.yousef, { ...updated, isActive: true }).isActive).toBe(true);
  });

  it('refuses an e-mail that belongs to someone else when editing', () => {
    expect(error(() => usersMock.update(U.yousef, { fullName: 'Y', email: 'noor.aldeen@example.test', role: 'Trainee', isActive: true, departmentId: D.dataEngineering })).code).toBe('CONFLICT');
  });

  it('deleting a user removes their enrollments, submissions and evaluations', () => {
    expect(db().enrollments.some((e) => e.userId === U.noor)).toBe(true);
    usersMock.remove(U.noor);
    expect(db().users.some((u) => u.id === U.noor)).toBe(false);
    expect(db().enrollments.some((e) => e.userId === U.noor)).toBe(false);
    expect(db().submissions.some((s) => s.userId === U.noor)).toBe(false);
    expect(db().evaluations.some((e) => e.userId === U.noor)).toBe(false);
  });

  it('keeps trainings when their trainer is deleted (trainer becomes empty)', () => {
    usersMock.remove(U.adminAi);
    expect(db().trainings.find((t) => t.id === 'trn-0004')!.trainerId).toBeNull();
  });

  it('nobody can delete or deactivate their own user', () => {
    expect(error(() => usersMock.remove(U.superAdmin)).reason).toBe('user.self');
    expect(error(() => usersMock.update(U.superAdmin, { fullName: 'Layla Haddad', email: 'layla.haddad@example.test', role: 'SuperAdmin', isActive: false, departmentId: null })).reason).toBe('user.self');
  });

  it('lists with search, role / department / status filters, sorting and pagination', () => {
    expect(list({ search: 'khoury' }).items.map((u) => u.fullName)).toEqual(['Rania Khoury']);
    expect(list({ filters: { role: 'Intern' } }).items.every((u) => u.role === 'Intern')).toBe(true);
    expect(list({ filters: { departmentId: D.software } }).items.every((u) => u.departmentName === 'Software Development')).toBe(true);
    expect(list({ filters: { isActive: 'false' } }).items.map((u) => u.fullName)).toEqual(['Khaled Issa']);
    expect(list({ sortBy: 'role', sortDirection: 'asc' }).items[0]!.role).toBe('SuperAdmin');
    const page2 = usersMock.list({ page: 2, pageSize: 6 });
    expect(page2.total).toBe(16);
    expect(page2.items).toHaveLength(6);
  });

  it('"assignable" users are the ACTIVE Intern / Trainee / Employee people of every department', () => {
    const assignable = usersMock.assignable();
    expect(assignable.every((u) => u.isActive && ['Intern', 'Trainee', 'Employee'].includes(u.role))).toBe(true);
    expect(assignable.map((u) => u.fullName)).not.toContain('Khaled Issa');
    expect(new Set(assignable.map((u) => u.departmentName)).size).toBeGreaterThan(3);
  });
});

describe('DepartmentAdmin works inside one department', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('lists only their department\'s users', () => {
    const users = list().items;
    expect(users.length).toBe(5);
    expect(users.every((u) => u.departmentId === D.dataEngineering)).toBe(true);
  });

  it('creates users in their own department, whatever department is sent, and only with learner roles', () => {
    expect(usersMock.create(newUser({ departmentId: null, email: 'a@example.test' })).departmentId).toBe(D.dataEngineering);
    expect(usersMock.create(newUser({ departmentId: D.dataEngineering, role: 'Intern', email: 'b@example.test' })).role).toBe('Intern');
    expect(error(() => usersMock.create(newUser({ departmentId: D.ai, email: 'c@example.test' }))).reason).toBe('user.departmentNotAllowed');
    expect(error(() => usersMock.create(newUser({ role: 'DepartmentAdmin', departmentId: D.dataEngineering, email: 'd@example.test' }))).reason).toBe('user.roleNotAllowed');
    expect(error(() => usersMock.create(newUser({ role: 'SuperAdmin', departmentId: D.dataEngineering, email: 'e@example.test' }))).reason).toBe('user.roleNotAllowed');
  });

  it('cannot view, edit or delete users of another department', () => {
    expect(error(() => usersMock.update(U.hadi, { fullName: 'H', email: 'hadi.mansour@example.test', role: 'Trainee', isActive: true, departmentId: D.dataEngineering })).code).toBe('FORBIDDEN');
    expect(error(() => usersMock.remove(U.hadi)).code).toBe('FORBIDDEN');
    expect(error(() => usersMock.get(U.sara)).code).toBe('FORBIDDEN');
  });

  it('may view a person from another department who is enrolled in one of their trainings', () => {
    // Tariq (Software) is not enrolled in Data Engineering; Yousef (DE) is enrolled in an AI training — adminAi may see him.
    actAs(U.adminAi);
    expect(usersMock.get(U.yousef).fullName).toBe('Yousef Darwish');
  });

  it('cannot promote someone to an admin role when editing', () => {
    expect(error(() => usersMock.update(U.yousef, { fullName: 'Y', email: 'yousef.darwish@example.test', role: 'DepartmentAdmin', isActive: true, departmentId: D.dataEngineering })).reason).toBe('user.roleNotAllowed');
  });
});

describe('learners cannot manage users', () => {
  it('every operation is forbidden', () => {
    actAs(U.yousef);
    expect(error(() => list()).code).toBe('FORBIDDEN');
    expect(error(() => usersMock.assignable()).code).toBe('FORBIDDEN');
    expect(error(() => usersMock.create(newUser())).code).toBe('FORBIDDEN');
    expect(error(() => usersMock.remove(U.noor)).code).toBe('FORBIDDEN');
  });
});
