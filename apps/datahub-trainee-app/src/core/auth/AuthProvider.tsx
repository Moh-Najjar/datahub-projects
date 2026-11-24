import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { configureHttpAuth } from '@/core/api/http';
import { actorForUser, resolveMockIdentity } from '@/core/api/mock/identity';
import { usesMockData } from '@/core/config/api';
import { actorFromSession, trainingPermissionsFromToken } from './apiIdentity';
import { AuthContext, SESSION_STORAGE_KEY, SIMULATION_STORAGE_KEY, type AuthContextValue, type Session } from './authContext';
import { setCurrentActor } from './actor';
import { actorCan, type TrainingActor } from './trainingPolicy';
import { recordWorkspaceEnded } from './workspaceEnded';
import { WorkspaceSessionCheck } from './WorkspaceSessionCheck';

function isSession(value: unknown): value is Session {
  const s = value as Session | null;
  return !!s && typeof s.token === 'string' && typeof s.expiresAt === 'string' && Array.isArray(s.permissions) && !!s.user && typeof s.user.id === 'string' && typeof s.user.email === 'string' && Array.isArray(s.user.workspaceRoles);
}

/** The stored session, if present, well-formed and not expired. */
function readStoredSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isSession(parsed) || Date.parse(parsed.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage unavailable: the session simply lasts until reload.
  }
}

function readSimulatedUser(): string | null {
  try {
    return sessionStorage.getItem(SIMULATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function identityFor(session: Session | null): string | null {
  if (!usesMockData) return null;
  return session ? resolveMockIdentity({ email: session.user.email, name: session.user.name, roles: session.user.workspaceRoles }) : null;
}

/** "View as" exists only with the simulated backend (it switches the mock directory user, never the session). */
const SIMULATION_ENABLED = usesMockData;

/**
 * The HTTP client reads the access token straight from storage (so the first queries already have it) and ends the
 * session on a 401 through the provider's current sign-out.
 */
let endSession: () => void = () => undefined;
configureHttpAuth({ getAccessToken: () => readStoredSession()?.token ?? null, onUnauthorized: () => endSession() });

/** Holds the session; `useAuth()` reads it. Must sit inside the QueryClientProvider (sign-out clears the cache). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(readStoredSession);
  // The training directory user behind the Workspace user (mock identity mapping), resolved once per session.
  const [identityUserId, setIdentityUserId] = useState<string | null>(() => identityFor(session));
  const [simulatedUserId, setSimulatedUserId] = useState<string | null>(() => (SIMULATION_ENABLED ? readSimulatedUser() : null));

  const actor = useMemo<TrainingActor | null>(() => {
    if (!usesMockData) return session ? actorFromSession(session) : null;
    const simulated = session && simulatedUserId ? actorForUser(simulatedUserId) : null;
    const resolved = simulated ?? (session && identityUserId ? actorForUser(identityUserId) : null);
    // The simulated backend reads the caller from here (a real backend reads the token). Set before children query.
    setCurrentActor(resolved);
    return resolved;
  }, [session, identityUserId, simulatedUserId]);

  const signIn = useCallback((next: Session) => {
    writeStoredSession(next);
    setIdentityUserId(identityFor(next));
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    writeStoredSession(null);
    try {
      sessionStorage.removeItem(SIMULATION_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
    setSimulatedUserId(null);
    setIdentityUserId(null);
    setSession(null);
    // Never leave one user's cached data visible to the next.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    endSession = signOut;
  }, [signOut]);

  const signOutTo = useCallback((url: string) => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SIMULATION_STORAGE_KEY);
    } catch {
      // Storage unavailable: nothing stored.
    }
    window.location.assign(url);
  }, []);

  const setSimulatedUser = useCallback((userId: string | null) => {
    if (!SIMULATION_ENABLED) return;
    try {
      if (userId) sessionStorage.setItem(SIMULATION_STORAGE_KEY, userId);
      else sessionStorage.removeItem(SIMULATION_STORAGE_KEY);
    } catch {
      // Storage unavailable: lasts until reload.
    }
    setSimulatedUserId(userId);
  }, []);

  // Back to a page restored from the back/forward cache after leaving with `signOutTo`: end the session shown there.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !readStoredSession()) signOut();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [signOut]);

  // End the session when the token expires.
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(signOut, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [session, signOut]);

  // The central Workspace session ended or changed (e.g. Sign out in another tab): end this one too. RequireAuth then
  // sends the user back through the Workspace sign-in.
  const onWorkspaceEnded = useCallback(() => {
    recordWorkspaceEnded();
    signOut();
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      actor,
      // Real backend: the token's permissions; simulated backend: the mock directory role's.
      can: (permission) => (usesMockData ? actorCan(actor, permission) : !!session && trainingPermissionsFromToken(session.permissions).includes(permission)),
      signIn,
      signOut,
      signOutTo,
      simulation: { enabled: SIMULATION_ENABLED, simulatedUserId, setSimulatedUser },
    }),
    [session, actor, signIn, signOut, signOutTo, simulatedUserId, setSimulatedUser],
  );

  return (
    <AuthContext value={value}>
      {children}
      {session && <WorkspaceSessionCheck email={session.user.email} onEnded={onWorkspaceEnded} />}
    </AuthContext>
  );
}
