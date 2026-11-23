import { isRole, permissionsFromToken } from '@/core/config/permissions';
import type { Session } from '@/core/context/authContext';
import { HandoffError, parseHandoffToken, readAccessToken } from '@/modules/auth/handoff/workspaceHandoff';

/*
 * Auth API. This portal has no sign-in form: users sign in once in the DataHub Workspace (the website, verified by the
 * backend), which hands them over to `/sso` with the backend access token. The session is read from that token: user,
 * role (the first role this portal knows), permissions (backend names, plus the interim fallbacks of
 * core/config/permissions.ts) and expiry. Every future HR API request will carry the same token.
 */

export const authApi = {
  /**
   * Single sign-in from the DataHub Workspace (`/sso#token=…`). Throws `HandoffError` for a missing, malformed or
   * expired token, or a user without an HR role this portal knows (`unknown-account`) — all shown with one message.
   */
  async exchangeHandoff(token: string | null): Promise<Session> {
    const { accessToken } = parseHandoffToken(token);
    const claims = readAccessToken(accessToken);
    const role = claims.roles.find(isRole);
    if (!role) throw new HandoffError('unknown-account');
    return {
      user: { id: claims.userId, email: claims.email, name: { en: claims.displayName, ar: claims.displayName }, role },
      token: accessToken,
      permissions: permissionsFromToken(claims.permissions),
      expiresAt: new Date(claims.expiresAt).toISOString(),
    };
  },
};
