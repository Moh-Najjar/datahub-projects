import { API_BASE_URL } from '@/core/config/api';
import { ApiError, type ApiErrorCode } from './types';

/*
 * The ONE HTTP client of the DataHub Analytics API (module `api/*Http.ts` files use it; components never do).
 * - Base URL from `core/config/api.ts`; query strings; JSON bodies (DELETE too) or multipart `FormData`.
 * - Every request carries `Authorization: Bearer <access token>` (the Workspace token of this tab's session). `core`
 *   does not know the session: the AuthProvider registers the token provider with `configureHttpAuth`.
 * - Unwraps the backend envelope `{ success, data, error: { code, message }, meta }`.
 * - Failures become the app's `ApiError` (code from the HTTP status, `reason` = the backend's error code, e.g.
 *   `Academy.TrainingNotFound`), so the UI's error handling is the same as with the simulated backend.
 * - A 401 ends the session (the token expired or was refused) through `onUnauthorized`.
 * - Never cookies (`credentials: 'omit'`); tokens are never logged.
 */

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Query;
  signal?: AbortSignal;
}

interface AuthHooks {
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
}

let auth: AuthHooks = { getAccessToken: () => null, onUnauthorized: () => undefined };

export function configureHttpAuth(hooks: AuthHooks): void {
  auth = hooks;
}

function codeFor(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION';
  return 'SERVER';
}

interface ProblemBody {
  error?: { code?: string; message?: string } | null;
  errors?: Record<string, string[]> | { code?: string; field?: string; message?: string }[];
  title?: string;
}

/** Field errors of an ASP.NET ProblemDetails / envelope answer, as field → messages. */
function fieldErrorsOf(body: ProblemBody | null): Record<string, string[]> | undefined {
  const errors = body?.errors;
  if (!errors) return undefined;
  if (Array.isArray(errors)) {
    const out: Record<string, string[]> = {};
    for (const e of errors) if (e.field) (out[e.field.charAt(0).toLowerCase() + e.field.slice(1)] ??= []).push(e.message ?? e.code ?? 'invalid');
    return Object.keys(out).length ? out : undefined;
  }
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field.charAt(0).toLowerCase() + field.slice(1), messages]));
}

function url(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  const qs = params.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function request<T>(method: string, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  const token = auth.getAccessToken();
  if (!token) throw new ApiError('UNAUTHORIZED');
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(url(path, options.query), {
      method,
      signal: options.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError('NETWORK');
  }

  const text = response.status === 204 ? '' : await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) auth.onUnauthorized();
    const problem = json as ProblemBody | null;
    const fieldErrors = fieldErrorsOf(problem);
    const code = response.status === 400 && fieldErrors ? 'VALIDATION' : codeFor(response.status);
    throw new ApiError(code, problem?.error?.code ?? undefined, fieldErrors);
  }

  // Envelope `{ success, data, … }`; a bare body is returned as is.
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) return (json as { data: T }).data;
  return json as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body ?? {}, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body ?? {}, options),
  delete: <T = void>(path: string, body?: unknown, options?: RequestOptions) => request<T>('DELETE', path, body, options),
  /** Multipart upload: one `file` part per file (the field name the API expects). */
  upload: <T>(path: string, files: readonly File[], fields: Record<string, string> = {}) => {
    const form = new FormData();
    for (const file of files) form.append('file', file, file.name);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return request<T>('POST', path, form);
  },
};

/** The id a create endpoint answers with: a bare id string, or an object with `id`. */
export function createdId(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string') return (data as { id: string }).id;
  throw new ApiError('SERVER', 'api.noIdReturned');
}
