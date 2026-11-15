import { mockRequest } from '@/core/api/mock/mockRequest';
import { ApiError } from '@/core/api/types';
import type { Session, SessionUser } from '@/core/context/authContext';
import { DEMO_ACCOUNTS } from '@/modules/auth/mock/demoAccounts';

/*
 * Auth API — MOCK implementation. It does not authenticate anyone: `login` selects a demo account by
 * email and returns a placeholder session. The password is accepted, never stored, logged or compared.
 * The real backend will verify credentials and issue the token; only these function bodies change.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

const SESSION_HOURS = 8;

export const authApi = {
  login({ email }: LoginRequest, signal?: AbortSignal): Promise<Session> {
    return mockRequest(
      () => {
        const user = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
        if (!user) throw new ApiError('UNAUTHORIZED', 'Unknown demo account');
        return {
          user,
          token: `mock-${crypto.randomUUID()}`,
          expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString(),
        };
      },
      { signal },
    );
  },

  /** The demo accounts offered on the sign-in page (mock only — a real backend has no such list). */
  listDemoAccounts(signal?: AbortSignal): Promise<SessionUser[]> {
    return mockRequest(() => [...DEMO_ACCOUNTS], { signal });
  },
};
