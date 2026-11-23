import type { WorkspaceHandoffPayload } from '@datahub/shared-types';
import { ROLE_PERMISSIONS, isRole } from '@/core/config/permissions';
import { DIRECTORY_SEED } from '@/modules/users/mock/seed';

const base64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Encodes a payload like the DataHub Workspace does (base64url of UTF-8 JSON, no padding). */
export const encodeHandoff = (payload: object): string => base64Url(JSON.stringify(payload));

/** An unsigned JWT with the backend's claim names (the portal only decodes it; the backend verifies signatures). */
export function accessToken(claims: { sub?: string; email: string; display_name?: string; role?: string | string[]; permission?: string | string[]; exp?: number }): string {
  return `${base64Url('{"alg":"none"}')}.${base64Url(JSON.stringify({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 900, ...claims }))}.sig`;
}

/**
 * A valid handoff token for `email`, expiring in `expiresInMs`. The access token carries the role and permissions of the
 * fictional directory account with that email (none for an unknown email), unless `claims` override them.
 */
export function handoffToken(email: string, expiresInMs = 120_000, claims: { role?: string | string[]; permission?: string[]; exp?: number } = {}): string {
  const account = DIRECTORY_SEED.find((a) => a.email === email);
  const role = claims.role ?? account?.role ?? [];
  const permission = claims.permission ?? (typeof role === 'string' && isRole(role) ? [...ROLE_PERMISSIONS[role]] : []);
  const payload: WorkspaceHandoffPayload = {
    issuer: 'datahub-workspace-prototype',
    email,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    accessToken: accessToken({ sub: account?.id ?? 'user-x', email, display_name: account?.name.en, role, permission, ...(claims.exp ? { exp: claims.exp } : {}) }),
  };
  return encodeHandoff(payload);
}
