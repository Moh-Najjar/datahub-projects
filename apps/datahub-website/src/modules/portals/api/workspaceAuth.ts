import { authApi, decodeAccessToken } from '@/core/api/auth';
import { configureHttpAuth, HttpError } from '@/core/helpers/http';
import type { Localized } from '@/i18n/languages';
import { APPLICATION_IDS, type ApplicationId } from '@/modules/portals/data/applications';
import { isWorkspaceRole, type WorkspaceRole } from '@/modules/portals/data/roles';

/*
 * The Workspace's central sign-in — the ONE sign-in of DataHub's staff applications, verified by the backend
 * (`POST /api/v1/auth/login`). The session holds the access token (JWT, ~15 minutes), the roles and permissions it
 * carries, and the applications the backend lists (`GET /api/v1/auth/portals`). It ends when the token expires (the
 * backend's refresh endpoint is not usable yet) or when the backend refuses the token (401).
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

/** Re-render subscribers when the session expires (`getSession` then returns null). */
function scheduleExpiry(session: WorkspaceSession | null) {
  clearTimeout(expiryTimer);
  if (session) expiryTimer = setTimeout(notify, Math.max(0, session.expiresAt - Date.now()) + 50);
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
  if (cached.session && cached.session.expiresAt <= Date.now()) return null;
  return cached.session;
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
  };
  save(session);
  return session;
}

/**
 * Ends the central session: this site's tabs at once, the HR portal through the session bridge. The backend's logout
 * endpoint is not usable yet (403), so the token stays valid until it expires — it is only forgotten here.
 */
export function signOut(): void {
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

// Backend requests made with `auth: true` use the session's token; a 401 ends the session.
configureHttpAuth({ getAccessToken, onUnauthorized: signOut });
