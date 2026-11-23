import { describe, expect, it } from 'vitest';
import { ApiError } from '@/core/api/types';
import { employeesApi as api } from '@/modules/employees/api/employeesApi';
import type { EmployeeScope } from '@/modules/employees/types/employee';
import { EMPLOYEE_SEED } from './seed';

/*
 * Field-level access to personal information (`hr.employees.view.personal`), enforced by the simulated backend:
 * unauthorized fields must not be RETURNED (not merely hidden by the UI).
 */

const scopes: Record<string, EmployeeScope> = {
  'system-admin': { kind: 'organization', role: 'system-admin' },
  'hr-admin': { kind: 'organization', role: 'hr-admin' },
  'hr-manager': { kind: 'organization', role: 'hr-manager' },
  'payroll-officer': { kind: 'organization', role: 'payroll-officer' },
  'department-manager': { kind: 'team', userId: 'usr-0004', role: 'department-manager' },
};
const WITH_PERSONAL = ['system-admin', 'hr-admin', 'hr-manager'];
const WITHOUT_PERSONAL = ['payroll-officer', 'department-manager'];

/** emp-0014 (Mobile Development) is inside the Department Manager's team, so every scope may read the record. */
const ID = 'emp-0014';
const seed = EMPLOYEE_SEED.find((e) => e.id === ID)!;
/** Values that must never appear in a response to a role without the permission. */
const SECRETS = [seed.dateOfBirth, seed.personalEmail, seed.phone, seed.address, seed.emergencyContact.name, seed.emergencyContact.phone];
const PERSONAL_KEYS = ['dateOfBirth', 'gender', 'nationality', 'maritalStatus', 'personalEmail', 'phone', 'alternativePhone', 'address', 'city', 'country', 'emergencyContact'];

describe('hr.employees.view.personal — enforced by the API', () => {
  it.each(WITH_PERSONAL)('%s receives the personal details', async (role) => {
    const employee = await api.getEmployeeById(ID, scopes[role]!);
    expect(employee.personal).toMatchObject({ dateOfBirth: seed.dateOfBirth, personalEmail: seed.personalEmail, emergencyContact: seed.emergencyContact });
  });

  it.each(WITHOUT_PERSONAL)('%s: personal details are not returned at all', async (role) => {
    const employee = await api.getEmployeeById(ID, scopes[role]!);
    expect(employee.personal).toBeNull();
    const json = JSON.stringify(employee);
    for (const secret of SECRETS) expect(json, secret).not.toContain(secret);
    for (const key of PERSONAL_KEYS) expect(Object.keys(employee), key).not.toContain(key);
    // Work and organization information stays available.
    expect(employee).toMatchObject({ employeeNumber: seed.employeeNumber, workEmail: seed.workEmail, department: { id: 'dep-eng-mob' }, position: { id: seed.positionId }, hireDate: seed.hireDate });
    expect(employee.manager?.id).toBe(seed.managerId);
  });

  it('directory rows never contain personal details, for any role', async () => {
    for (const scope of Object.values(scopes)) {
      const page = await api.getEmployees({ page: 1, pageSize: 50 }, scope);
      for (const row of page.items) for (const key of [...PERSONAL_KEYS, 'personal']) expect(Object.keys(row), key).not.toContain(key);
    }
  });

  it('write responses follow the same field rules as reads', async () => {
    expect((await api.updateEmployeeStatus('emp-0200', 'inactive', scopes['payroll-officer']!)).personal).toBeNull();
    expect((await api.updateEmployeeStatus('emp-0200', 'active', scopes['hr-admin']!)).personal).not.toBeNull();
  });

  it('a Department Manager still sees only their team', async () => {
    const error = await api.getEmployeeById('emp-0007', scopes['department-manager']!).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('FORBIDDEN');
  });
});
