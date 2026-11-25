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
  errors?: Record<string, string[]> | { code?: string; field?: string; message?: string; description?: string }[];
  title?: string;
  detail?: string;
}

/**
 * The backend's own explanation: the validation descriptions (e.g. "'Preferred Language Code' must not be empty."),
 * else `error.message` / ProblemDetails `detail` (e.g. "The user was created, but invitation delivery is …").
 */
function detailOf(body: ProblemBody | null): string | undefined {
  const errors = body?.errors;
  const texts = Array.isArray(errors)
    ? errors.map((e) => e.description ?? e.message).filter((s): s is string => !!s)
    : Object.values(errors ?? {}).flat();
  if (texts.length) return texts.join(' ');
  return body?.error?.message ?? body?.detail ?? undefined;
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

/** A failed answer as `ApiError` (a 401 also ends the session). */
function failureOf(status: number, json: unknown): ApiError {
  if (status === 401) auth.onUnauthorized();
  const problem = json as ProblemBody | null;
  const fieldErrors = fieldErrorsOf(problem);
  const code = status === 400 && fieldErrors ? 'VALIDATION' : codeFor(status);
  return new ApiError(code, problem?.error?.code ?? undefined, fieldErrors, detailOf(problem));
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const unwrap = (json: unknown): unknown => (json && typeof json === 'object' && 'success' in json && 'data' in json ? (json as { data: unknown }).data : json);

/** A downloaded file: its bytes, or — when the API answers with a link (e.g. a storage URL) — that link. */
export type DownloadedFile = { kind: 'blob'; blob: Blob; contentType: string | null } | { kind: 'url'; url: string };

/** `filename` / `filename*` of a Content-Disposition header (readable cross-origin only when the API exposes it). */
function fileNameOf(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename*s*=s*(?:UTF-8'')?([^;]+)/i.exec(disposition)?.[1];
  if (star) return decodeURIComponent(star.trim().replace(/^"|"$/g, ''));
  return /filenames*=s*"?([^";]+)"?/i.exec(disposition)?.[1]?.trim() ?? null;
}

/**
 * GET a file with the Bearer token (a plain link cannot carry it). Swagger documents no response body for the
 * download endpoints (2026-11-25), so every likely answer is accepted: the file's bytes; JSON (envelope or bare) with a
 * link (`downloadUrl` / `url` / `sasUrl` / `fileUrl`); or JSON with base64 `content`.
 */
async function download(path: string, signal?: AbortSignal): Promise<DownloadedFile & { fileName: string | null }> {
  const token = auth.getAccessToken();
  if (!token) throw new ApiError('UNAUTHORIZED');
  let response: Response;
  try {
    response = await fetch(url(path), { method: 'GET', signal, credentials: 'omit', headers: { Accept: '*/*', Authorization: `Bearer ${token}` } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('NETWORK');
  }
  if (!response.ok) throw failureOf(response.status, parseJson(await response.text()));

  const contentType = response.headers.get('Content-Type');
  const fileName = fileNameOf(response.headers.get('Content-Disposition'));
  if (contentType?.includes('json')) {
    const data = unwrap(parseJson(await response.text()));
    const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const pick = (...keys: string[]) => keys.map((k) => o[k]).find((v): v is string => typeof v === 'string' && v.length > 0);
    const link = pick('downloadUrl', 'url', 'sasUrl', 'fileUrl', 'blobUrl');
    if (link) return { kind: 'url', url: link, fileName: pick('fileName') ?? fileName };
    const base64 = pick('content', 'base64', 'contentBase64', 'data');
    if (base64) {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const type = pick('contentType') ?? null;
      return { kind: 'blob', blob: new Blob([bytes], type ? { type } : undefined), contentType: type, fileName: pick('fileName') ?? fileName };
    }
    throw new ApiError('SERVER', 'file.unavailable');
  }
  return { kind: 'blob', blob: await response.blob(), contentType, fileName };
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

  const json = parseJson(response.status === 204 ? '' : await response.text());
  if (!response.ok) throw failureOf(response.status, json);
  // Envelope `{ success, data, … }`; a bare body is returned as is.
  return unwrap(json) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body ?? {}, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body ?? {}, options),
  delete: <T = void>(path: string, body?: unknown, options?: RequestOptions) => request<T>('DELETE', path, body, options),
  /** A file (bytes or a link) — see `download`. */
  download,
  /** Multipart upload: one `file` part per file (the field name the API expects). */
  upload: <T>(path: string, files: readonly File[], fields: Record<string, string> = {}) => {
    const form = new FormData();
    for (const file of files) form.append('file', file, file.name);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return request<T>('POST', path, form);
  },
};

/**
 * For lists that only ADD detail to a page (e.g. a learner's own enrollments next to their trainings): a refusal (403)
 * becomes an empty list so the page still works; every other failure is still thrown.
 */
export function emptyIfForbidden<T>(request: Promise<T>): Promise<T | []> {
  return request.catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'FORBIDDEN') return [];
    throw error;
  });
}

/** The id a create endpoint answers with: a bare id string, or an object with `id`. */
export function createdId(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string') return (data as { id: string }).id;
  throw new ApiError('SERVER', 'api.noIdReturned');
}
