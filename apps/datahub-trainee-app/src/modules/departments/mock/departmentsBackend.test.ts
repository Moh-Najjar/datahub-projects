import { describe, expect, it } from 'vitest';
import { SEED_DEPARTMENTS as D, SEED_USERS as U } from '@/core/api/mock/seedData';
import { db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { actAs } from '@/test/actors';
import { departmentsMock } from './departmentsMock';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const list = (over: Record<string, unknown> = {}) => departmentsMock.list({ page: 1, pageSize: 50, ...over });

describe('Departments (SuperAdmin)', () => {
  it('lists the seven departments with their user and training counts', () => {
    actAs(U.superAdmin);
    const all = list().items;
    expect(all.map((d) => d.name)).toEqual(['Artificial Intelligence', 'Business Analysis and BRD', 'Cloud', 'Data Engineering', 'Infrastructure', 'Power BI', 'Software Development']);
    expect(all.find((d) => d.name === 'Data Engineering')).toMatchObject({ userCount: 5, trainingCount: 3 });
  });

  it('creates, renames and deletes; names are unique', () => {
    actAs(U.superAdmin);
    const created = departmentsMock.create({ name: 'Security' });
    expect(created).toMatchObject({ name: 'Security', userCount: 0, trainingCount: 0 });
    expect(error(() => departmentsMock.create({ name: ' security ' })).reason).toBe('department.duplicate');
    expect(departmentsMock.update(created.id, { name: 'Cyber Security' }).name).toBe('Cyber Security');
    expect(error(() => departmentsMock.update(created.id, { name: 'Cloud' })).code).toBe('CONFLICT');
    departmentsMock.remove(created.id);
    expect(error(() => departmentsMock.get(created.id)).code).toBe('NOT_FOUND');
  });

  it('validates the name (required, ≤ 150)', () => {
    actAs(U.superAdmin);
    expect(error(() => departmentsMock.create({ name: '  ' })).fieldErrors).toEqual({ name: ['field.required'] });
    expect(error(() => departmentsMock.create({ name: 'x'.repeat(151) })).fieldErrors).toEqual({ name: ['field.tooLong'] });
  });

  it('refuses to delete a department that still has users or trainings (no orphans)', () => {
    actAs(U.superAdmin);
    expect(error(() => departmentsMock.remove(D.dataEngineering)).reason).toBe('department.inUse');
    expect(db().departments.some((d) => d.id === D.dataEngineering)).toBe(true);
  });

  it('searches and sorts', () => {
    actAs(U.superAdmin);
    expect(list({ search: 'cloud' }).items.map((d) => d.name)).toEqual(['Cloud']);
    expect(list({ sortBy: 'users', sortDirection: 'desc' }).items[0]!.name).toBe('Data Engineering');
  });

  it('options feed the selects of other modules', () => {
    actAs(U.superAdmin);
    expect(departmentsMock.options()).toHaveLength(7);
  });
});

describe('Departments (other roles)', () => {
  it('a DepartmentAdmin can read only their own department and cannot change anything', () => {
    actAs(U.adminAi);
    expect(list().items.map((d) => d.name)).toEqual(['Artificial Intelligence']);
    expect(departmentsMock.options().map((d) => d.id)).toEqual([D.ai]);
    expect(error(() => departmentsMock.get(D.dataEngineering)).code).toBe('NOT_FOUND');
    expect(error(() => departmentsMock.create({ name: 'Nope' })).code).toBe('FORBIDDEN');
    expect(error(() => departmentsMock.update(D.ai, { name: 'Nope' })).code).toBe('FORBIDDEN');
    expect(error(() => departmentsMock.remove(D.ai)).code).toBe('FORBIDDEN');
  });

  it('learners cannot read departments', () => {
    actAs(U.yousef);
    expect(error(() => list()).code).toBe('FORBIDDEN');
  });
});
