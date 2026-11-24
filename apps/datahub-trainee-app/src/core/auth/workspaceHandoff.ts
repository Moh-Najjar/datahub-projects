import type { WorkspaceHandoffIssuer, WorkspaceHandoffPayload } from '@datahub/shared-types';

/*
 * DataHub Workspace handoff — parser for `/sso`.
 *
 * The Workspace (the central staff sign-in on the public website, verified by the backend) opens
 * `/sso#token=<token>`. The token is base64url-encoded JSON (`WorkspaceHandoffPayload`: issuer, email, ~2-minute
 * expiry of the link, and the backend ACCESS TOKEN). The user, roles, permissions and session expiry are read from that
 * JWT (`readAccessToken`) — decoded only: the backend verifies its signature on every request.
 * Tokens are never logged.
 */

export const WORKSPACE_HANDOFF_ISSUER: WorkspaceHandoffIssuer = 'datahub-workspace-prototype';

/** Tokens claiming a longer life than this are rejected (the Workspace issues ~2-minute tokens). */
const MAX_LIFETIME_MS = 5 * 60_000;

export type HandoffFailure = 'missing' | 'malformed' | 'expired' | 'no-access';

export class HandoffError extends Error {
  readonly reason: HandoffFailure;
  constructor(reason: HandoffFailure) {
    super(`Workspace handoff rejected: ${reason}`);
    this.name = 'HandoffError';
    this.reason = reason;
  }
}

export const isHandoffError = (error: unknown): error is HandoffError => error instanceof HandoffError;

/** The raw token from a location hash such as `#token=…`, or `null`. */
export function readHandoffToken(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token')?.trim() || null;
}

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new HandoffError('malformed');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Decodes and validates a handoff token. Throws `HandoffError` when it is missing, malformed or expired. */
export function parseHandoffToken(token: string | null, now: number = Date.now()): WorkspaceHandoffPayload {
  if (!token) throw new HandoffError('missing');
  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(token));
  } catch (error) {
    throw isHandoffError(error) ? error : new HandoffError('malformed');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HandoffError('malformed');
  const { issuer, email, expiresAt, accessToken } = payload as Partial<Record<keyof WorkspaceHandoffPayload, unknown>>;
  if (issuer !== WORKSPACE_HANDOFF_ISSUER || typeof email !== 'string' || !email.includes('@') || typeof expiresAt !== 'string' || typeof accessToken !== 'string' || !accessToken) {
    throw new HandoffError('malformed');
  }
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) throw new HandoffError('malformed');
  if (expires <= now || expires - now > MAX_LIFETIME_MS) throw new HandoffError('expired');
  return { issuer, email, expiresAt, accessToken };
}

/** What the app reads from the backend access token. */
export interface AccessTokenClaims {
  /** The user id (`sub`). */
  userId: string;
  email: string;
  displayName: string;
  /** `role` claim(s) — the Workspace (backend) roles, e.g. `system-admin`. */
  roles: string[];
  /** `permission` claims, e.g. `hr.leave.approve.team`. */
  permissions: string[];
  /** Epoch milliseconds. */
  expiresAt: number;
}

/** Decodes the access token's claims (not its signature — the backend verifies that). Throws when it is not a JWT or has expired. */
export function readAccessToken(token: string, now: number = Date.now()): AccessTokenClaims {
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(decodeBase64Url(token.split('.')[1] ?? '')) as Record<string, unknown>;
  } catch {
    throw new HandoffError('malformed');
  }
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || typeof claims.exp !== 'number') throw new HandoffError('malformed');
  if (claims.exp * 1000 <= now) throw new HandoffError('expired');
  // A claim with one value is a string, with several an array.
  const list = (value: unknown) => [value ?? []].flat().filter((v): v is string => typeof v === 'string');
  return {
    userId: claims.sub,
    email: claims.email,
    displayName: typeof claims.display_name === 'string' && claims.display_name ? claims.display_name : claims.email,
    roles: list(claims.role),
    permissions: list(claims.permission),
    expiresAt: claims.exp * 1000,
  };
}
