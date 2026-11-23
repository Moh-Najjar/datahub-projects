import type { Localized } from '@datahub/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/context/authContext';
import { employeesApi } from '@/modules/employees';

export interface EmployeeChoice {
  id: string;
  employeeNumber: string;
  name: Localized<string>;
}

/** Active employees matching a search (Employee Management's own API and scope — one source of employee data). */
export function useEmployeeSearch(search: string) {
  const { user, can } = useAuth();
  const role = user?.role ?? 'employee';
  return useQuery({
    queryKey: ['employees', 'list', 'users-picker', role, search],
    queryFn: async ({ signal }) => {
      const page = await employeesApi.getEmployees({ page: 1, pageSize: 20, search: search || undefined, sortBy: 'employeeNumber', sortDirection: 'asc', filters: { status: 'active' } }, { kind: 'organization', role }, signal);
      return page.items.map((e): EmployeeChoice => ({ id: e.id, employeeNumber: e.employeeNumber, name: { en: `${e.name.first.en} ${e.name.last.en}`, ar: `${e.name.first.ar} ${e.name.last.ar}` } }));
    },
    enabled: can('organization.employees.view'),
    placeholderData: keepPreviousData,
  });
}
