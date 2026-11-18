import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '@/core/context/authContext';
import i18n from '@/i18n';
import { demoAccount, renderApp, storeSessionFor } from '@/test/renderApp';

/** jsdom cannot leave the page: record cross-origin navigations instead. */
function stubLocation() {
  const assign = vi.fn();
  const replace = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign, replace });
  return { assign, replace };
}

afterEach(() => vi.unstubAllGlobals());

describe('sign-in page (the DataHub Workspace is the only sign-in)', () => {
  it('has no form and no demo accounts — only the demo-mode warning and the Workspace', async () => {
    stubLocation();
    renderApp('/login');
    expect(await screen.findByText('Demo Mode — Not Real Authentication')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue to DataHub Portals' }).getAttribute('href')).toBe('http://localhost:3000/workspace/open/hr-admin/');
    expect(document.querySelector('input, form')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Sign in/ })).toBeNull();
    expect(screen.queryByText(/Demo accounts/)).toBeNull();
  });

  it('sends Arabic users to the Arabic Workspace', async () => {
    await i18n.changeLanguage('ar');
    const { replace } = stubLocation();
    renderApp('/login');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('http://localhost:3000/ar/workspace/open/hr-admin/'));
  });
});

describe('protected routes and sign-out', () => {
  it('sends signed-out users to the Workspace', async () => {
    const { replace } = stubLocation();
    const { router } = renderApp('/profile');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('http://localhost:3000/workspace/open/hr-admin/'));
  });

  it('ignores an expired stored session', async () => {
    stubLocation();
    storeSessionFor('system-admin', -1000);
    const { router } = renderApp('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('signs out through the Workspace: clears this session and ends the central one', async () => {
    const { user, router } = renderApp('/dashboard', { as: 'hr-admin' });
    const { assign } = stubLocation();
    await user.click(await screen.findByRole('button', { name: `Account menu for ${demoAccount('hr-admin').name.en}` }));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }));
    expect(assign).toHaveBeenCalledWith('http://localhost:3000/workspace/logout/');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('the top bar links back to the DataHub Workspace (in the user language)', async () => {
    const { user } = renderApp('/dashboard', { as: 'hr-admin' });
    const link = await screen.findByRole('link', { name: 'DataHub Portals' });
    expect(link.getAttribute('href')).toBe('http://localhost:3000/workspace/');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect((await screen.findByRole('link', { name: 'بوابات داتا هب' })).getAttribute('href')).toBe('http://localhost:3000/ar/workspace/');
  });

  it('redirects signed-in users away from /login', async () => {
    const { router } = renderApp('/login', { as: 'employee' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });
});
