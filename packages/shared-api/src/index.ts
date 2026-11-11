/**
 * @datahub/shared-api — API contracts and platform-independent request helpers.
 *
 * Contains no HTTP client: each app performs requests with its own platform integration
 * (fetch on the web, fetch/expo on mobile). Endpoints are added here only when they are genuinely
 * shared by more than one application.
 */
import type { ISODateString } from '@datahub/shared-types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Error payload returned by DataHub APIs. */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** Field-level validation messages, keyed by field name. */
  fields?: Record<string, string>;
}

/** Discriminated result of an API call, so callers handle failures explicitly. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody };

/** Standard paginated list payload. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Timestamps carried by persisted entities. */
export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export const isApiFailure = <T>(result: ApiResult<T>): result is Extract<ApiResult<T>, { ok: false }> => !result.ok;

/** Query parameter values; `undefined`/`null` entries are omitted. */
export type QueryParams = Record<string, string | number | boolean | null | undefined | ReadonlyArray<string | number>>;

/**
 * Serialises query parameters (`?a=1&b=x&b=y`). Implemented without `URLSearchParams`, whose
 * React Native implementation is incomplete.
 */
export function toQueryString(params: QueryParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Joins a base URL and a path without doubling or dropping slashes. */
export const joinUrl = (base: string, path: string): string => `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
