import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hasAnyPermission, hasPermission, isRole, permissionsVersion, setSignedInPermissions, subscribePermissions } from '@/core/config/permissions';
import { AuthContext, SESSION_STORAGE_KEY, type AuthContextValue, type Session } from './authContext';
import { recordWorkspaceEnded } from './workspaceEnded';
import { WorkspaceSessionCheck } from './WorkspaceSessionCheck';

function isSession(value: unknown): value is Session {
  const s = value as Session | null;
  return !!s && typeof s.token === 'string' && typeof s.expiresAt === 'string' && Array.isArray(s.permissions) && !!s.user && typeof s.user.id === 'string' && isRole(s.user.role);
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
  // Every permission check (UI and simulated backend) follows the signed-in user's token.
  setSignedInPermissions(session?.user.role ?? null, session?.permissions);
  try {
    if (session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage unavailable: the session simply lasts until reload.
  }
}

/** Holds the session; `useAuth()` reads it. Must sit inside the QueryClientProvider (sign-out clears the cache). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(() => {
    const stored = readStoredSession();
    setSignedInPermissions(stored?.user.role ?? null, stored?.permissions);
    return stored;
  });

  const signIn = useCallback((next: Session) => {
    writeStoredSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    writeStoredSession(null);
    setSession(null);
    // Never leave one user's cached data visible to the next.
    queryClient.clear();
  }, [queryClient]);

  const signOutTo = useCallback((url: string) => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage unavailable: nothing stored.
    }
    window.location.assign(url);
  }, []);

  // Back to a page restored from the back/forward cache after leaving with `signOutTo`: end the session shown there.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !readStoredSession()) signOut();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [signOut]);

  // End the session when it expires.
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(signOut, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [session, signOut]);

  // Re-evaluate `can()` whenever the signed-in permissions change.
  const permissionVersion = useSyncExternalStore(subscribePermissions, permissionsVersion, permissionsVersion);

  const value = useMemo<AuthContextValue>(() => {
    const role = session?.user.role;
    // A new value whenever the permissions change, so every consumer re-renders with the permissions in force.
    const version = permissionVersion;
    return {
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      can: (permission) => version >= 0 && !!role && hasPermission(role, permission),
      canAny: (permissions) => !!role && hasAnyPermission(role, permissions),
      signIn,
      signOut,
      signOutTo,
    };
  }, [session, signIn, signOut, signOutTo, permissionVersion]);

  // The central Workspace session ended or changed (e.g. Sign out in another tab): end this one too. RequireAuth then
  // sends the user back through the Workspace sign-in.
  const onWorkspaceEnded = useCallback(() => {
    recordWorkspaceEnded();
    signOut();
  }, [signOut]);

  return (
    <AuthContext value={value}>
      {children}
      {session && <WorkspaceSessionCheck email={session.user.email} onEnded={onWorkspaceEnded} />}
    </AuthContext>
  );
}
