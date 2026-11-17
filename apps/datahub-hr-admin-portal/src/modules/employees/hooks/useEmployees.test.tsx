import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/context/AuthProvider';
import type { Role } from '@/core/config/permissions';
import { organizationKeys, useDepartmentHierarchy } from '@/modules/organization';
import { createTestQueryClient, storeSessionFor } from '@/test/renderApp';
import { employeesApi } from '@/modules/employees/api/employeesApi';
import { employeeToInput } from '@/modules/employees/utils/employeeInput';
import { employeeKeys, useEmployee, useEmployees, useUpdateEmployee, useUpdateEmployeeStatus } from './useEmployees';

function setup(role: Role) {
  storeSessionFor(role);
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

const LIST = { page: 1, pageSize: 10, sortBy: 'employeeNumber', sortDirection: 'asc' } as const;

describe('employee query hooks', () => {
  it('the scope comes from the session and is part of the query key', async () => {
    const spy = vi.spyOn(employeesApi, 'getEmployees');
    const hr = setup('hr-admin');
    const org = renderHook(() => useEmployees(LIST), { wrapper: hr.wrapper });
    await waitFor(() => expect(org.result.current.data?.total).toBe(248));
    expect(spy).toHaveBeenLastCalledWith(LIST, { kind: 'organization', role: 'hr-admin' }, expect.anything());
    expect(hr.client.getQueryData(employeeKeys.list({ kind: 'organization', role: 'hr-admin' }, LIST))).toBeTruthy();

    const manager = setup('department-manager');
    const team = renderHook(() => useEmployees(LIST), { wrapper: manager.wrapper });
    await waitFor(() => expect(team.result.current.data?.total).toBe(62));
    expect(spy).toHaveBeenLastCalledWith(LIST, { kind: 'team', userId: 'usr-0004', role: 'department-manager' }, expect.anything());
  });

  it('a team-scoped profile outside the team fails with FORBIDDEN and is not retried', async () => {
    const { wrapper } = setup('department-manager');
    const result = renderHook(() => useEmployee('emp-0007'), { wrapper });
    await waitFor(() => expect(result.result.current.isError).toBe(true));
    expect(result.result.current.error).toMatchObject({ code: 'FORBIDDEN' });
    expect(result.result.current.failureCount).toBe(1);
  });

  it('employee changes refresh employee queries AND organization data derived from employees', async () => {
    const { client, wrapper } = setup('hr-admin');
    // Organization data derived from employees (department counts) is cached…
    const hierarchy = renderHook(() => useDepartmentHierarchy(), { wrapper });
    await waitFor(() => expect(hierarchy.result.current.isSuccess).toBe(true));
    const countBefore = hierarchy.result.current.data!.find((d) => d.id === 'dep-eng-mob')!.employeeCount;
    const detail = renderHook(() => useEmployee('emp-0060'), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));

    const status = renderHook(() => useUpdateEmployeeStatus(), { wrapper });
    await act(() => status.result.current.mutateAsync({ id: 'emp-0060', status: 'inactive' }));
    // The observed profile was refetched (assert on the cache: what every subscriber renders).
    await waitFor(() => expect(client.getQueryData<{ status: string }>(employeeKeys.detail({ kind: 'organization', role: 'hr-admin' }, 'emp-0060'))?.status).toBe('inactive'));
    // …and is refreshed: emp-0060 (Mobile Development) no longer counts as active.
    await waitFor(() => expect(client.getQueryData<Array<{ id: string; employeeCount: number }>>(organizationKeys.hierarchy())?.find((d) => d.id === 'dep-eng-mob')?.employeeCount).toBe(countBefore - 1));
  });

  it('updates are not retried and report field errors', async () => {
    const { wrapper } = setup('hr-admin');
    const spy = vi.spyOn(employeesApi, 'updateEmployee');
    const dana = await employeesApi.getEmployeeById('emp-0001', { kind: 'organization', role: 'hr-admin' });
    const update = renderHook(() => useUpdateEmployee(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({ id: 'emp-0001', input: { ...employeeToInput(dana), employeeNumber: 'EMP-0002' } }).catch(() => undefined);
    });
    await waitFor(() => expect(update.result.current.error).toMatchObject({ code: 'VALIDATION', fieldErrors: { employeeNumber: ['duplicate'] } }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
