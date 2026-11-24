import { conflict, invalid, notFound, requirePermission } from '@/core/api/mock/access';
import type { DbDepartment } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import { normalizeText, queryCollection } from '@/core/api/mock/mockUtils';
import type { ListParams, Paginated } from '@/core/api/types';
import { requireActor } from '@/core/auth/actor';
import { isDepartmentScoped } from '@/core/auth/trainingPolicy';
import type { DepartmentDto, DepartmentFilters, DepartmentInput, DepartmentOption } from '../types/department';

/*
 * Simulated Departments backend. Rules (original Training Portal): SuperAdmin creates, renames and deletes; names are
 * unique; a DepartmentAdmin can only read their own department. Added rule: a department that still has users or
 * trainings cannot be deleted (the original left orphans).
 */

function toDto(department: DbDepartment): DepartmentDto {
  const database = db();
  return {
    id: department.id,
    name: department.name,
    userCount: database.users.filter((u) => u.departmentId === department.id).length,
    trainingCount: database.trainings.filter((t) => t.departmentId === department.id).length,
  };
}

function cleanName(input: DepartmentInput): string {
  const name = input.name.trim();
  if (!name) invalid('name', 'field.required');
  if (name.length > 150) invalid('name', 'field.tooLong');
  return name;
}

function assertUniqueName(name: string, exceptId?: string): void {
  if (db().departments.some((d) => d.id !== exceptId && normalizeText(d.name) === normalizeText(name))) {
    conflict('department.duplicate');
  }
}

/** Departments the caller may read: SuperAdmin all; DepartmentAdmin their own. */
function readable(): DbDepartment[] {
  const actor = requireActor();
  requirePermission(actor, 'users.manage');
  const all = db().departments;
  return isDepartmentScoped(actor) ? all.filter((d) => d.id === actor.departmentId) : all;
}

export const departmentsMock = {
  list(params: ListParams<DepartmentFilters>): Paginated<DepartmentDto> {
    const rows = readable().map(toDto);
    return queryCollection(rows, params, {
      searchFields: (d) => [d.name],
      sorters: {
        name: (a, b) => a.name.localeCompare(b.name),
        users: (a, b) => a.userCount - b.userCount,
        trainings: (a, b) => a.trainingCount - b.trainingCount,
      },
      defaultSort: (a, b) => a.name.localeCompare(b.name),
    });
  },

  options(): DepartmentOption[] {
    return readable()
      .map((d) => ({ id: d.id, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  get(id: string): DepartmentDto {
    const department = readable().find((d) => d.id === id) ?? notFound('department.notFound');
    return toDto(department);
  },

  create(input: DepartmentInput): DepartmentDto {
    const actor = requireActor();
    requirePermission(actor, 'departments.manage');
    const name = cleanName(input);
    assertUniqueName(name);
    const department: DbDepartment = { id: newId('dep'), name, createdAt: new Date().toISOString() };
    db().departments.push(department);
    commit();
    return toDto(department);
  },

  update(id: string, input: DepartmentInput): DepartmentDto {
    const actor = requireActor();
    requirePermission(actor, 'departments.manage');
    const department = db().departments.find((d) => d.id === id) ?? notFound('department.notFound');
    const name = cleanName(input);
    assertUniqueName(name, id);
    department.name = name;
    commit();
    return toDto(department);
  },

  remove(id: string): void {
    const actor = requireActor();
    requirePermission(actor, 'departments.manage');
    const database = db();
    const department = database.departments.find((d) => d.id === id) ?? notFound('department.notFound');
    if (database.users.some((u) => u.departmentId === id) || database.trainings.some((t) => t.departmentId === id)) conflict('department.inUse');
    database.departments = database.departments.filter((d) => d.id !== department.id);
    commit();
  },
};
