import { describe, expect, it } from 'vitest';
import { ApiError, isRetryable } from '@/core/api/types';
import { queryCollection } from './collection';
import { failNextRequest, setMockConfig } from './mockConfig';
import { mockRequest } from './mockRequest';
import { createMockStore } from './store';

interface Row {
  id: string;
  name: string;
  department: string;
  salaryBand: number;
  status: 'pending' | 'approved' | 'rejected';
}

// Fictional test rows.
const ROWS: Row[] = [
  { id: 'r-1', name: 'Alpha Test', department: 'eng', salaryBand: 3, status: 'pending' },
  { id: 'r-2', name: 'Bravo Sample', department: 'hr', salaryBand: 1, status: 'approved' },
  { id: 'r-3', name: 'Charlie Demo', department: 'eng', salaryBand: 2, status: 'pending' },
  { id: 'r-4', name: 'Delta Example', department: 'fin', salaryBand: 5, status: 'rejected' },
  { id: 'r-5', name: 'Echo Mock', department: 'eng', salaryBand: 4, status: 'pending' },
];

describe('queryCollection', () => {
  it('paginates (1-based) and reports totals', () => {
    const page2 = queryCollection(ROWS, { page: 2, pageSize: 2 });
    expect(page2.items.map((r) => r.id)).toEqual(['r-3', 'r-4']);
    expect(page2).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(queryCollection(ROWS, { page: 9, pageSize: 2 }).items).toEqual([]);
  });

  it('clamps invalid paging values', () => {
    const r = queryCollection(ROWS, { page: 0, pageSize: 1000 });
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(100);
  });

  it('filters by exact value and by a list of values, ignoring empty filters', () => {
    const eng = queryCollection<Row, Pick<Row, 'department'>>(ROWS, { page: 1, pageSize: 10, filters: { department: 'eng' } });
    expect(eng.total).toBe(3);
    const any = queryCollection<Row, { status: Row['status'][] }>(ROWS, { page: 1, pageSize: 10, filters: { status: ['approved', 'rejected'] } });
    expect(any.items.map((r) => r.id)).toEqual(['r-2', 'r-4']);
    const none = queryCollection<Row, Pick<Row, 'department'>>(ROWS, { page: 1, pageSize: 10, filters: { department: undefined } });
    expect(none.total).toBe(5);
  });

  it('searches the configured fields case-insensitively', () => {
    const r = queryCollection(ROWS, { page: 1, pageSize: 10, search: 'DEMO' }, { searchFields: ['name'] });
    expect(r.items.map((x) => x.id)).toEqual(['r-3']);
  });

  it('sorts numbers and strings in both directions', () => {
    const byBand = queryCollection(ROWS, { page: 1, pageSize: 10, sortBy: 'salaryBand', sortDirection: 'desc' });
    expect(byBand.items.map((r) => r.salaryBand)).toEqual([5, 4, 3, 2, 1]);
    const byName = queryCollection(ROWS, { page: 1, pageSize: 10, sortBy: 'name' });
    expect(byName.items[0]!.name).toBe('Alpha Test');
  });

  it('supports a custom predicate', () => {
    const r = queryCollection<Row, { minBand: number }>(ROWS, { page: 1, pageSize: 10, filters: { minBand: 4 } }, { matches: (row, f) => row.salaryBand >= (f.minBand ?? 0) });
    expect(r.total).toBe(2);
  });
});

describe('createMockStore', () => {
  it('creates, reads, updates and deletes, and can reset to the seed', () => {
    const store = createMockStore(ROWS, 'r');
    const created = store.create({ name: 'Foxtrot New', department: 'hr', salaryBand: 2, status: 'pending' });
    expect(created.id).toBe('r-0006');
    expect(store.get(created.id).name).toBe('Foxtrot New');
    expect(store.update(created.id, { salaryBand: 3 }).salaryBand).toBe(3);
    store.remove(created.id);
    expect(() => store.get(created.id)).toThrowError(ApiError);
    store.update('r-1', { name: 'Changed' });
    store.reset();
    expect(store.get('r-1').name).toBe('Alpha Test');
    expect(store.all()).toHaveLength(5);
  });

  it('throws NOT_FOUND for unknown ids', () => {
    const store = createMockStore(ROWS, 'r');
    try {
      store.update('missing', { name: 'x' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('NOT_FOUND');
      expect((e as ApiError).status).toBe(404);
    }
  });

  it('allows workflow transitions only from the right state (approve/reject)', () => {
    const store = createMockStore(ROWS, 'r');
    const isPending = (r: Row) => r.status === 'pending';
    expect(store.transition('r-1', isPending, { status: 'approved' }).status).toBe('approved');
    expect(() => store.transition('r-1', isPending, { status: 'rejected' })).toThrowError(/cannot change/);
    expect(store.get('r-1').status).toBe('approved');
  });

  it('does not share objects with the seed', () => {
    const seed = [{ id: 'x-1', name: 'Seed' }];
    const store = createMockStore(seed, 'x');
    store.update('x-1', { name: 'Edited' });
    expect(seed[0]!.name).toBe('Seed');
  });
});

describe('mockRequest', () => {
  it('resolves after the simulated delay with a deep copy of the result', async () => {
    setMockConfig({ delayMs: { min: 30, max: 30 } });
    const source = { list: [1, 2] };
    const started = performance.now();
    const result = await mockRequest(() => source);
    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
    expect(result).toEqual(source);
    result.list.push(3);
    expect(source.list).toEqual([1, 2]);
  });

  it('fails the next request with a queued error code, then succeeds', async () => {
    setMockConfig({ delayMs: { min: 0, max: 0 } });
    failNextRequest('FORBIDDEN');
    await expect(mockRequest(() => 'ok')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(mockRequest(() => 'ok')).resolves.toBe('ok');
  });

  it('simulates random server failures when failureRate is set', async () => {
    setMockConfig({ delayMs: { min: 0, max: 0 }, failureRate: 1 });
    await expect(mockRequest(() => 'ok')).rejects.toMatchObject({ code: 'SERVER', status: 500 });
  });

  it('passes handler errors through (e.g. NOT_FOUND)', async () => {
    setMockConfig({ delayMs: { min: 0, max: 0 } });
    await expect(
      mockRequest(() => {
        throw new ApiError('NOT_FOUND');
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('can be cancelled while waiting', async () => {
    setMockConfig({ delayMs: { min: 1000, max: 1000 } });
    const controller = new AbortController();
    const pending = mockRequest(() => 'late', { signal: controller.signal });
    controller.abort(new DOMException('Aborted', 'AbortError'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('retry policy', () => {
  it('retries network/server errors but not client errors', () => {
    expect(isRetryable(new ApiError('SERVER'))).toBe(true);
    expect(isRetryable(new ApiError('NETWORK'))).toBe(true);
    expect(isRetryable(new ApiError('NOT_FOUND'))).toBe(false);
    expect(isRetryable(new ApiError('VALIDATION'))).toBe(false);
  });
});
