import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { organizationKeys } from '@/modules/organization';
import { employeesApi } from '@/modules/employees/api/employeesApi';
import type { EmployeeFilters, EmployeeInput, EmployeeScope, EmploymentStatus, ManagerOptionsQuery } from '@/modules/employees/types/employee';
import { useEmployeeAccess } from './useEmployeeAccess';

/**
 * Query keys: `['employees', <resource>, scope?, …]`. The scope is part of read keys, so a Department Manager's
 * team-scoped data is never served from an organization-wide cache entry (or the other way round).
 */
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (scope: EmployeeScope, params: ListParams<EmployeeFilters>) => [...employeeKeys.lists(), scope, params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (scope: EmployeeScope, id: string) => [...employeeKeys.details(), scope, id] as const,
  history: (scope: EmployeeScope, id: string) => [...employeeKeys.all, 'history', scope, id] as const,
  managerOptions: (query: ManagerOptionsQuery) => [...employeeKeys.all, 'manager-options', query] as const,
};

/* Queries ------------------------------------------------------------------------------------------------ */

export function useEmployees(params: ListParams<EmployeeFilters>) {
  const { scope } = useEmployeeAccess();
  return useQuery({ queryKey: employeeKeys.list(scope, params), queryFn: ({ signal }) => employeesApi.getEmployees(params, scope, signal), placeholderData: keepPreviousData });
}

export function useEmployee(id: string) {
  const { scope } = useEmployeeAccess();
  return useQuery({ queryKey: employeeKeys.detail(scope, id), queryFn: ({ signal }) => employeesApi.getEmployeeById(id, scope, signal) });
}

export function useEmploymentHistory(id: string) {
  const { scope } = useEmployeeAccess();
  return useQuery({ queryKey: employeeKeys.history(scope, id), queryFn: ({ signal }) => employeesApi.getEmployeeEmploymentHistory(id, scope, signal) });
}

export function useManagerOptions(query: ManagerOptionsQuery, enabled = true) {
  return useQuery({ queryKey: employeeKeys.managerOptions(query), queryFn: ({ signal }) => employeesApi.getManagerOptions(query, signal), enabled, placeholderData: keepPreviousData });
}

/* Mutations ---------------------------------------------------------------------------------------------- */

/**
 * After any employee change: every employee query, plus organization data derived from employees (department
 * employee counts, hierarchy totals, department-manager names and options).
 */
function invalidateAfterEmployeeChange(client: QueryClient) {
  return Promise.all([client.invalidateQueries({ queryKey: employeeKeys.all }), client.invalidateQueries({ queryKey: organizationKeys.all })]);
}

export function useCreateEmployee() {
  const client = useQueryClient();
  const { scope } = useEmployeeAccess();
  return useMutation({ mutationFn: (input: EmployeeInput) => employeesApi.createEmployee(input, scope), onSuccess: () => invalidateAfterEmployeeChange(client) });
}

export function useUpdateEmployee() {
  const client = useQueryClient();
  const { scope } = useEmployeeAccess();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: EmployeeInput }) => employeesApi.updateEmployee(id, input, scope), onSuccess: () => invalidateAfterEmployeeChange(client) });
}

export function useUpdateEmployeeStatus() {
  const client = useQueryClient();
  const { scope } = useEmployeeAccess();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EmploymentStatus }) => employeesApi.updateEmployeeStatus(id, status, scope),
    onSuccess: () => invalidateAfterEmployeeChange(client),
  });
}

