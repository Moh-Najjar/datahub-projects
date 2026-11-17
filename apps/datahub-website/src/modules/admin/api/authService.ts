/*
 * TEMPORARY mock authentication for the admin prototype. Real authentication and authorization will be done by the
 * backend: replace `signIn` / `signOut` / `getSession` with API calls (and a real token); the pages only use these
 * three functions and `subscribeToSession`.
 *
 * The development credentials below live ONLY in this file. They are not a secret (everything here ships to the
 * browser) — the admin is a prototype whose changes stay in the user's own browser.
 */

const DEV_CREDENTIALS = { username: 'admin', password: 'DataHub@2026' } as const;

const SESSION_KEY = 'datahub-website.admin-session';
/** A session lasts 8 hours. */
const SESSION_MS = 8 * 60 * 60 * 1000;

export interface AdminSession {
  username: string;
  expiresAt: number;
}

export class AuthError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'AuthError';
  }
}

const listeners = new Set<() => void>();
let cached: { raw: string | null; session: AdminSession | null } = { raw: null, session: null };

function notify() {
  for (const listener of listeners) listener();
}

function read(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** The signed-in admin, or `null` (never signed in, signed out or expired). Stable between changes. */
export function getSession(): AdminSession | null {
  const raw = read();
  if (raw !== cached.raw) {
    let session: AdminSession | null = null;
    try {
      session = raw ? (JSON.parse(raw) as AdminSession) : null;
    } catch {
      session = null;
    }
    cached = { raw, session };
  }
  if (cached.session && cached.session.expiresAt <= Date.now()) return null;
  return cached.session;
}

export async function signIn(username: string, password: string): Promise<AdminSession> {
  // Simulated network latency, like a real sign-in request.
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (username.trim() !== DEV_CREDENTIALS.username || password !== DEV_CREDENTIALS.password) throw new AuthError();
  const session: AdminSession = { username: DEV_CREDENTIALS.username, expiresAt: Date.now() + SESSION_MS };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable: the session lasts until the page is reloaded.
    cached = { raw: null, session };
  }
  notify();
  return session;
}

export function signOut(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  cached = { raw: null, session: null };
  notify();
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  // Sign-in / sign-out in another tab.
  const onStorage = (event: StorageEvent) => (event.key === SESSION_KEY || event.key === null) && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Shown on the sign-in page in development only. */
export const DEV_CREDENTIALS_HINT = import.meta.env.DEV ? DEV_CREDENTIALS : null;
