import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The Workspace session with the real HTTP client; only `fetch` is replaced. Each test loads a fresh copy of the module
 * (it keeps the session, timers and refresh state at module level).
 */

const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (expInSeconds: number, permission: string[] = ['cms.blogs.view']) =>
  `${b64({ alg: 'none' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expInSeconds, role: 'system-admin', permission })}.sig`;

type Handler = (path: string, body: unknown, init: RequestInit) => Response;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status < 300 ? { success: true, data } : { success: false, error: { code: 'Forbidden', message: 'Forbidden' } }), { status, headers: { 'Content-Type': 'application/json' } });

function backend(handler: Handler) {
  const calls: { path: string; body: unknown; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init = {}) => {
      const path = new URL(String(input), 'http://api.test').pathname;
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, body, init });
      return handler(path, body, init);
    }),
  );
  return calls;
}

const load = async () => {
  vi.resetModules();
  return import('./workspaceAuth');
};

const LOGIN = { accessToken: '', refreshToken: 'refresh-1', userId: 'u1', displayName: 'Admin', email: 'admin@example.test', roles: ['system-admin'], preferredLanguage: 'en' };

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Workspace session refresh', () => {
  it('keeps the refresh token from the login and renews the access token with it', async () => {
    const first = jwt(30);
    const renewed = jwt(900, ['cms.blogs.view', 'cms.blogs.publish']);
    const calls = backend((path) => {
      if (path.endsWith('/auth/login')) return json({ ...LOGIN, accessToken: first });
      if (path.endsWith('/auth/portals')) return json([{ key: 'blogs-admin', name: 'Blogs', description: '' }]);
      if (path.endsWith('/auth/refresh')) return json({ accessToken: renewed, refreshToken: 'refresh-2' });
      return json(null, 404);
    });
    const auth = await load();
    await auth.signIn('admin@example.test', 'secret');
    expect(auth.getSession()?.refreshToken).toBe('refresh-1');

    expect(await auth.refreshSession()).toBe(true);
    const refresh = calls.find((c) => c.path.endsWith('/auth/refresh'))!;
    expect(refresh.body).toEqual({ refreshToken: 'refresh-1' });
    expect(refresh.init.credentials).toBe('include');
    const session = auth.getSession()!;
    expect(session.accessToken).toBe(renewed);
    expect(session.refreshToken).toBe('refresh-2');
    expect(session.permissions).toContain('cms.blogs.publish');
    expect(session.expiresAt).toBeGreaterThan(Date.now() + 800_000);
    // The password is never stored.
    expect(localStorage.getItem('datahub-website.workspace-session')).not.toMatch(/secret/);
  });

  it('a 401 is answered by one refresh and the request is repeated with the new token', async () => {
    const old = jwt(600);
    const renewed = jwt(900);
    const calls = backend((path, _body, init) => {
      if (path.endsWith('/auth/login')) return json({ ...LOGIN, accessToken: old });
      if (path.endsWith('/auth/portals')) return json([]);
      if (path.endsWith('/auth/refresh')) return json({ accessToken: renewed });
      if (path.endsWith('/admin/blogs')) return new Headers(init.headers).get('Authorization') === `Bearer ${renewed}` ? json({ items: [], totalCount: 0 }) : json(null, 401);
      return json(null, 404);
    });
    const auth = await load();
    const { blogsApi } = await import('@/core/api/blogs');
    await auth.signIn('admin@example.test', 'secret');
    await expect(blogsApi.getAdminBlogs({ pageNumber: 1, pageSize: 1 })).resolves.toMatchObject({ totalCount: 0 });
    expect(calls.filter((c) => c.path.endsWith('/admin/blogs'))).toHaveLength(2);
    expect(auth.getSession()?.accessToken).toBe(renewed);
  });

  it('when refresh is refused (403) the session stays until it expires, and refresh is not retried for that token', async () => {
    const token = jwt(600);
    const calls = backend((path) => {
      if (path.endsWith('/auth/login')) return json({ ...LOGIN, accessToken: token });
      if (path.endsWith('/auth/portals')) return json([]);
      return json(null, 403);
    });
    const auth = await load();
    await auth.signIn('admin@example.test', 'secret');
    expect(await auth.refreshSession()).toBe(false);
    expect(await auth.refreshSession()).toBe(false);
    expect(calls.filter((c) => c.path.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(auth.getSession()?.accessToken).toBe(token);
  });

  it('sign-out ends the backend session with the refresh token and forgets the session', async () => {
    const calls = backend((path) => {
      if (path.endsWith('/auth/login')) return json({ ...LOGIN, accessToken: jwt(600) });
      if (path.endsWith('/auth/portals')) return json([]);
      return new Response(null, { status: 204 });
    });
    const auth = await load();
    await auth.signIn('admin@example.test', 'secret');
    auth.signOut();
    expect(auth.getSession()).toBeNull();
    await vi.waitFor(() => expect(calls.find((c) => c.path.endsWith('/auth/logout'))?.body).toEqual({ refreshToken: 'refresh-1' }));
  });
});
