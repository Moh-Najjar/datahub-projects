import { mockRequest } from '@/core/api/mock/mockRequest';
import { listSimulationProfiles, type SimulationProfile } from '@/core/api/mock/identity';
import type { Session } from '@/core/auth/authContext';
import { canOpenTraineeApp } from '@/core/auth/workspaceAccess';
import { HandoffError, parseHandoffToken, readAccessToken } from '@/core/auth/workspaceHandoff';

/*
 * Auth API. This app has no sign-in form: users sign in once in the DataHub Workspace (the website, verified by the
 * backend), which hands them over to `/sso` with the backend access token. The session is read from that token:
 * user, Workspace roles, permissions and expiry. Passwords never exist here.
 */

export type { SimulationProfile };

export const authApi = {
  /**
   * Single sign-in from the DataHub Workspace (`/sso#token=…`). Throws `HandoffError` for a missing, malformed or
   * expired token, or for a Workspace user who may not open this app (`no-access`) — all shown with one message.
   */
  async exchangeHandoff(token: string | null): Promise<Session> {
    const { accessToken } = parseHandoffToken(token);
    const claims = readAccessToken(accessToken);
    if (!canOpenTraineeApp(claims)) throw new HandoffError('no-access');
    return {
      user: { id: claims.userId, email: claims.email, name: claims.displayName, workspaceRoles: claims.roles },
      token: accessToken,
      permissions: claims.permissions,
      expiresAt: new Date(claims.expiresAt).toISOString(),
    };
  },

  /** Mock only: the directory users a tester may "view as". */
  listSimulationProfiles(): Promise<SimulationProfile[]> {
    return mockRequest(() => listSimulationProfiles());
  },
};
