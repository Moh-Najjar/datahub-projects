import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { failNextRequest } from '@/core/api/mock/mockConfig';
import { dashboardApi } from '@/modules/dashboard/api/dashboardApi';
import { createTestQueryClient } from '@/test/renderApp';
import { dashboardKeys, useDashboardSummary, useEmployeeGrowth } from './useDashboard';

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('dashboard queries (TanStack Query)', () => {
  it('uses structured query keys', () => {
    expect(dashboardKeys.summary('team')).toEqual(['dashboard', 'summary', 'team']);
    expect(dashboardKeys.departments()).toEqual(['dashboard', 'departments']);
    expect(dashboardKeys.employeeGrowth('organization').slice(0, 1)).toEqual(dashboardKeys.all);
  });

  it('loads data through the API service (loading → success)', async () => {
    const { result } = renderHook(() => useDashboardSummary('organization'), { wrapper: wrapperFor(createTestQueryClient()) });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.scope).toBe('organization');
    expect(result.current.data?.totalEmployees.current).toBeGreaterThan(0);
  });

  it('de-duplicates and caches: two consumers of the same key make one request', async () => {
    const spy = vi.spyOn(dashboardApi, 'getSummary');
    const client = createTestQueryClient();
    const { result } = renderHook(() => [useDashboardSummary('organization'), useDashboardSummary('organization')], { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.every((q) => q.isSuccess)).toBe(true));
    renderHook(() => useDashboardSummary('organization'), { wrapper: wrapperFor(client) }); // remount within staleTime
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not request data for widgets the role may not see (enabled: false)', async () => {
    const spy = vi.spyOn(dashboardApi, 'getEmployeeGrowth');
    const { result } = renderHook(() => useEmployeeGrowth('organization', false), { wrapper: wrapperFor(createTestQueryClient()) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(spy).not.toHaveBeenCalled();
  });

  it('retries server errors and then succeeds', async () => {
    const spy = vi.spyOn(dashboardApi, 'getSummary');
    failNextRequest('SERVER');
    failNextRequest('SERVER');
    const { result } = renderHook(() => useDashboardSummary('team'), { wrapper: wrapperFor(createTestQueryClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors (e.g. FORBIDDEN) and exposes the ApiError', async () => {
    const spy = vi.spyOn(dashboardApi, 'getSummary');
    failNextRequest('FORBIDDEN');
    const { result } = renderHook(() => useDashboardSummary('team'), { wrapper: wrapperFor(createTestQueryClient()) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('gives up after two retries of a persistent server error', async () => {
    const spy = vi.spyOn(dashboardApi, 'getSummary');
    failNextRequest('SERVER');
    failNextRequest('SERVER');
    failNextRequest('SERVER');
    const { result } = renderHook(() => useDashboardSummary('team'), { wrapper: wrapperFor(createTestQueryClient()) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
