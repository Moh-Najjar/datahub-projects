import type { WorkspaceSessionRequest, WorkspaceSessionStatus } from '@datahub/shared-types';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import { getSession, subscribeToSession } from './workspaceAuth';

/*
 * Workspace session bridge — PROTOTYPE session check for applications on other origins (the HR Admin portal).
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
  if (!HR_ADMIN_PORTAL_URL || window.parent === window) return;
  const portalOrigin = new URL(HR_ADMIN_PORTAL_URL).origin;

  const post = () => {
    const session = getSession();
    const status: WorkspaceSessionStatus = {
      type: 'datahub-workspace:session',
      session: session ? { email: session.username, expiresAt: new Date(session.expiresAt).toISOString() } : null,
    };
    window.parent.postMessage(status, portalOrigin);
  };

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.origin !== portalOrigin || event.source !== window.parent) return;
    if ((event.data as Partial<WorkspaceSessionRequest> | null)?.type === REQUEST) post();
  });
  subscribeToSession(post);
  post();
}
