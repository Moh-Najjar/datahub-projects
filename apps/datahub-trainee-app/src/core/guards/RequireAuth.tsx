import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { ROUTES } from '@/core/routes/paths';

/** Where RequireAuth stores the page a signed-out user tried to open. */
interface LoginState {
  from?: unknown;
}

/**
 * Sends signed-out users to /login (which forwards to the DataHub Workspace), remembering where they were going.
 * UI routing only — protected data must be protected by the backend.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search } satisfies LoginState} />;
  return children;
}

/**
 * For /login: once signed in, go to the page the user originally asked for, or to `fallback` (their landing page).
 * The single place that decides post-login navigation.
 */
export function RedirectIfAuthenticated({ fallback, children }: { fallback: string; children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const from = (useLocation().state as LoginState | null)?.from;
  if (!isAuthenticated) return children;
  const target = typeof from === 'string' && from.startsWith('/') && !from.startsWith(ROUTES.login) && !from.startsWith(ROUTES.sso) ? from : fallback;
  return <Navigate to={target} replace />;
}
