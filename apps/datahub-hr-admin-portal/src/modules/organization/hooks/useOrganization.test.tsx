import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { organizationApi } from '@/modules/organization/api/organizationApi';
import { createTestQueryClient } from '@/test/renderApp';
import {
  organizationKeys,
  useCreateDepartment,
  useDepartment,
  useDepartments,
  useOrganizationSummary,
  usePositions,
  useUpdateDepartment,
  useUpdateLocationStatus,
} from './useOrganization';

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const LIST = { page: 1, pageSize: 10, sortBy: 'code', sortDirection: 'asc' } as const;
const keysOf = (client: QueryClient, stale: boolean) =>
  client
    .getQueryCache()
    .getAll()
    .filter((q) => q.isStale() === stale)
    .map((q) => q.queryKey.slice(0, 2).join('/'));

describe('organization query hooks', () => {
  it('keys are nested per resource so one prefix invalidates lists, details and hierarchy', () => {
    expect(organizationKeys.departmentList(LIST)).toEqual(['organization', 'departments', 'list', LIST]);
    expect(organizationKeys.department('dep-eng')).toEqual(['organization', 'departments', 'detail', 'dep-eng']);
    expect(organizationKeys.hierarchy().slice(0, 2)).toEqual(organizationKeys.departments());
  });

  it('caches and de-duplicates identical list queries', async () => {
    const spy = vi.spyOn(organizationApi, 'getDepartments');
    const { wrapper } = setup();
    const a = renderHook(() => useDepartments(LIST), { wrapper });
    const b = renderHook(() => useDepartments({ ...LIST }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess && b.result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(a.result.current.data?.total).toBe(23);
  });

  it('keeps the previous page visible while the next page loads', async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ page }) => useDepartments({ ...LIST, page }), { wrapper, initialProps: { page: 1 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data;
    rerender({ page: 2 });
    expect(result.current.data).toBe(first);
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.page).toBe(2));
  });

  it('creating a department invalidates departments, positions and the summary (not locations)', async () => {
    const { client, wrapper } = setup();
    const departments = vi.spyOn(organizationApi, 'getDepartments');
    const positions = vi.spyOn(organizationApi, 'getPositions');
    const summary = renderHook(() => useOrganizationSummary(), { wrapper });
    renderHook(() => useDepartments(LIST), { wrapper });
    renderHook(() => usePositions(LIST), { wrapper });
    await client.prefetchQuery({ queryKey: organizationKeys.locationList(LIST), queryFn: () => organizationApi.getLocations(LIST) });
    await waitFor(() => expect(summary.result.current.data?.units.total).toBe(23));
    await waitFor(() => expect(positions).toHaveBeenCalledTimes(1));

    const create = renderHook(() => useCreateDepartment(), { wrapper });
    await act(() => create.result.current.mutateAsync({ code: 'NEW', name: { en: 'New', ar: 'جديد' }, description: '', parentId: null, managerId: null }));

    // Observed queries refetch at once: new totals, departments and positions requested again.
    await waitFor(() => expect(summary.result.current.data?.units.total).toBe(24));
    expect(departments).toHaveBeenCalledTimes(2);
    expect(positions).toHaveBeenCalledTimes(2);
    // Locations are unrelated: still fresh.
    expect(keysOf(client, false)).toContain('organization/locations');
  });

  it('an update writes the saved department into its detail cache', async () => {
    const { client, wrapper } = setup();
    const detail = renderHook(() => useDepartment('dep-mkt'), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    const update = renderHook(() => useUpdateDepartment(), { wrapper });
    const d = detail.result.current.data!;
    await act(() => update.result.current.mutateAsync({ id: d.id, input: { code: d.code, name: { en: 'Brand & Marketing', ar: d.name.ar }, description: '', parentId: null, managerId: null } }));
    expect(client.getQueryData<typeof d>(organizationKeys.department('dep-mkt'))?.name.en).toBe('Brand & Marketing');
    await waitFor(() => expect(detail.result.current.data?.manager).toBeNull());
  });

  it('does not retry validation errors (4xx); mutations are never retried', async () => {
    const spy = vi.spyOn(organizationApi, 'createDepartment');
    const { wrapper } = setup();
    const create = renderHook(() => useCreateDepartment(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync({ code: 'ENG', name: { en: 'Dup', ar: 'مكرر' }, description: '', parentId: null, managerId: null }).catch(() => undefined);
    });
    await waitFor(() => expect(create.result.current.error).toMatchObject({ code: 'VALIDATION', fieldErrors: { code: ['duplicate'] } }));
    expect(spy).toHaveBeenCalledTimes(1);

    const missing = renderHook(() => useDepartment('dep-missing'), { wrapper });
    await waitFor(() => expect(missing.result.current.isError).toBe(true));
    expect(missing.result.current.failureCount).toBe(1);
  });

  it('status mutations update the location detail cache', async () => {
    const { client, wrapper } = setup();
    const mutation = renderHook(() => useUpdateLocationStatus(), { wrapper });
    await act(() => mutation.result.current.mutateAsync({ id: 'loc-02', status: 'inactive' }));
    expect(client.getQueryData<{ status: string }>(organizationKeys.location('loc-02'))?.status).toBe('inactive');
  });
});
