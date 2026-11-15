/*
 * API contracts shared by every module's API service. They describe what the future backend should
 * return; the mock implementation returns exactly these shapes so swapping it out changes no UI code.
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

/** Error categories the UI can react to; messages come from `common:apiErrors.<code>`. */
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

/** The only error type API services throw. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Field-level messages for `VALIDATION` errors (field name → messages). */
  readonly fieldErrors?: Readonly<Record<string, string[]>>;

  constructor(code: ApiErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Client errors (4xx) are final; retrying them only repeats the failure. */
export function isRetryable(error: unknown): boolean {
  return !isApiError(error) || error.status === 0 || error.status >= 500;
}
