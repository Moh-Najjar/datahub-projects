/*
 * API contracts shared by every module's API service. They describe what the future backend should return;
 * the mock implementation returns exactly these shapes, so replacing it changes no UI or hook code.
 */

export type SortDirection = 'asc' | 'desc';

/** Query parameters for every list endpoint. `page` is 1-based. */
export interface ListParams<TFilters extends object = Record<string, never>> {
  page: number;
  pageSize: number;
  /** Free-text search across the endpoint's searchable fields. */
  search?: string;
  sortBy?: string;
  sortDirection?: SortDirection;
  /** Exact-match filters; `undefined` / empty values are ignored. */
  filters?: Partial<TFilters>;
}

/** One page of a list endpoint. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Error categories the UI reacts to; messages come from `errors.<code>` in the translations. */
export type ApiErrorCode = 'BAD_REQUEST' | 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'SERVER' | 'NETWORK';

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER: 500,
  NETWORK: 0,
};

/**
 * The only error type API services throw. `reason` is a machine-readable business-rule id
 * (e.g. `enrollment.duplicate`) that the UI maps to a translated message.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly reason?: string;
  /** Field-level reasons for `VALIDATION` errors (field name → reason ids). */
  readonly fieldErrors?: Readonly<Record<string, string[]>>;
  /** The real backend's own message (untranslated); shown when the app has no translation for `reason`. */
  readonly detail?: string;

  constructor(code: ApiErrorCode, reason?: string, fieldErrors?: Record<string, string[]>, detail?: string) {
    super(reason ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.reason = reason;
    this.fieldErrors = fieldErrors;
    this.detail = detail;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Client errors (4xx) are final; retrying them only repeats the failure. */
export function isRetryable(error: unknown): boolean {
  return !isApiError(error) || error.status === 0 || error.status >= 500;
}
