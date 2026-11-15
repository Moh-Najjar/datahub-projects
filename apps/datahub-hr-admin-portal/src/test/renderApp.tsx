import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '@/core/api/queryClient';
import type { Role } from '@/core/config/permissions';
import { SESSION_STORAGE_KEY, type Session } from '@/core/context/authContext';
import { AuthProvider } from '@/core/context/AuthProvider';
import { routes } from '@/core/routes';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { DEMO_ACCOUNTS } from '@/modules/auth/mock/demoAccounts';

export function demoAccount(role: Role) {
  return DEMO_ACCOUNTS.find((a) => a.role === role)!;
}

/** A stored (mock) session for the role's demo account, as if they had signed in. */
export function storeSessionFor(role: Role, expiresInMs = 3_600_000): Session {
  const session: Session = { user: demoAccount(role), token: 'mock-test-token', expiresAt: new Date(Date.now() + expiresInMs).toISOString() };
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
