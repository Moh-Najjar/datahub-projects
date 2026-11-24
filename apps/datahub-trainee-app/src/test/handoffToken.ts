import type { WorkspaceHandoffPayload } from '@datahub/shared-types';
import { WORKSPACE_HANDOFF_ISSUER } from '@/core/auth/workspaceHandoff';

/** Test helpers: Workspace handoff tokens with UNSIGNED test JWTs (the app only decodes them; the backend verifies). */

function base64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface TestClaims {
  sub?: string;
  email?: string;
  display_name?: string;
  role?: string | string[];
  permission?: string | string[];
  /** Seconds since the epoch. */
  exp?: number;
}

/** A JWT-shaped string whose payload carries the claims (header and signature are placeholders). */
export function testAccessToken(claims: TestClaims = {}, now: number = Date.now()): string {
  const payload = { sub: 'ws-user-1', email: 'workspace.user@example.test', display_name: 'Workspace User', role: 'employee', exp: Math.floor(now / 1000) + 15 * 60, ...claims };
  return `${base64Url('{"alg":"none"}')}.${base64Url(JSON.stringify(payload))}.signature`;
}

/** The URL-hash token the Workspace sends to `/sso#token=…`. */
export function testHandoffToken(options: { claims?: TestClaims; accessToken?: string; issuer?: string; email?: string; lifetimeMs?: number; now?: number } = {}): string {
  const now = options.now ?? Date.now();
  const accessToken = options.accessToken ?? testAccessToken(options.claims, now);
  const payload: WorkspaceHandoffPayload = {
    issuer: (options.issuer ?? WORKSPACE_HANDOFF_ISSUER) as WorkspaceHandoffPayload['issuer'],
    email: options.email ?? options.claims?.email ?? 'workspace.user@example.test',
    expiresAt: new Date(now + (options.lifetimeMs ?? 2 * 60_000)).toISOString(),
    accessToken,
  };
  return base64Url(JSON.stringify(payload));
}
