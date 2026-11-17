import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/employees/mock/employeesMock';
import type {
  DocumentInput,
  Employee,
  EmployeeDocument,
  EmployeeFilters,
  EmployeeInput,
  EmployeeOption,
  EmployeeScope,
  EmployeeSummary,
  EmploymentHistoryEntry,
  EmploymentStatus,
  ManagerOptionsQuery,
} from '@/modules/employees/types/employee';

/*
 * Employees API service — the ONLY entry point to employee data. Every call runs against the SIMULATED backend
 * (`mock/`); with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented
 * before the contract exists).
 *
 * `scope` exists only because the mock has no token: the real backend derives who is asking (and so the
 * Department Manager's team) from the signed-in user and must refuse out-of-scope reads (`FORBIDDEN`). It must also
 * check `employees:write` / `documents:write` on every write — hiding buttons is not security.
 *
 * Field-level access: the profile's `personal` block and identity/medical documents are returned only to roles with
 * `employees:read:personal` (System Administrator, HR Administrator, HR Manager); others receive `personal: null`.
 */

type Signal = AbortSignal | undefined;

export const employeesApi = {
  getEmployees: (params: ListParams<EmployeeFilters>, scope: EmployeeScope, signal?: Signal): Promise<Paginated<EmployeeSummary>> =>
    mockRequest(() => mock.listEmployees(params, scope), { signal }),
  getEmployeeById: (id: string, scope: EmployeeScope, signal?: Signal): Promise<Employee> => mockRequest(() => mock.getEmployee(id, scope), { signal }),
  /** Writes return the saved employee as the caller may see it (same field-level rules as reads). */
  createEmployee: (input: EmployeeInput, scope: EmployeeScope): Promise<Employee> => mockRequest(() => mock.createEmployee(input, scope)),
  updateEmployee: (id: string, input: EmployeeInput, scope: EmployeeScope): Promise<Employee> => mockRequest(() => mock.updateEmployee(id, input, scope)),
  updateEmployeeStatus: (id: string, status: EmploymentStatus, scope: EmployeeScope): Promise<Employee> => mockRequest(() => mock.updateEmployeeStatus(id, status, scope)),

  getEmployeeDocuments: (id: string, scope: EmployeeScope, signal?: Signal): Promise<EmployeeDocument[]> =>
    mockRequest(() => mock.employeeDocuments(id, scope), { signal }),
  /** SIMULATED upload: sends metadata only; no file content leaves the browser and nothing is stored. */
  addEmployeeDocument: (id: string, input: DocumentInput, scope: EmployeeScope): Promise<EmployeeDocument> => mockRequest(() => mock.addEmployeeDocument(id, input, scope)),

  getEmployeeEmploymentHistory: (id: string, scope: EmployeeScope, signal?: Signal): Promise<EmploymentHistoryEntry[]> =>
    mockRequest(() => mock.employmentHistory(id, scope), { signal }),

  /** Valid direct managers (active, in the department or a parent department, not the employee or their reports). */
  getManagerOptions: (query: ManagerOptionsQuery, signal?: Signal): Promise<EmployeeOption[]> => mockRequest(() => mock.managerOptions(query), { signal }),
};
