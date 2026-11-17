import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/context/AuthProvider';
import type { Role } from '@/core/config/permissions';
import { createTestQueryClient, storeSessionFor } from '@/test/renderApp';
import { leaveApi } from '@/modules/leave/api/leaveApi';
import { leaveKeys, useApproveLeaveRequest, useLeaveRequests, useLeaveSummary } from './useLeave';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

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

const LIST = { page: 1, pageSize: 10 } as const;

describe('leave query hooks', () => {
  it('the scope comes from the session and is part of every key', async () => {
    const spy = vi.spyOn(leaveApi, 'getLeaveRequests');
    const hr = setup('hr-admin');
    const org = renderHook(() => useLeaveRequests(LIST), { wrapper: hr.wrapper });
    await waitFor(() => expect(org.result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenLastCalledWith(LIST, { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' }, expect.anything());
    expect(hr.client.getQueryData(leaveKeys.requestList({ kind: 'organization', userId: 'usr-0002', role: 'hr-admin' }, LIST))).toBeTruthy();

    const employee = setup('employee');
    const own = renderHook(() => useLeaveRequests(LIST), { wrapper: employee.wrapper });
    await waitFor(() => expect(own.result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenLastCalledWith(LIST, { kind: 'own', userId: 'usr-0005', role: 'employee' }, expect.anything());
  });

  it('a decision refreshes leave queries AND the attendance cache (approved leave = "On leave")', async () => {
    const { client, wrapper } = setup('hr-admin');
    const summary = renderHook(() => useLeaveSummary(2026), { wrapper });
    await waitFor(() => expect(summary.result.current.isSuccess).toBe(true));
    const before = summary.result.current.data!.byStatus.pending;
    client.setQueryData(['attendance', 'summary', 'x'], { cached: true });
    const pending = (await leaveApi.getLeaveRequests({ ...LIST, filters: { awaitingMe: 'true' } }, { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' })).items[0]!;

    const approve = renderHook(() => useApproveLeaveRequest(), { wrapper });
    await act(() => approve.result.current.mutateAsync(pending.id));
    expect(client.getQueryState(['attendance', 'summary', 'x'])?.isInvalidated).toBe(true);
    await waitFor(() => expect(client.getQueryData<{ byStatus: { pending: number } }>(leaveKeys.summary({ kind: 'organization', userId: 'usr-0002', role: 'hr-admin' }, 2026))?.byStatus.pending).toBe(before - 1));
  });

  it("lists are filtered to the caller's scope, never widened", async () => {
    const { wrapper } = setup('employee');
    const result = renderHook(() => useLeaveRequests({ ...LIST, filters: { employeeId: 'emp-0030' } }), { wrapper });
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true));
    expect(result.result.current.data!.total).toBe(0); // a list is filtered to the scope, never widened
  });
});
