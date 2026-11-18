import type { Localized } from '@/i18n/languages';
import { DEMO_ACCOUNTS, type WorkspaceRole } from '@/modules/portals/data/accounts';

/*
 * The Workspace's central sign-in — MOCK, NOT real authentication and NOT production-secure.
 *
 * `signIn` selects a demo account by username; any non-empty password is accepted and is never stored, logged or sent
 * anywhere. The session is kept in `localStorage` (shared by this site's tabs, 8 hours) — readable by any script on the
 * page, which is acceptable only for a prototype. The Workspace dashboard and Blogs Admin (`/admin/`) read it; the HR
 * Admin portal (another origin) receives a short-lived handoff token (`hrHandoff.ts`) and checks that this session still
 * exists through the hidden session bridge (`sessionBridge.ts`).
 *
 * The real backend will verify credentials and issue the session; only these function bodies change — the pages use
 * `signIn`, `signOut`, `getSession` and `subscribeToSession` (through `useWorkspaceSession`).
 */

export interface WorkspaceSession {
  username: string;
  name: Localized<string>;
  role: WorkspaceRole;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export class AuthError extends Error {
  constructor() {
    super('Unknown account');
    this.name = 'AuthError';
  }
}

const SESSION_KEY = 'datahub-website.workspace-session';
const SESSION_MS = 8 * 60 * 60 * 1000;

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
    const value = JSON.parse(raw) as Partial<WorkspaceSession>;
    // Re-read the account: a stored role can never grant more than the account list says.
    const account = DEMO_ACCOUNTS.find((a) => a.username === value.username);
    if (!account || value.role !== account.role || typeof value.expiresAt !== 'number') return null;
    return { username: account.username, name: account.name, role: account.role, expiresAt: value.expiresAt };
  } catch {
    return null;
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

/** Mock sign-in (simulated latency like a real request). Throws `AuthError` for an unknown username. */
export async function signIn(username: string, password: string): Promise<WorkspaceSession> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const account = DEMO_ACCOUNTS.find((a) => a.username.toLowerCase() === username.trim().toLowerCase());
  // MOCK: the password is only required to be non-empty — never compared or kept.
  if (!account || !password) throw new AuthError();
  const session: WorkspaceSession = { username: account.username, name: account.name, role: account.role, expiresAt: Date.now() + SESSION_MS };
  save(session);
  return session;
}

/** Ends the central session: this site's tabs at once, the HR portal through the session bridge. */
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
