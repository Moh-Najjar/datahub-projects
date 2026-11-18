import type { WorkspaceHandoffIssuer, WorkspaceHandoffPayload } from '@datahub/shared-types';

/*
 * DataHub Workspace handoff — PROTOTYPE parser for `/sso`.
 *
 * The Workspace (the central staff sign-in on the public website) opens `/sso#token=<token>`. The token is base64url-
 * encoded JSON (`WorkspaceHandoffPayload`: issuer, email, ~2-minute expiry). It is NOT signed, so it can only select
 * one of the fictional demo accounts.
 *
 * Replacing it with a backend token: `authApi.exchangeHandoff` sends the raw token to the backend, which verifies it
 * and returns the session. Only this parser and that function change — not `/sso`, `RequireAuth` or the Workspace.
 */

export const WORKSPACE_HANDOFF_ISSUER: WorkspaceHandoffIssuer = 'datahub-workspace-prototype';

/** Tokens claiming a longer life than this are rejected (the Workspace issues ~2-minute tokens). */
const MAX_LIFETIME_MS = 5 * 60_000;

export type HandoffFailure = 'missing' | 'malformed' | 'expired' | 'unknown-account';

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
  const { issuer, email, expiresAt } = payload as Partial<Record<keyof WorkspaceHandoffPayload, unknown>>;
  if (issuer !== WORKSPACE_HANDOFF_ISSUER || typeof email !== 'string' || !email.includes('@') || typeof expiresAt !== 'string') {
    throw new HandoffError('malformed');
  }
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) throw new HandoffError('malformed');
  if (expires <= now || expires - now > MAX_LIFETIME_MS) throw new HandoffError('expired');
  return { issuer, email, expiresAt };
}
