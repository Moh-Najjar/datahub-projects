import { describe, expect, it, vi } from 'vitest';
import { ApiError, isApiError, isRetryable } from '@/core/api/types';
import { createSeedData } from './seedData';
import { DB_SCHEMA_VERSION, DB_STORAGE_KEY, commit, db, newId, reloadMockDatabase, resetMockDatabase } from './mockDatabase';
import { failNextRequest, getMockConfig, resetMockConfig, setMockConfig } from './mockConfig';
import { normalizeText, paginate, queryCollection } from './mockUtils';
import { mockRequest } from './mockRequest';

describe('mock database persistence (versioned localStorage)', () => {
  it('seeds realistic fictional data on first use and stores it', () => {
    const database = db();
    expect(database.departments.map((d) => d.name)).toContain('Data Engineering');
    expect(database.users.length).toBeGreaterThan(10);
    expect(database.users.every((u) => u.email.endsWith('@example.test'))).toBe(true);
    expect(JSON.parse(localStorage.getItem(DB_STORAGE_KEY)!).version).toBe(DB_SCHEMA_VERSION);
  });

  it('keeps created data across a "page refresh"', () => {
    const id = newId('trn');
    db().trainings.push({ ...db().trainings[0]!, id, title: 'Created before refresh' });
    commit();
    reloadMockDatabase(); // forget the in-memory copy, as a browser refresh does
    expect(db().trainings.some((t) => t.id === id && t.title === 'Created before refresh')).toBe(true);
  });

  it('never stores credentials or tokens', () => {
    db();
    const raw = localStorage.getItem(DB_STORAGE_KEY)!.toLowerCase();
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('token');
  });

  it('recovers from corrupted stored data by re-seeding', () => {
    localStorage.setItem(DB_STORAGE_KEY, '{ this is not json');
    reloadMockDatabase();
    expect(db().trainings.length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem(DB_STORAGE_KEY)!).version).toBe(DB_SCHEMA_VERSION);
  });

  it('discards data written by another schema version', () => {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ version: DB_SCHEMA_VERSION + 5, data: { ...createSeedData(), trainings: [] } }));
    reloadMockDatabase();
    expect(db().trainings.length).toBeGreaterThan(0);
  });

  it('discards structurally wrong data (a table is missing)', () => {
    const broken: Record<string, unknown> = { ...createSeedData() };
    delete broken.enrollments;
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ version: DB_SCHEMA_VERSION, data: broken }));
    reloadMockDatabase();
    expect(Array.isArray(db().enrollments)).toBe(true);
    expect(db().enrollments.length).toBeGreaterThan(0);
  });

  it('survives storage that throws (private mode / quota)', () => {
    resetMockDatabase();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => db()).not.toThrow();
    expect(() => commit()).not.toThrow();
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId('x')));
    expect(ids.size).toBe(50);
  });

  it('resetMockDatabase restores the seed', () => {
    db().trainings.length = 0;
    commit();
    resetMockDatabase();
    expect(db().trainings.length).toBeGreaterThan(0);
  });
});

describe('queryCollection: search, filter, sort and pagination', () => {
  const rows = ['Álvaro Diaz', 'Bella Stone', 'Chen Wei', 'Dana Cole', 'Eli Park', 'Fay Zhou', 'Gus Hale'].map((name, i) => ({ name, team: i % 2 ? 'blue' : 'red', n: i }));
  const options = { searchFields: (r: (typeof rows)[number]) => [r.name], matches: (r: (typeof rows)[number], f: { team?: string }) => !f.team || r.team === f.team, sorters: { name: (a: (typeof rows)[number], b: (typeof rows)[number]) => a.name.localeCompare(b.name), n: (a: (typeof rows)[number], b: (typeof rows)[number]) => a.n - b.n } };

  it('searches case- and accent-insensitively', () => {
    expect(queryCollection(rows, { page: 1, pageSize: 10, search: 'alvaro' }, options).items.map((r) => r.name)).toEqual(['Álvaro Diaz']);
    expect(normalizeText('  ÉLAN ')).toBe('elan');
  });

  it('filters, sorts and reports totals', () => {
    const result = queryCollection(rows, { page: 1, pageSize: 10, filters: { team: 'blue' }, sortBy: 'n', sortDirection: 'desc' }, options);
    expect(result.items.map((r) => r.n)).toEqual([5, 3, 1]);
    expect(result.total).toBe(3);
  });

  it('ignores empty filter values and unknown sort keys', () => {
    expect(queryCollection(rows, { page: 1, pageSize: 10, filters: { team: '' }, sortBy: 'nope' }, options).total).toBe(7);
  });

  it('paginates (1-based) and clamps out-of-range pages', () => {
    const page2 = queryCollection(rows, { page: 2, pageSize: 3, sortBy: 'n' }, options);
    expect(page2.items.map((r) => r.n)).toEqual([3, 4, 5]);
    expect(page2.totalPages).toBe(3);
    expect(queryCollection(rows, { page: 99, pageSize: 3, sortBy: 'n' }, options).page).toBe(3);
    expect(paginate([], 1, 10)).toMatchObject({ total: 0, totalPages: 1, items: [] });
  });
});

describe('mock request: delays, injected failures, cloning', () => {
  it('waits the configured simulated latency', async () => {
    vi.useFakeTimers();
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    let done = false;
    const pending = mockRequest(() => 'ok').then(() => (done = true));
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await pending;
    expect(done).toBe(true);
  });

  it('fails the next request with the injected error code, once', async () => {
    failNextRequest('SERVER');
    await expect(mockRequest(() => 1)).rejects.toMatchObject({ code: 'SERVER', status: 500 });
    await expect(mockRequest(() => 1)).resolves.toBe(1);
  });

  it('can fail randomly at a configured rate', async () => {
    setMockConfig({ failureRate: 1 });
    await expect(mockRequest(() => 1)).rejects.toBeInstanceOf(ApiError);
    resetMockConfig();
    expect(getMockConfig().failureRate).toBe(0);
  });

  it('returns a copy, so callers cannot mutate the database through a result', async () => {
    const result = await mockRequest(() => db().departments);
    result[0]!.name = 'Tampered';
    expect(db().departments[0]!.name).not.toBe('Tampered');
  });

  it('is abortable', async () => {
    setMockConfig({ delayMs: { min: 50, max: 50 } });
    const controller = new AbortController();
    const pending = mockRequest(() => 1, { signal: controller.signal });
    controller.abort(new Error('aborted'));
    await expect(pending).rejects.toThrow('aborted');
  });
});

describe('ApiError', () => {
  it('maps codes to HTTP-like statuses and only retries network/server failures', () => {
    expect(new ApiError('NOT_FOUND').status).toBe(404);
    expect(new ApiError('CONFLICT').status).toBe(409);
    expect(new ApiError('VALIDATION', 'x', { f: ['x'] }).fieldErrors).toEqual({ f: ['x'] });
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isRetryable(new ApiError('SERVER'))).toBe(true);
    expect(isRetryable(new ApiError('NETWORK'))).toBe(true);
    expect(isRetryable(new ApiError('FORBIDDEN'))).toBe(false);
    expect(isRetryable(new Error('boom'))).toBe(true);
  });
});
