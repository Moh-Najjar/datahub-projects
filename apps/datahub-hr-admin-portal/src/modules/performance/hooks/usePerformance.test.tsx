import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/context/AuthProvider';
import type { Role } from '@/core/config/permissions';
import { createTestQueryClient, storeSessionFor } from '@/test/renderApp';
import { performanceApi } from '@/modules/performance/api/performanceApi';
import { performanceKeys, useGoals, useUpdateGoalProgress } from './usePerformance';

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

describe('performance hooks', () => {
  it('the scope (organization / team / own) comes from the session and is part of the key', async () => {
    const spy = vi.spyOn(performanceApi, 'getGoals');
    for (const [role, kind, userId] of [['hr-admin', 'organization', 'usr-0002'], ['department-manager', 'team', 'usr-0004'], ['employee', 'own', 'usr-0005']] as const) {
      const { wrapper } = setup(role);
      const r = renderHook(() => useGoals(LIST), { wrapper });
      await waitFor(() => expect(r.result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenLastCalledWith(LIST, { kind, userId, role }, expect.anything());
    }
  });

  it('a write refreshes every performance query (goals ↔ reviews ↔ overview)', async () => {
    const { client, wrapper } = setup('hr-admin');
    const scope = { kind: 'organization' as const, userId: 'usr-0002', role: 'hr-admin' as const };
    client.setQueryData(performanceKeys.summary(scope), { cached: true });
    const goal = (await performanceApi.getGoals({ ...LIST, filters: { status: 'in-progress' } }, scope)).items[0]!;
    const update = renderHook(() => useUpdateGoalProgress(), { wrapper });
    await act(() => update.result.current.mutateAsync({ id: goal.id, input: { progress: 90, status: 'in-progress', note: '' } }));
    expect(client.getQueryState(performanceKeys.summary(scope))?.isInvalidated).toBe(true);
  });
});
