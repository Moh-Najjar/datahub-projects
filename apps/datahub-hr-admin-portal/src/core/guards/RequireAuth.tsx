import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';

/** Where RequireAuth stores the page a signed-out user tried to open. */
interface LoginState {
  from?: unknown;
}

/**
 * Sends signed-out users to /login, remembering where they were going.
 * UI routing only — protected data must be protected by the backend.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search } satisfies LoginState} />;
  return children;
}

/**
 * For /login: once signed in (including right after a successful sign-in), go to the page the user
 * originally asked for, or to `fallback` (their landing page). The single place that decides post-login navigation.
 */
export function RedirectIfAuthenticated({ fallback, children }: { fallback: string; children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const from = (useLocation().state as LoginState | null)?.from;
  if (!isAuthenticated) return children;
  const target = typeof from === 'string' && from.startsWith('/') && !from.startsWith('/login') ? from : fallback;
  return <Navigate to={target} replace />;
}
