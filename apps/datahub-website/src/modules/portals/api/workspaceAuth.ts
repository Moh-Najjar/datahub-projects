import { authApi, decodeAccessToken } from '@/core/api/auth';
import { configureHttpAuth, HttpError } from '@/core/helpers/http';
import type { Localized } from '@/i18n/languages';
import { APPLICATION_IDS, type ApplicationId } from '@/modules/portals/data/applications';
import { isWorkspaceRole, type WorkspaceRole } from '@/modules/portals/data/roles';

/*
 * The Workspace's central sign-in — the ONE sign-in of DataHub's staff applications, verified by the backend
 * (`POST /api/v1/auth/login`). The session holds the access token (JWT, ~15 minutes), the roles and permissions it
 * carries, and the applications the backend lists (`GET /api/v1/auth/portals`).
 *
 * Refresh: shortly before the access token expires (and when a request answers 401) the session is renewed with
 * `POST /api/v1/auth/refresh` `{ refreshToken }` — once for all tabs (Web Locks), the result shared through storage.
 * When refresh is refused (the backend answered 403 to every request on 2026-11-22 and 2026-11-25) nothing breaks: the
 * session ends when the token expires, as before. Sign-out also ends the backend session (`POST /api/v1/auth/logout`).
 *
 * Kept in `localStorage` (shared by this site's tabs: signing out in one tab signs out all). The access token is
 * therefore readable by scripts of this origin — accepted for now; the password is never stored.
 */

export interface WorkspaceSession {
  /** The account's email. */
  username: string;
  /** The backend's display name (one name, shown in both languages). */
  name: Localized<string>;
  /** The first role this site has a label for (`null` if none). */
  role: WorkspaceRole | null;
  /** Roles as the backend sent them. */
  roles: string[];
  /** Applications from `/api/v1/auth/portals` (known ids only). */
  applications: ApplicationId[];
  /** The token's `permission` claims (e.g. `cms.blogs.publish`) — UI only, the backend checks every request. */
  permissions: string[];
  accessToken: string;
  /** Epoch milliseconds (the token's expiry). */
  expiresAt: number;
  /** From the login / refresh answer when the backend returns it (it may also be an HttpOnly cookie). */
  refreshToken?: string | null;
}

/** Wrong email or password. */
export class AuthError extends Error {
  constructor() {
    super('Wrong email or password');
    this.name = 'AuthError';
  }
}

const SESSION_KEY = 'datahub-website.workspace-session';

const listeners = new Set<() => void>();
let cached: { raw: string | null; session: WorkspaceSession | null } = { raw: null, session: null };
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
/** Storage refused the session (e.g. blocked site data): keep it in memory until the page is reloaded. */
let memoryOnly = false;

function notify() {
  for (const listener of listeners) listener();
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): WorkspaceSession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as WorkspaceSession;
    // Permissions always come from the token itself, never from storage.
    return { ...session, permissions: decodeAccessToken(session.accessToken).permissions };
  } catch {
    return null; // e.g. a session of the former demo sign-in (no token)
  }
}

/** Renew this long before the access token expires. */
const REFRESH_AHEAD_MS = 60_000;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
/** The refresh in progress (one at a time). */
let refreshing: Promise<boolean> | null = null;
/** The access token whose refresh was refused — not tried again for it (no request loop while refresh is unavailable). */
let refusedFor: string | null = null;

/**
 * Re-render subscribers when the session expires (`getSession` then returns null), and renew it shortly before.
 */
function scheduleExpiry(session: WorkspaceSession | null) {
  clearTimeout(expiryTimer);
  clearTimeout(refreshTimer);
  if (!session) return;
  expiryTimer = setTimeout(notify, Math.max(0, session.expiresAt - Date.now()) + 50);
  if (refusedFor !== session.accessToken) refreshTimer = setTimeout(() => void refreshSession(), Math.max(0, session.expiresAt - Date.now() - REFRESH_AHEAD_MS));
}

function save(session: WorkspaceSession | null) {
  const raw = session ? JSON.stringify(session) : null;
  try {
    if (raw) localStorage.setItem(SESSION_KEY, raw);
    else localStorage.removeItem(SESSION_KEY);
    memoryOnly = false;
  } catch {
    // Storage unavailable: the session lasts until the page is reloaded.
    memoryOnly = raw !== null;
  }
  cached = { raw, session };
  scheduleExpiry(session);
  notify();
}

