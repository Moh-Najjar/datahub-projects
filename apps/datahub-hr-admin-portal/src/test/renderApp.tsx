import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '@/core/api/queryClient';
import { ROLE_PERMISSIONS, type Role } from '@/core/config/permissions';
import { SESSION_STORAGE_KEY, type Session } from '@/core/context/authContext';
import { AuthProvider } from '@/core/context/AuthProvider';
import { routes } from '@/core/routes';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { DIRECTORY_SEED } from '@/modules/users/mock/seed';

/** The fictional directory account of a role (the simulated backend links it to an employee). */
export function demoAccount(role: Role) {
  return DIRECTORY_SEED.find((a) => a.role === role)!;
}

/** A stored session for the role's account with the role's reference permissions, as if its token said so. */
export function storeSessionFor(role: Role, expiresInMs = 3_600_000): Session {
  const session: Session = { user: demoAccount(role), token: 'test-token', permissions: [...ROLE_PERMISSIONS[role]], expiresAt: new Date(Date.now() + expiresInMs).toISOString() };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

/** Renders the real routes and providers at `path` (optionally already signed in as `as`). */
/** The app's QueryClient (same caching and retry policy) without the delay between retries. */
export function createTestQueryClient() {
  const client = createQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 0 } });
  return client;
}

export function renderApp(path = '/', options: { as?: Role } = {}) {
  if (options.as) storeSessionFor(options.as);
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppThemeProvider>
          <RouterProvider router={router} />
        </AppThemeProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, user: userEvent.setup() };
}
