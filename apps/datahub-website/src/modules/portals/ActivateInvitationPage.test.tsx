import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import ActivateInvitationPage from '@/modules/portals/ActivateInvitationPage';

// The real page, hook, API function and HTTP client; only the network (`fetch`) is replaced.
const ENDPOINT = '/api/v1/auth/activate-invitation';
const GOOD_PASSWORD = 'correct-horse-battery';
const INVALID_MSG = 'This invitation link is invalid or has expired. Please request a new invitation.';
const SHORT_MSG = 'Password must contain at least 12 characters.';

function renderPage(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/activate/', element: <ActivateInvitationPage /> },
      { path: '/workspace/login/', element: <h1>Sign-in page</h1> },
    ],
    { initialEntries: [url] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale="en">
        <AppThemeProvider>
          <RouterProvider router={router} />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return router;
}

const problem = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ title: code, status, detail: message, success: false, data: null, error: { code, message }, meta: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function mockFetch(answer: () => Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function fillAndSubmit(password: string, confirmation = password) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/^New password/), password);
  await user.type(screen.getByLabelText(/^Confirm password/), confirmation);
  await user.click(screen.getByRole('button', { name: 'Activate account' }));
  return user;
}

describe('invitation activation page', () => {
  it('shows an error and no form when the link has no token', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    renderPage('/activate/');
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('This invitation link is invalid because the token is missing.'));
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('labels the fields for password managers and focuses the new password', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    renderPage('/activate/?token=abc');
    const password = await screen.findByLabelText(/^New password/);
    expect(password.getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText(/^Confirm password/).getAttribute('autocomplete')).toBe('new-password');
    await waitFor(() => expect(document.activeElement).toBe(password));
  });

  it('refuses a password shorter than 12 characters without calling the API', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    renderPage('/activate/?token=abc');
    await fillAndSubmit('short-pass1');
    const password = screen.getByLabelText(/^New password/);
    expect(await screen.findByText(SHORT_MSG)).toBeTruthy();
    expect(password.getAttribute('aria-invalid')).toBe('true');
    // The message is the field's accessible description.
    expect(screen.getByText(SHORT_MSG).id).toBe(password.getAttribute('aria-describedby'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a confirmation that does not match without calling the API', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    renderPage('/activate/?token=abc');
    await fillAndSubmit(GOOD_PASSWORD, `${GOOD_PASSWORD}x`);
    expect(await screen.findByText('The passwords do not match.')).toBeTruthy();
    expect(screen.getByLabelText(/^Confirm password/).getAttribute('aria-invalid')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('activates with HTTP 204: exact request, disabled button while sending, then on to sign-in', async () => {
    let answer!: (response: Response) => void;
    const fetchMock = mockFetch(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderPage('/activate/?token=invite-token-123');
    const user = await fillAndSubmit(GOOD_PASSWORD);

    // While the request runs the button is disabled (no double submit).
    await waitFor(() => expect(screen.getByRole('button', { name: /Activating/ })).toHaveProperty('disabled', true));
    // …and shows a loading indicator.
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'invite-token-123', newPassword: GOOD_PASSWORD });
    // Anonymous: no token of a signed-in user, no cookies.
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    expect(init?.credentials).toBe('omit');

    answer(new Response(null, { status: 204 }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Your account has been activated successfully.');
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(screen.queryByLabelText(/^New password/)).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Continue to sign in' }));
    expect(await screen.findByRole('heading', { name: 'Sign-in page' })).toBeTruthy();
  });

  it('sends the token exactly as the invitation e-mail encodes it (%2B = +, unencoded + kept)', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    renderPage('/activate/?token=Crk%2BC7R3Zv4q+LGE8%2FmA%3D%3D');
    await fillAndSubmit(GOOD_PASSWORD);
    await screen.findByRole('status');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body)).token).toBe('Crk+C7R3Zv4q+LGE8/mA==');
  });

  it('accepts the e-mail link without the trailing slash (/activate?token=…)', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    renderPage('/activate?token=abc');
    expect(await screen.findByLabelText(/^New password/)).toBeTruthy();
  });

  it('goes to the sign-in page by itself shortly after activating', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    const router = renderPage('/activate/?token=abc');
    await fillAndSubmit(GOOD_PASSWORD);
    await screen.findByRole('status');
    await waitFor(() => expect(router.state.location.pathname).toBe('/workspace/login/'), { timeout: 8000 });
  }, 12000);

  it('explains an invalid or expired invitation (400 Authentication.InvalidToken)', async () => {
    mockFetch(() => Promise.resolve(problem(400, 'Authentication.InvalidToken', 'The invitation token is invalid or expired.')));
    renderPage('/activate/?token=used-token');
    await fillAndSubmit(GOOD_PASSWORD);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(INVALID_MSG);
    await waitFor(() => expect(document.activeElement).toBe(alert));
    // The form stays usable; nothing was announced as a success.
    expect(screen.getByRole('button', { name: 'Activate account' })).toHaveProperty('disabled', false);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it("shows the backend's weak-password answer on the password field", async () => {
    mockFetch(() => Promise.resolve(problem(400, 'Authentication.WeakPassword', 'Password does not meet minimum strength requirements.')));
    renderPage('/activate/?token=abc');
    await fillAndSubmit(GOOD_PASSWORD);
    expect(await screen.findByText(SHORT_MSG)).toBeTruthy();
    expect(screen.getByLabelText(/^New password/).getAttribute('aria-invalid')).toBe('true');
  });

  it('asks to try again when the API cannot be reached or fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    renderPage('/activate/?token=abc');
    await fillAndSubmit(GOOD_PASSWORD);
    expect((await screen.findByRole('alert')).textContent).toBe('We could not activate your account. Please try again.');
  });
});
