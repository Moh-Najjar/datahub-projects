import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/context/AuthProvider';
import type { Role } from '@/core/config/permissions';
import { createTestQueryClient, storeSessionFor } from '@/test/renderApp';
import { recruitmentApi } from '@/modules/recruitment/api/recruitmentApi';
import { recruitmentKeys, useCandidates, useUpdateCandidateStage } from './useRecruitment';

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

describe('recruitment hooks', () => {
  it('the scope (organization / team) comes from the session and is part of the key', async () => {
    const spy = vi.spyOn(recruitmentApi, 'getCandidates');
    const hr = setup('hr-admin');
    const org = renderHook(() => useCandidates(LIST), { wrapper: hr.wrapper });
    await waitFor(() => expect(org.result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenLastCalledWith(LIST, { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' }, expect.anything());
    const manager = setup('department-manager');
    const team = renderHook(() => useCandidates(LIST), { wrapper: manager.wrapper });
    await waitFor(() => expect(team.result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenLastCalledWith(LIST, { kind: 'team', userId: 'usr-0004', role: 'department-manager' }, expect.anything());
    expect(team.result.current.data!.total).toBeLessThan(org.result.current.data!.total);
  });

  it('a pipeline move refreshes every recruitment query (counts, history, summary)', async () => {
    const { client, wrapper } = setup('hr-admin');
    const scope = { kind: 'organization' as const, userId: 'usr-0002', role: 'hr-admin' as const };
    client.setQueryData(recruitmentKeys.summary(scope), { cached: true });
    const c = (await recruitmentApi.getCandidates({ ...LIST, filters: { stage: 'new' } }, scope)).items[0]!;
    const move = renderHook(() => useUpdateCandidateStage(), { wrapper });
    await act(() => move.result.current.mutateAsync({ id: c.id, stage: 'screening', note: '' }));
    expect(client.getQueryState(recruitmentKeys.summary(scope))?.isInvalidated).toBe(true);
  });
});
