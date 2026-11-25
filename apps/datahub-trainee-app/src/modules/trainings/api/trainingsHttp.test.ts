import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttpAuth } from '@/core/api/http';
import { trainingsHttpApi } from './trainingsHttp';

// A learner (no session permissions → not staff) on the real HTTP mapping; only `fetch` is replaced.
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status < 300 ? { success: true, data } : { success: false, error: { code: 'Forbidden', message: 'Forbidden' } }), { status, headers: { 'Content-Type': 'application/json' } });

function backend(enrollmentsStatus: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input), 'http://api.test').pathname;
      if (path.endsWith('/me/trainings'))
        return json([
          { id: 't-draft', title: 'Draft one', status: 'Draft' },
          { id: 't-pub', title: 'Published one', status: 'Published' },
        ]);
      if (path.endsWith('/me/enrollments')) return enrollmentsStatus === 200 ? json([{ id: 'e1', trainingId: 't-pub', status: 'InProgress', progressPercentage: 40 }]) : json(null, enrollmentsStatus);
      return json(null, 404);
    }),
  );
}

beforeEach(() => configureHttpAuth({ getAccessToken: () => 'test-token', onUnauthorized: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('a learner’s trainings over HTTP', () => {
  it('lists only published trainings, with the learner’s own progress', async () => {
    backend(200);
    const page = await trainingsHttpApi.list({ page: 1, pageSize: 10 });
    expect(page.items.map((t) => t.id)).toEqual(['t-pub']);
    expect(page.items[0]!.myEnrollment).toMatchObject({ status: 'in-progress', progress: 40 });
  });

  it('still lists the trainings when the enrollments are refused (403), without progress', async () => {
    backend(403);
    const page = await trainingsHttpApi.list({ page: 1, pageSize: 10 });
    expect(page.items.map((t) => t.id)).toEqual(['t-pub']);
    expect(page.items[0]!.myEnrollment).toBeNull();
  });

  it('other failures of the enrollments are still errors', async () => {
    backend(500);
    await expect(trainingsHttpApi.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'SERVER' });
  });
});
