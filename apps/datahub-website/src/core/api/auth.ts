import { apiPaths } from '@/core/api/paths';
import { http } from '@/core/helpers/http';

/*
 * Layer 2 — Authentication API functions. The access token is a JWT (~15 min). The refresh / logout endpoints answer
 * 403 for now, so they are not used.
 */

export interface LoginResult {
  accessToken: string;
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
  login: (email: string, password: string) => http.post<LoginResult>(apiPaths.auth.login, { email, password }),
  getPortals: (token: string) => http.get<Portal[]>(apiPaths.auth.portals, { token }),
};

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
