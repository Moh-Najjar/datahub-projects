import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceSessionStatus } from '@datahub/shared-types';
import { ROLES } from '@/core/config/permissions';
import { SESSION_STORAGE_KEY, type Session } from '@/core/context/authContext';
import { recordWorkspaceEnded } from '@/core/context/workspaceEnded';
import { demoAccount, renderApp } from '@/test/renderApp';
import { encodeHandoff, handoffToken } from '@/test/handoffToken';

const WORKSPACE = 'http://localhost:3000';
const storedSession = () => JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as Session | null;
const expectedLanding = (role: (typeof ROLES)[number]) => (role === 'employee' ? '/profile' : '/dashboard');

/** jsdom cannot leave the page: record cross-origin navigations instead. */
function stubLocation() {
  const assign = vi.fn();
  const replace = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign, replace });
  return { assign, replace };
}

/** A report from the Workspace's hidden session check page (the embedded iframe). */
function reportWorkspaceSession(session: WorkspaceSessionStatus['session']) {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[title="DataHub Portals session check"]');
  const data: WorkspaceSessionStatus = { type: 'datahub-workspace:session', session };
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin: WORKSPACE, source: frame?.contentWindow ?? null }));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('single sign-in from the DataHub Workspace (/sso)', () => {
  it.each(ROLES)('signs the %s demo account in without any sign-in form', async (role) => {
    const { router } = renderApp(`/sso#token=${handoffToken(demoAccount(role).email)}`);
    await waitFor(() => expect(router.state.location.pathname).toBe(expectedLanding(role)));
    expect(storedSession()?.user.email).toBe(demoAccount(role).email);
    // The token never stays in the URL and no password field was ever shown.
    expect(router.state.location.hash).toBe('');
    expect(document.querySelector('input[type=password]')).toBeNull();
    expect(await screen.findByRole('button', { name: `Account menu for ${demoAccount(role).name.en}` })).toBeTruthy();
  });

  it.each<[string, string]>([
    ['missing', '/sso'],
    ['malformed', '/sso#token=not-a-token'],
    ['expired', `/sso#token=${handoffToken(demoAccount('employee').email, -1000)}`],
    ['unknown account (Blogs Administrator)', `/sso#token=${handoffToken('blogs.admin@demo.datahub.test')}`],
    ['wrong issuer', `/sso#token=${encodeHandoff({ issuer: 'x', email: demoAccount('employee').email, expiresAt: new Date(Date.now() + 60_000).toISOString() })}`],
  ])('a %s token shows an error and a way back to the Workspace — no form, no redirect loop', async (_, path) => {
    const { replace } = stubLocation();
    const { router } = renderApp(path);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Portals sign-in could not be completed/);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('link', { name: 'Continue to DataHub Portals' }).getAttribute('href')).toBe(`${WORKSPACE}/workspace/open/hr-admin/`);
    expect(document.querySelector('input')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(storedSession()).toBeNull();
  });

  it('a valid handoff replaces a previous session in this tab', async () => {
    const { router } = renderApp(`/sso#token=${handoffToken(demoAccount('employee').email)}`, { as: 'hr-admin' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(storedSession()?.user.email).toBe(demoAccount('employee').email);
  });
});

describe('no sign-in of its own: the Workspace is the only sign-in', () => {
  it('signed-out visitors are sent to the Workspace (which signs them in and brings them back)', async () => {
    const { replace } = stubLocation();
    const { router } = renderApp('/leave');
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`${WORKSPACE}/workspace/open/hr-admin/`));
    expect(router.state.location.pathname).toBe('/login');
    expect(document.querySelector('input')).toBeNull();
    expect(screen.queryByText(/Demo accounts/)).toBeNull();
  });

  it('Sign out ends the central session in the Workspace (→ Workspace sign-in)', async () => {
    const { user } = renderApp('/dashboard', { as: 'hr-admin' });
    const { assign } = stubLocation();
    await user.click(await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-admin').name.en}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(assign).toHaveBeenCalledWith(`${WORKSPACE}/workspace/logout/`);
    expect(storedSession()).toBeNull();
  });
});

describe('Workspace session check (signed out elsewhere, other user)', () => {
  it('embeds the hidden session check only while signed in', async () => {
    renderApp('/dashboard', { as: 'hr-manager' });
    await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-manager').name.en}` });
    expect(document.querySelector('iframe[title="DataHub Portals session check"]')?.getAttribute('src')).toBe(`${WORKSPACE}/workspace-session.html`);
  });

  it('keeps the session while the Workspace reports the same user', async () => {
    const { router } = renderApp('/dashboard', { as: 'hr-manager' });
    await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-manager').name.en}` });
    reportWorkspaceSession({ email: demoAccount('hr-manager').email.toUpperCase(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(storedSession()).not.toBeNull();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it.each([
    ['signed out in the Workspace', null],
    ['another user signed in to the Workspace', { email: 'employee@demo.datahubhr.test', expiresAt: new Date(Date.now() + 60_000).toISOString() }],
  ])('ends this session when %s, and goes back through the Workspace', async (_, central) => {
    const { replace } = stubLocation();
    const { router } = renderApp('/dashboard', { as: 'hr-manager' });
    await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-manager').name.en}` });
    reportWorkspaceSession(central);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(storedSession()).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`${WORKSPACE}/workspace/open/hr-admin/`));
  });

  it('ignores reports from any other origin', async () => {
    renderApp('/dashboard', { as: 'hr-manager' });
    await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-manager').name.en}` });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'datahub-workspace:session', session: null }, origin: 'https://evil.example' }));
    });
    expect(storedSession()).not.toBeNull();
  });

  it('loop guard: after repeated session-check sign-outs the sign-in page stops redirecting', async () => {
    recordWorkspaceEnded();
    recordWorkspaceEnded();
    const { replace } = stubLocation();
    renderApp('/login');
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be confirmed/);
    expect(replace).not.toHaveBeenCalled();
  });
});
