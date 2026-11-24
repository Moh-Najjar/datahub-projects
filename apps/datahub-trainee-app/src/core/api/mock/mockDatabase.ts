import type { MockDatabase } from './dbTypes';
import { createSeedData } from './seedData';

/*
 * The in-browser database of the simulated training backend. It is kept in memory and mirrored to `localStorage`
 * under a VERSIONED schema, so created trainings, enrollments, users, evaluations, progress and activity survive a
 * refresh. Stored data that is corrupted, from another schema version or structurally wrong is discarded and the
 * seed is restored. It never stores credentials or tokens, and it is only ever read by the mock API handlers.
 */

/** Bump when the shape of `MockDatabase` changes: older stored data is then replaced by the seed. */
export const DB_SCHEMA_VERSION = 1;
export const DB_STORAGE_KEY = 'datahub-trainee.mock-db';

const TABLES = ['departments', 'users', 'trainings', 'materials', 'assignments', 'submissions', 'enrollments', 'evaluations', 'activities'] as const;

interface StoredDatabase {
  version: number;
  data: MockDatabase;
}

function isDatabase(value: unknown): value is MockDatabase {
  if (!value || typeof value !== 'object') return false;
  const db = value as Record<string, unknown>;
  return typeof db.seq === 'number' && TABLES.every((table) => Array.isArray(db[table]));
}

function readStored(): MockDatabase | null {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDatabase> | null;
    if (!parsed || parsed.version !== DB_SCHEMA_VERSION || !isDatabase(parsed.data)) {
      localStorage.removeItem(DB_STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    try {
      localStorage.removeItem(DB_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
    return null;
  }
}

let current: MockDatabase | null = null;

function persist(): void {
  if (!current) return;
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ version: DB_SCHEMA_VERSION, data: current } satisfies StoredDatabase));
  } catch {
    // Storage full or unavailable: the data simply lasts until reload.
  }
}

/** The live database (loaded from storage, else seeded, on first use). Mutate it, then call `commit()`. */
export function db(): MockDatabase {
  if (!current) {
    current = readStored();
    if (!current) {
      current = createSeedData();
      persist();
    }
  }
  return current;
}

/** Saves the database after a write. */
export function commit(): void {
  persist();
}

/** A new unique id such as `trn-0042`. */
export function newId(prefix: string): string {
  const database = db();
  database.seq += 1;
  return `${prefix}-${String(database.seq).padStart(4, '0')}`;
}

/** Restores the seed data and clears the stored copy ("reset demo data", tests). */
export function resetMockDatabase(): void {
  current = null;
  try {
    localStorage.removeItem(DB_STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }
}

/** Forgets the in-memory copy so the next access re-reads storage (tests that simulate a page reload). */
export function reloadMockDatabase(): void {
  current = null;
}
