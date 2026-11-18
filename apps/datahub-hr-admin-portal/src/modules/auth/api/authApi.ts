import { mockRequest } from '@/core/api/mock/mockRequest';
import type { Session } from '@/core/context/authContext';
import { HandoffError, parseHandoffToken } from '@/modules/auth/handoff/workspaceHandoff';
import { DEMO_ACCOUNTS } from '@/modules/auth/mock/demoAccounts';

/*
 * Auth API — MOCK implementation. This portal has no sign-in form: users sign in once in the DataHub Workspace (the
 * website), which hands them over to `/sso` with a short-lived token. Nothing is authenticated here; the real backend
 * will verify a signed token (or its own SSO session) and issue the session — only this function body changes.
 */

const SESSION_HOURS = 8;

export const authApi = {
  /**
   * Single sign-in from the DataHub Workspace (`/sso#token=…`). MOCK: decodes the unsigned prototype token
   * (`handoff/workspaceHandoff.ts`) and signs in as the demo account with that email — the same account the user
   * chose in the Workspace. Throws `HandoffError` for a missing, malformed or expired token or an account this portal
   * does not have (e.g. the Workspace's Blogs Administrator).
   */
  exchangeHandoff(token: string | null, signal?: AbortSignal): Promise<Session> {
    return mockRequest(
      () => {
        const { email } = parseHandoffToken(token);
        const user = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase());
        if (!user) throw new HandoffError('unknown-account');
        return {
          user,
          token: `mock-${crypto.randomUUID()}`,
          expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString(),
        };
      },
      { signal },
    );
  },
};
