import type { WorkspaceHandoffPayload } from '@datahub/shared-types';

/** Encodes a payload like the DataHub Workspace does (base64url of UTF-8 JSON, no padding). */
export function encodeHandoff(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A valid prototype handoff token for `email`, expiring in `expiresInMs`. */
export function handoffToken(email: string, expiresInMs = 120_000): string {
  const payload: WorkspaceHandoffPayload = {
    issuer: 'datahub-workspace-prototype',
    email,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
  return encodeHandoff(payload);
}
