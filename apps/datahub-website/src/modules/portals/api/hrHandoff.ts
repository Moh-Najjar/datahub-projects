import type { WorkspaceHandoffIssuer, WorkspaceHandoffPayload } from '@datahub/shared-types';
import type { WorkspaceSession } from './workspaceAuth';

/*
 * Workspace → HR Admin portal sign-in. The portal runs on another origin and cannot read this site's session, so the HR
 * Admin card opens `<portal>/sso#token=<token>`: base64url JSON (`WorkspaceHandoffPayload` from @datahub/shared-types)
 * with the account email, a ~2-minute expiry of the link and the backend ACCESS TOKEN — the portal reads the user,
 * role and permissions from it. It travels in the URL HASH (never sent to servers) and the portal strips it at once.
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
    accessToken: session.accessToken,
  };
  return base64Url(JSON.stringify(payload));
}

/** A fresh sign-in URL — create it at the moment of navigation (the token lives ~2 minutes). */
export const hrSignInUrl = (portalUrl: string, session: WorkspaceSession): string => `${portalUrl}/sso#token=${createHandoffToken(session)}`;
