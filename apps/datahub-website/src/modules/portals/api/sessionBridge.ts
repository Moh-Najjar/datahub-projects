import type { WorkspaceSessionRequest, WorkspaceSessionStatus } from '@datahub/shared-types';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import { TRAINEE_APP_URL } from '@/core/config/traineeApp';
import { getSession, subscribeToSession } from './workspaceAuth';

/*
 * Workspace session bridge — PROTOTYPE session check for applications on other origins (the HR Admin portal and the Trainee App).
 *
 * Browser storage is per origin, so the HR portal cannot read this site's session. It embeds the hidden
 * `/workspace-session.html` page (entry: `src/portalsSession.ts`), which runs this bridge: it tells the embedding
 * page — and ONLY the configured portal origin — whether the central session exists and for which account, on load,
 * on request and on every change (sign-in, sign-out or expiry, also from other tabs). It never sends anything else
 * (no token, no password). The portal ends its own session when the answer no longer matches its user.
 * A backend session check (e.g. an SSO session endpoint) replaces this later.
 */

const REQUEST: WorkspaceSessionRequest['type'] = 'datahub-workspace:session-request';

export function startSessionBridge(): void {
  // Only the configured application origins are ever answered.
  const allowed = [HR_ADMIN_PORTAL_URL, TRAINEE_APP_URL].filter((u): u is string => !!u).map((u) => new URL(u).origin);
  if (allowed.length === 0 || window.parent === window) return;
  // The embedding app is the parent window: answer exactly the origin that asked (and that is allowed).
  let portalOrigin: string | null = allowed.length === 1 ? allowed[0]! : null;

  const post = () => {
    const session = getSession();
    const status: WorkspaceSessionStatus = {
      type: 'datahub-workspace:session',
      session: session ? { email: session.username, expiresAt: new Date(session.expiresAt).toISOString() } : null,
    };
    if (portalOrigin) window.parent.postMessage(status, portalOrigin);
    else for (const origin of allowed) window.parent.postMessage(status, origin);
  };

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!allowed.includes(event.origin) || event.source !== window.parent) return;
    if ((event.data as Partial<WorkspaceSessionRequest> | null)?.type === REQUEST) {
      portalOrigin = event.origin;
      post();
    }
  });
  subscribeToSession(post);
  post();
}
