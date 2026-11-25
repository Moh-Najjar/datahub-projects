import { apiPaths } from '@/core/api/paths';
import { http, HttpError } from '@/core/helpers/http';

/*
 * Layer 2 — Authentication API functions. The access token is a JWT (~15 min); `refresh` exchanges the refresh token
 * for a new one and `logout` ends it (both answered 403 to every request on 2026-11-22 and 2026-11-25 — the Workspace
 * then simply ends the session when the access token expires).
 */

export interface LoginResult {
  accessToken: string;
  /** Present when the backend returns it in the body (it may also keep it in an HttpOnly cookie). */
  refreshToken?: string | null;
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
  preferredLanguage: string;
}

/** An application the user may open, e.g. `blogs-admin`. */
export interface Portal {
  key: string;
  name: string;
  description: string;
}

export const authApi = {
  login: (email: string, password: string) => http.post<LoginResult>(apiPaths.auth.login, { email, password }, { credentials: 'include' }),
  /** A new access token. The answer is read like the login's (`accessToken`, maybe a new `refreshToken`). */
  refresh: (refreshToken: string | null) => http.post<Partial<LoginResult> | null>(apiPaths.auth.refresh, { refreshToken }, { credentials: 'include' }),
  /** Ends the backend session of this refresh token. */
  logout: (refreshToken: string | null) => http.post<void>(apiPaths.auth.logout, { refreshToken }, { credentials: 'include' }),
  getPortals: (token: string) => http.get<Portal[]>(apiPaths.auth.portals, { token }),
  /** Anonymous. 204 = activated (e-mail verified, password set, account Active). The token is single-use and expires. */
  activateInvitation: (token: string, newPassword: string) => http.post<void>(apiPaths.auth.activateInvitation, { token, newPassword }),
};

/** Passwords of activated accounts: at least this many characters (backend rule). */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Why an activation failed. Backend codes verified 2026-11-25 (400): `Authentication.InvalidToken` (unknown, used or
 * expired token — also for an empty one) and `Authentication.WeakPassword`. No answer / 5xx / anything else → `failed`.
 */
export type ActivationFailure = 'invalidToken' | 'weakPassword' | 'failed';

export function activationFailureOf(error: unknown): ActivationFailure {
  if (!(error instanceof HttpError) || error.status === 0 || error.status >= 500) return 'failed';
  const mentions = (pattern: RegExp) => pattern.test(error.code ?? '') || error.errors.some((e) => pattern.test(`${e.code} ${e.description}`));
  if (mentions(/password/i)) return 'weakPassword';
  if (mentions(/token|invitation/i) || error.status === 404 || error.status === 410) return 'invalidToken';
  return 'failed';
}

/** What the UI needs from the access token. Decoded only — the backend verifies it on every request. */
export interface AccessTokenClaims {
  /** Expiry, epoch seconds. */
  exp: number;
  roles: string[];
  /** e.g. `cms.blogs.publish`. */
  permissions: string[];
}

export function decodeAccessToken(token: string): AccessTokenClaims {
  const payload = token.split('.')[1] ?? '';
  const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const claims = JSON.parse(new TextDecoder().decode(bytes)) as { exp: number; role?: string | string[]; permission?: string | string[] };
  // A claim with one value is a string, with several an array.
  return { exp: claims.exp, roles: [claims.role ?? []].flat(), permissions: [claims.permission ?? []].flat() };
}
