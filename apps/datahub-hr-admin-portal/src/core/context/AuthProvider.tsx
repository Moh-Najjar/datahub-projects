import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hasAnyPermission, hasPermission, isRole } from '@/core/config/permissions';
import { AuthContext, SESSION_STORAGE_KEY, type AuthContextValue, type Session } from './authContext';

function isSession(value: unknown): value is Session {
  const s = value as Session | null;
  return !!s && typeof s.token === 'string' && typeof s.expiresAt === 'string' && !!s.user && typeof s.user.id === 'string' && isRole(s.user.role);
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

/** Holds the session; `useAuth()` reads it. Must sit inside the QueryClientProvider (sign-out clears the cache). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(readStoredSession);

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

  // End the session when it expires.
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(signOut, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo<AuthContextValue>(() => {
    const role = session?.user.role;
    return {
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      can: (permission) => !!role && hasPermission(role, permission),
      canAny: (permissions) => !!role && hasAnyPermission(role, permissions),
      signIn,
      signOut,
    };
  }, [session, signIn, signOut]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
