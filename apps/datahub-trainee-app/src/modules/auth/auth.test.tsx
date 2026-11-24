import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceSessionStatus } from '@datahub/shared-types';
import { db } from '@/core/api/mock/mockDatabase';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { SESSION_STORAGE_KEY, type Session } from '@/core/auth/authContext';
import { recordWorkspaceEnded } from '@/core/auth/workspaceEnded';
import { renderApp, sessionFor } from '@/test/renderApp';
import { testAccessToken, testHandoffToken } from '@/test/handoffToken';

const WORKSPACE = 'http://localhost:3000';
const storedSession = () => JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as Session | null;

/** jsdom cannot leave the page: record cross-origin navigations instead. */
function stubLocation() {
  const assign = vi.fn();
  const replace = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign, replace });
  return { assign, replace };
}

/** A report from the Workspace's hidden session check page (the embedded iframe). */
function reportWorkspaceSession(session: WorkspaceSessionStatus['session'], origin = WORKSPACE) {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[title="DataHub Workspace session check"]');
  const data: WorkspaceSessionStatus = { type: 'datahub-workspace:session', session };
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source: frame?.contentWindow ?? null }));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('single sign-in from the DataHub Workspace (/sso)', () => {
  it('signs a Workspace user in with no sign-in form, strips the token from the URL and lands on their home page', async () => {
    const token = testHandoffToken({ claims: { email: 'omar.nasser@example.test', display_name: 'Omar Nasser', role: 'employee' } });
    const { router } = renderApp(`/sso#token=${token}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(router.state.location.hash).toBe('');
    expect(document.querySelector('input[type=password]')).toBeNull();
    expect(storedSession()?.user.email).toBe('omar.nasser@example.test');
    // The Workspace e-mail matched a directory user, so the training identity is that DepartmentAdmin.
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Account menu' }));
    expect((await screen.findAllByText('Department Admin')).length).toBeGreaterThan(0);
  });

  it('never stores a password and keeps the access token only in this tab\'s sessionStorage', async () => {
    const token = testHandoffToken({ claims: { email: 'omar.nasser@example.test' } });
    renderApp(`/sso#token=${token}`);
    await waitFor(() => expect(storedSession()).not.toBeNull());
    expect(JSON.stringify(Object.entries(localStorage))).not.toMatch(/token|password/i);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toMatch(/password/i);
  });

  it('a Workspace system-admin without a directory record becomes a SuperAdmin of the MOCK data only', async () => {
    const token = testHandoffToken({ claims: { email: 'new.admin@example.test', display_name: 'New Admin', role: 'system-admin' } });
    const { router } = renderApp(`/sso#token=${token}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(db().users.find((u) => u.email === 'new.admin@example.test')).toMatchObject({ role: 'SuperAdmin', fullName: 'New Admin' });
    // the Workspace session itself carries no training role: it stays exactly what the token said
    expect(storedSession()!.user.workspaceRoles).toEqual(['system-admin']);
    expect(storedSession()!.permissions).toEqual([]);
  });

  it('any other Workspace user becomes an Employee (a learner) — a business role never raises Workspace access', async () => {
    const token = testHandoffToken({ claims: { email: 'plain.staff@example.test', role: 'department-manager' } });
    const { router } = renderApp(`/sso#token=${token}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(db().users.find((u) => u.email === 'plain.staff@example.test')!.role).toBe('Employee');
    expect(storedSession()!.user.workspaceRoles).toEqual(['department-manager']);
  });

  it.each<[string, () => string]>([
    ['missing', () => ''],
    ['malformed', () => '#token=not-a-token'],
    ['expired link', () => `#token=${testHandoffToken({ now: Date.now() - 10 * 60_000 })}`],
    ['expired access token', () => `#token=${testHandoffToken({ claims: { exp: Math.floor(Date.now() / 1000) - 60 } })}`],
    ['wrong issuer', () => `#token=${testHandoffToken({ issuer: 'someone-else' })}`],
    ['no access to this app (no role, no training permission)', () => `#token=${testHandoffToken({ claims: { role: [], permission: 'hr.leave.view' } })}`],
  ])('a %s handoff shows an error and a way back to the Workspace — no form, no redirect loop', async (_, hash) => {
    const { replace } = stubLocation();
    const { router } = renderApp(`/sso${hash()}`);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Workspace sign-in didn't work/);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('link', { name: 'Continue to DataHub Workspace' }).getAttribute('href')).toBe(`${WORKSPACE}/workspace/open/trainee-app/`);
    expect(document.querySelector('input')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(storedSession()).toBeNull();
  });

  it('a failed handoff ends a previous session in the same tab', async () => {
    stubLocation();
    renderApp('/sso#token=garbage', { as: U.superAdmin });
    await screen.findByRole('alert');
    expect(storedSession()).toBeNull();
  });
});

describe('signed-out visitors and the central login', () => {
  it('a signed-out visit to any page is sent to /login and from there to the Workspace — there is no login page of its own', async () => {
    const { replace } = stubLocation();
    const { router } = renderApp('/trainings');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`${WORKSPACE}/workspace/open/trainee-app/`));
    expect(document.querySelector('input')).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByText(/username|e-mail address/i)).toBeNull();
  });

  it('goes to the Workspace in the user\'s language (Arabic pages are under /ar)', async () => {
    const { replace } = stubLocation();
    renderApp('/login', { locale: 'ar' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`${WORKSPACE}/ar/workspace/open/trainee-app/`));
  });

  it('stops redirecting automatically when the session check keeps ending sessions (loop guard)', async () => {
    const { replace } = stubLocation();
    recordWorkspaceEnded();
    recordWorkspaceEnded();
    renderApp('/login');
    expect((await screen.findByRole('alert')).textContent).toMatch(/keeps ending the session/);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Continue to DataHub Workspace' })).toBeTruthy();
  });

  it('a signed-in user opening /login goes straight to their home page', async () => {
    const { router } = renderApp('/login', { as: U.superAdmin });
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('protected routes', () => {
  it('redirects to /login and remembers where the user was going', async () => {
    stubLocation();
    const { router } = renderApp('/enrollments');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect((router.state.location.state as { from?: string }).from).toBe('/enrollments');
  });
});

describe('central sign-out', () => {
  it('Sign out ends this session and goes to the Workspace logout page', async () => {
    const { assign } = stubLocation();
    renderApp('/dashboard', { as: U.superAdmin });
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(assign).toHaveBeenCalledWith(`${WORKSPACE}/workspace/logout/`);
    expect(storedSession()).toBeNull();
  });
});

describe('Workspace session synchronisation', () => {
  const embedded = (userId: string) => ({ email: sessionFor(userId).user.email, expiresAt: new Date(Date.now() + 600_000).toISOString() });

  it('embeds the Workspace session check and ends the session when the Workspace session ends', async () => {
    stubLocation();
    const { router } = renderApp('/dashboard', { as: U.superAdmin });
    await screen.findByRole('button', { name: 'Account menu' });
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="DataHub Workspace session check"]');
    expect(frame?.getAttribute('src')).toBe(`${WORKSPACE}/workspace-session.html`);
    // The frame confirms this user, then the user signs out centrally (any tab): this session ends too.
    reportWorkspaceSession(embedded(U.superAdmin));
    reportWorkspaceSession(null);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(storedSession()).toBeNull();
  });

  it('does not end the session on "signed out" before the frame ever confirmed this user (cross-site storage)', async () => {
    renderApp('/dashboard', { as: U.superAdmin });
    await screen.findByRole('button', { name: 'Account menu' });
    reportWorkspaceSession(null);
    await new Promise((r) => setTimeout(r, 50));
    expect(storedSession()).not.toBeNull();
  });

  it('ends the session when another account signs in centrally', async () => {
    stubLocation();
    const { router } = renderApp('/dashboard', { as: U.superAdmin });
    await screen.findByRole('button', { name: 'Account menu' });
    reportWorkspaceSession(embedded(U.noor));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('ignores reports from any other origin', async () => {
    renderApp('/dashboard', { as: U.superAdmin });
    await screen.findByRole('button', { name: 'Account menu' });
    reportWorkspaceSession(embedded(U.superAdmin));
    reportWorkspaceSession(null, 'https://evil.example');
    await new Promise((r) => setTimeout(r, 50));
    expect(storedSession()).not.toBeNull();
  });

  it('ends the session when the access token expires', async () => {
    stubLocation();
    const session = sessionFor(U.superAdmin);
    session.expiresAt = new Date(Date.now() + 250).toISOString();
    session.token = testAccessToken({ email: session.user.email });
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    const { router } = renderApp('/dashboard');
    await screen.findByRole('button', { name: 'Account menu' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 4000 });
    expect(storedSession()).toBeNull();
  });

  it('discards an already expired stored session on load', async () => {
    stubLocation();
    const session = sessionFor(U.superAdmin);
    session.expiresAt = new Date(Date.now() - 1000).toISOString();
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    const { router } = renderApp('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('discards a stored session of the wrong shape', async () => {
    stubLocation();
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 'x', user: { id: 1 } }));
    const { router } = renderApp('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
