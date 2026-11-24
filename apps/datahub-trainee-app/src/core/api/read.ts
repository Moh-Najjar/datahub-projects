/*
 * Tolerant readers for backend responses. The Academy API's Swagger documents request bodies but NO response models
 * (checked 2026-11-24), so every mapper in `modules/*\/api/*Http.ts` reads fields through these helpers with the names
 * the backend most likely uses (the request bodies' names first). When a real response shows other names, fix the
 * mapper — never the components.
 */

export type Raw = Record<string, unknown>;

export const asRaw = (value: unknown): Raw => (value && typeof value === 'object' ? (value as Raw) : {});

/** The first present string among the keys (`null` if none). */
export function str(o: Raw, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = o[key];
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

/** The first present number among the keys (`null` if none). */
export function num(o: Raw, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = o[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

export function bool(o: Raw, ...keys: string[]): boolean | null {
  for (const key of keys) if (typeof o[key] === 'boolean') return o[key] as boolean;
  return null;
}

/** The first present array among the keys (`[]` if none). */
export function arr(o: Raw, ...keys: string[]): Raw[] {
  for (const key of keys) if (Array.isArray(o[key])) return (o[key] as unknown[]).map(asRaw);
  return [];
}

/** A list answer: a bare array, or a paged object `{ items }`. */
export function listOf(data: unknown): Raw[] {
  if (Array.isArray(data)) return data.map(asRaw);
  return arr(asRaw(data), 'items', 'data', 'results');
}

/** `InProgress` / `in_progress` / `in-progress` → `inprogress`, for status matching. */
export const token = (value: string | null): string => (value ?? '').toLowerCase().replace(/[^a-z]/g, '');

/** `yyyy-MM-dd` of an ISO date-time (`null` stays `null`). */
export const dateOnly = (value: string | null): string | null => (value ? value.slice(0, 10) : null);

/** ISO date-time at the start of a `yyyy-MM-dd` day, in UTC (what `…AtUtc` fields expect). */
export const utcStartOf = (date: string | null): string | null => (date ? `${date}T00:00:00Z` : null);
