import { createContext, use } from 'react';
import type { Localized } from '@datahub/shared-types';
import type { Permission, Role } from '@/core/config/permissions';

/*
 * Client-side session state, from the DataHub Workspace's sign-in (modules/auth, `/sso`): the user, role, permissions
 * and expiry come from the backend access token (JWT). Authorization stays server-side: the backend checks the token
 * on every request.
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
  /** The backend access token (JWT). */
  token: string;
  /** The token's permission claims this portal knows (plus interim fallbacks, see core/config/permissions.ts). */
  permissions: Permission[];
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
  /**
   * Ends this session and LEAVES the portal for `url` (the Workspace logout). The page keeps its state until the browser
   * unloads it: a local sign-out would render `/login`, whose own redirect to the Workspace would replace this one.
   */
  signOutTo: (url: string) => void;
}

/** sessionStorage: the session ends when the tab closes. Never contains passwords. */
export const SESSION_STORAGE_KEY = 'datahub-hr-admin.session';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
