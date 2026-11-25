import { API_BASE_URL } from '@/core/config/api';

/*
 * Layer 1 — the HTTP client of the backend API (HTTP helpers → API functions → TanStack Query hooks → UI).
 * JSON in and out, the `{ success, data, error }` envelope unwrapped, errors as `HttpError`, and the Bearer token for
 * `auth: true` requests (provided by the Workspace session through `configureHttpAuth`). Never sends cookies.
 */

export interface ApiFieldError {
  code: string;
  description: string;
}

/** A failed request. `status` 0 = no answer (network); `code` = backend error code, e.g. `Cms.ConcurrencyConflict`. */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors: ApiFieldError[];

  constructor(status: number, message: string, code?: string, errors: ApiFieldError[] = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

interface AuthProvider {
  getAccessToken: () => string | null;
  /** The API refused the token (401) and it could not be refreshed. */
  onUnauthorized: () => void;
  /** Gets a new access token (the backend's refresh endpoint). Resolves `true` when there is one; never throws. */
  refresh?: () => Promise<boolean>;
}

let authProvider: AuthProvider | null = null;

export function configureHttpAuth(provider: AuthProvider | null): void {
  authProvider = provider;
}

interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  /** Send the signed-in user's access token. */
  auth?: boolean;
  /** Send this token instead (e.g. right after login). */
  token?: string;
  /**
   * Send / accept cookies. Default `omit`; only the sign-in endpoints (login, refresh, logout) use `include`, in case the
   * backend keeps the refresh token in an HttpOnly cookie as well as in the body.
   */
  credentials?: RequestCredentials;
  /** Internal: this request is the retry after a refresh. */
  retried?: boolean;
}

/** The envelope `{ success, data, error }`, plus ProblemDetails fields on errors (`title`, `detail`, `errors`). */
interface ResponseBody {
  success?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  title?: string;
  detail?: string;
  errors?: ApiFieldError[];
}

function toUrl(path: string, query: RequestOptions['query'] = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.append(key, String(value));
  const qs = params.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const { query, signal, auth, token, credentials = 'omit', retried } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth || token) {
    const bearer = token ?? authProvider?.getAccessToken();
    if (!bearer) throw new HttpError(401, 'Sign in to continue.');
    headers.Authorization = `Bearer ${bearer}`;
  }

  let response: Response;
  try {
    response = await fetch(toUrl(path, query), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal, credentials });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new HttpError(0, 'The API could not be reached.');
  }

  const text = await response.text();
  let json: ResponseBody | undefined;
  try {
    json = text ? (JSON.parse(text) as ResponseBody) : undefined;
  } catch {
    json = undefined; // not JSON (e.g. a proxy's HTML error page)
  }

  if (!response.ok || json?.success === false) {
    if (response.status === 401 && auth && !token) {
      // The access token expired or was refused: refresh it once and repeat the request; otherwise the session ends.
      if (!retried && authProvider?.refresh && (await authProvider.refresh())) return request<T>(method, path, body, { ...options, retried: true });
      authProvider?.onUnauthorized();
    }
    throw new HttpError(response.status, json?.error?.message ?? json?.detail ?? `HTTP ${response.status}`, json?.error?.code ?? json?.title, json?.errors ?? []);
  }
  return (json?.success === true ? json.data : json) as T;
}

export const http = {
  get: <T,>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T,>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
  put: <T,>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
  delete: <T,>(path: string, body?: unknown, options?: RequestOptions) => request<T>('DELETE', path, body, options),
};
