import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ROLES } from '@/core/config/permissions';
import { SESSION_STORAGE_KEY } from '@/core/context/authContext';
import i18n from '@/i18n';
import { demoAccount, renderApp, storeSessionFor } from '@/test/renderApp';

const roleLabel = (role: (typeof ROLES)[number]) => i18n.t(`roles.${role}`);
const expectedLanding = (role: (typeof ROLES)[number]) => (role === 'employee' ? '/profile' : '/dashboard');

describe('demo sign-in', () => {
  it('shows the demo-mode warning on the sign-in page', async () => {
    renderApp('/login');
    expect(await screen.findByText('Demo Mode — Not Real Authentication')).toBeTruthy();
  });

  it.each(ROLES)('signs in with the email form as %s (any password)', async (role) => {
    const { user, router } = renderApp('/login');
    await user.type(await screen.findByLabelText('Work email'), demoAccount(role).email);
    await user.type(screen.getByLabelText('Password'), 'anything-at-all');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(expectedLanding(role)));
    expect(await screen.findByRole('button', { name: `Account menu for ${demoAccount(role).name.en}` })).toBeTruthy();
  });

  it.each(ROLES)('signs in with one click as %s', async (role) => {
    const { user, router } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: `Sign in as ${roleLabel(role)}` }));
    await waitFor(() => expect(router.state.location.pathname).toBe(expectedLanding(role)));
  });

  it('rejects an unknown account and stays on the sign-in page', async () => {
    const { user, router } = renderApp('/login');
    await user.type(await screen.findByLabelText('Work email'), 'someone@example.com');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no demo account with this email/i);
    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('validates the form before calling the API', async () => {
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByText('Enter a password (any password works for demo accounts).')).toBeTruthy();
  });

  it('never stores the password', async () => {
    const { user, router } = renderApp('/login');
    await user.type(await screen.findByLabelText('Work email'), demoAccount('hr-admin').email);
    await user.type(screen.getByLabelText('Password'), 'Secret-Passw0rd!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stored).not.toContain('Secret-Passw0rd!');
    expect(stored).not.toMatch(/password/i);
  });
});

describe('protected routes and sign-out', () => {
  it('sends signed-out users to sign-in, then back to the page they asked for', async () => {
    const { user, router } = renderApp('/profile');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await user.click(await screen.findByRole('button', { name: `Sign in as ${roleLabel('hr-manager')}` }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });

  it('ignores an expired stored session', async () => {
    storeSessionFor('system-admin', -1000);
    const { router } = renderApp('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('signs out: clears the session and protects pages again', async () => {
    const { user, router } = renderApp('/dashboard', { as: 'hr-admin' });
    await user.click(await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-admin').name.en}` }));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    await router.navigate('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('redirects signed-in users away from /login', async () => {
    const { router } = renderApp('/login', { as: 'employee' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });
});
