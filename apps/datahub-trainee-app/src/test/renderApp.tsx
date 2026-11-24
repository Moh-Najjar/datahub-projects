import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { db } from '@/core/api/mock/mockDatabase';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { SESSION_STORAGE_KEY, type Session } from '@/core/auth/authContext';
import { routes } from '@/core/routes';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import type { Locale } from '@/i18n/languages';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { FeedbackProvider } from '@/modules/shared/FeedbackProvider';
import { testAccessToken } from './handoffToken';

interface RenderOptions {
  /** Sign in as this user of the simulated training directory (by id, e.g. `SEED_USERS.superAdmin`); omit for signed out. */
  as?: string;
  locale?: Locale;
}

/** A Workspace session whose e-mail matches a directory user, so the mock identity mapping resolves to that user. */
export function sessionFor(userId: string): Session {
  const user = db().users.find((u) => u.id === userId);
  if (!user) throw new Error(`No such seeded user: ${userId}`);
  return {
    user: { id: `ws-${user.id}`, email: user.email, name: user.fullName, workspaceRoles: ['employee'] },
    token: testAccessToken({ email: user.email }),
    permissions: [],
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

export function signInAs(userId: string): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionFor(userId)));
}

/** Renders the real app (providers + routes) at `path`, optionally signed in as a directory user. */
export function renderApp(path: string, options: RenderOptions = {}): RenderResult & { router: ReturnType<typeof createMemoryRouter>; queryClient: QueryClient } {
  if (options.as) signInAs(options.as);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={options.locale ?? 'en'}>
        <AppThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </FeedbackProvider>
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
