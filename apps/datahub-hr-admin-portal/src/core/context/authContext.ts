import { createContext, use } from 'react';
import type { Localized } from '@datahub/shared-types';
import type { Permission, Role } from '@/core/config/permissions';

/*
 * Client-side session state. The session comes from the DataHub Workspace's MOCK single sign-in (modules/auth, `/sso`)
 * and the token is a random placeholder, not a credential. When the real backend exists, `signIn` will receive
 * its session and every request will carry the backend-issued token — authorization stays server-side.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: Localized<string>;
  role: Role;
  department?: Localized<string>;
}

export interface Session {
  user: SessionUser;
  /** Opaque token from the auth API (mock: a random placeholder). */
  token: string;
  /** ISO date-time after which the session is discarded. */
  expiresAt: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** UI-only check — the backend must enforce the same rule. */
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
}

/** sessionStorage: the session ends when the tab closes. Never contains passwords. */
export const SESSION_STORAGE_KEY = 'datahub-hr-admin.session';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
