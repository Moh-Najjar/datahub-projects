import { ApiError } from '@/core/api/types';

/**
 * In-memory table for one module's SIMULATED backend. Data lives only in this browser tab and resets on
 * reload (no HR-like data is persisted to browser storage). Each module creates its own store from its
 * own fictional seed data in `modules/<module>/mock/`.
 */
export interface MockStore<T extends { id: string }> {
  all(): readonly T[];
  get(id: string): T;
  create(data: Omit<T, 'id'>): T;
  update(id: string, patch: Partial<Omit<T, 'id'>>): T;
  /**
   * Update only if `allowed(current)` holds — for workflow transitions such as approve/reject.
   * Throws `CONFLICT` otherwise (e.g. approving a request that was already rejected).
   */
  transition(id: string, allowed: (current: T) => boolean, patch: Partial<Omit<T, 'id'>>): T;
  remove(id: string): void;
  /** Restore the seed data (tests, "reset demo data"). */
  reset(): void;
}

export function createMockStore<T extends { id: string }>(seed: readonly T[], idPrefix: string): MockStore<T> {
  let rows: T[] = structuredClone([...seed]);
  let nextId = seed.length + 1;

  const indexOf = (id: string) => {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) throw new ApiError('NOT_FOUND', `${idPrefix} ${id} not found`);
    return index;
  };

  const store: MockStore<T> = {
    all: () => rows,
    get: (id) => rows[indexOf(id)]!,
    create(data) {
      let id: string;
      do id = `${idPrefix}-${String(nextId++).padStart(4, '0')}`;
      while (rows.some((r) => r.id === id));
      const row = { ...structuredClone(data), id } as T;
      rows = [...rows, row];
      return row;
    },
    update(id, patch) {
      const index = indexOf(id);
      const row = { ...rows[index]!, ...structuredClone(patch), id } as T;
      rows = rows.map((r, i) => (i === index ? row : r));
      return row;
    },
    transition(id, allowed, patch) {
      if (!allowed(store.get(id))) throw new ApiError('CONFLICT', `${idPrefix} ${id} cannot change from its current state`);
      return store.update(id, patch);
    },
    remove(id) {
      const index = indexOf(id);
      rows = rows.filter((_, i) => i !== index);
    },
    reset() {
      rows = structuredClone([...seed]);
      nextId = seed.length + 1;
    },
  };
  return store;
}
