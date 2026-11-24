import { createContext, use } from 'react';
import type { TrainingActor, TrainingPermission } from './trainingPolicy';

/*
 * Client-side session state, from the DataHub Workspace's sign-in (`/sso`): the user, roles, permissions and expiry
 * come from the backend access token (JWT). Authorization stays server-side: the backend checks the token on every
 * request. Two separate things live here:
 *  - `session` / `user` — WHO the Workspace says is signed in (the only thing that can grant app access);
 *  - `actor` — the TRAINING business identity (a directory user and role), used by the mock authorization policy.
 */

export interface SessionUser {
  /** The token's `sub`. */
  id: string;
  email: string;
  name: string;
  /** Backend (Workspace) roles, e.g. `system-admin`. */
  workspaceRoles: string[];
}

export interface Session {
  user: SessionUser;
  /** The backend access token (JWT). Lives in this tab's sessionStorage only; never logged. */
  token: string;
  /** The token's `permission` claims. */
  permissions: string[];
  /** ISO date-time after which the session is discarded. */
  expiresAt: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** The training business identity (null when signed out). */
  actor: TrainingActor | null;
  /** UI-only business permission check — the backend must enforce the same rule. */
  can: (permission: TrainingPermission) => boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  /** Ends this session and LEAVES the app for `url` (the Workspace logout). */
  signOutTo: (url: string) => void;
  /** Mock-only "view as": act as another directory user. Never changes the Workspace session. */
  simulation: {
    enabled: boolean;
    /** The directory user being simulated, or null when acting as oneself. */
    simulatedUserId: string | null;
    setSimulatedUser: (userId: string | null) => void;
  };
}

/** sessionStorage: the session ends when the tab closes. Never contains passwords. */
export const SESSION_STORAGE_KEY = 'datahub-trainee.session';
export const SIMULATION_STORAGE_KEY = 'datahub-trainee.simulated-user';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
