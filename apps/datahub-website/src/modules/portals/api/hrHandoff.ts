import type { WorkspaceHandoffIssuer, WorkspaceHandoffPayload } from '@datahub/shared-types';
import type { WorkspaceSession } from './workspaceAuth';

/*
 * Workspace → HR Admin portal single sign-in — PROTOTYPE token builder.
 *
 * The HR portal runs on another origin and cannot read this site's session, so the HR Admin card opens
 * `<portal>/sso#token=<token>`: base64url-encoded JSON (`WorkspaceHandoffPayload` from @datahub/shared-types) with the
 * account's username (email), a ~2-minute expiry and a fixed issuer — no password, no permissions. It travels in the
 * URL HASH, which browsers never send to servers (no server or proxy logs), never in the query string, and the portal
 * strips it from the address bar at once. The portal then follows the central session through `sessionBridge.ts`.
 *
 * The token is NOT signed and proves nothing: a backend-issued, signed token replaces `createHandoffToken` (and the
 * portal's parser); the launcher (`WorkspaceOpenPage`) calls only `hrSignInUrl`.
 */

export const WORKSPACE_HANDOFF_ISSUER: WorkspaceHandoffIssuer = 'datahub-workspace-prototype';
const LIFETIME_MS = 2 * 60_000;

function base64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createHandoffToken(session: WorkspaceSession, now: number = Date.now()): string {
  const payload: WorkspaceHandoffPayload = {
    issuer: WORKSPACE_HANDOFF_ISSUER,
    email: session.username,
    expiresAt: new Date(now + LIFETIME_MS).toISOString(),
  };
  return base64Url(JSON.stringify(payload));
}

/** A fresh sign-in URL — create it at the moment of navigation (the token lives ~2 minutes). */
export const hrSignInUrl = (portalUrl: string, session: WorkspaceSession): string => `${portalUrl}/sso#token=${createHandoffToken(session)}`;