/** The signed-in user, or `null` (never signed in, signed out or expired). Stable between changes. */
export function getSession(): WorkspaceSession | null {
  const raw = readRaw();
  // Re-read whenever storage changed — including removal by a sign-out in another tab.
  if (!memoryOnly && raw !== cached.raw) {
    cached = { raw, session: parse(raw) };
    scheduleExpiry(cached.session);
  }
  // Expired: gone — unless it is being renewed right now (e.g. the page was reopened after the token expired).
  if (cached.session && cached.session.expiresAt <= Date.now() && !refreshing) return null;
  return cached.session;
}

/** The stored session, even when its access token has expired (refresh needs it). */
function storedSession(): WorkspaceSession | null {
  getSession();
  return cached.session;
}

/** The fields of a login / refresh answer, whatever their exact names. */
function tokensOf(answer: unknown): { accessToken: string | null; refreshToken: string | null } {
  const o = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof o[key] === 'string' && o[key] ? (o[key] as string) : null);
  return { accessToken: text('accessToken') ?? text('token'), refreshToken: text('refreshToken') };
}

async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // One tab renews at a time; the others then find the new token in storage.
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request('datahub-website.workspace-refresh', task) : task();
}

/**
 * Renews the access token with the refresh endpoint. Resolves `true` when the session now has a valid token (renewed
 * here or by another tab), `false` when there is no session or the backend refused (the session then ends at expiry).
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= withRefreshLock(async () => {
    const before = storedSession();
    if (!before) return false;
    // Another tab renewed it meanwhile.
    const latest = parse(readRaw());
    if (latest && latest.accessToken !== before.accessToken && latest.expiresAt - Date.now() > REFRESH_AHEAD_MS) {
      cached = { raw: readRaw(), session: latest };
      scheduleExpiry(latest);
      notify();
      return true;
    }
    if (refusedFor === before.accessToken) return false;
    try {
      const { accessToken, refreshToken } = tokensOf(await authApi.refresh(before.refreshToken ?? null));
      if (!accessToken) throw new Error('No access token in the refresh answer');
      const claims = decodeAccessToken(accessToken);
      save({ ...before, accessToken, refreshToken: refreshToken ?? before.refreshToken ?? null, permissions: claims.permissions, roles: claims.roles.length ? claims.roles : before.roles, expiresAt: claims.exp * 1000 });
      return true;
    } catch {
      refusedFor = before.accessToken;
      scheduleExpiry(before);
      return false;
    }
  }).finally(() => {
    refreshing = null;
    notify();
  });
  return refreshing;
}

/** Signs in with the backend. Throws `AuthError` for wrong credentials; other failures (network, server) as they are. */
export async function signIn(email: string, password: string): Promise<WorkspaceSession> {
  if (!email.trim() || !password) throw new AuthError();
  const login = await authApi.login(email.trim(), password).catch((e: unknown) => {
    // 400 `Authentication.InvalidCredentials`.
    throw e instanceof HttpError && (e.status === 400 || e.status === 401) ? new AuthError() : e;
  });
  const portals = await authApi.getPortals(login.accessToken);
  const claims = decodeAccessToken(login.accessToken);
  const session: WorkspaceSession = {
    username: login.email,
    name: { en: login.displayName, ar: login.displayName },
    role: login.roles.find(isWorkspaceRole) ?? null,
    roles: login.roles,
    applications: portals.map((p) => p.key).filter((key): key is ApplicationId => (APPLICATION_IDS as readonly string[]).includes(key)),
    permissions: claims.permissions,
    accessToken: login.accessToken,
    expiresAt: claims.exp * 1000,
    refreshToken: tokensOf(login).refreshToken,
  };
  refusedFor = null;
  save(session);
  return session;
}

/**
 * Ends the central session: this site's tabs at once, the HR portal through the session bridge, and the backend's
 * session (`POST /api/v1/auth/logout` with the refresh token; best effort — when it is refused, the access token stays
 * valid until it expires but is forgotten here).
 */
export function signOut(): void {
  const session = storedSession();
  if (session) void authApi.logout(session.refreshToken ?? null).catch(() => undefined);
  save(null);
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  // Sign-in / sign-out in another tab of this site.
  const onStorage = (event: StorageEvent) => (event.key === SESSION_KEY || event.key === null) && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const hasPermission = (session: WorkspaceSession | null, permission: string): boolean => Boolean(session?.permissions.includes(permission));

export const getAccessToken = (): string | null => getSession()?.accessToken ?? null;

// Backend requests made with `auth: true` use the session's token; a 401 first tries a refresh, then ends the session.
configureHttpAuth({ getAccessToken, onUnauthorized: signOut, refresh: refreshSession });

// The page was reopened after the access token expired: try to renew it (the refresh token usually lives longer).
{
  const stored = typeof window !== 'undefined' ? storedSession() : null;
  if (stored && stored.expiresAt <= Date.now() && stored.refreshToken) void refreshSession();
}
