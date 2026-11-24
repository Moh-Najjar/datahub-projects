import { useEffect, useRef } from 'react';
import type { WorkspaceSessionRequest, WorkspaceSessionStatus } from '@datahub/shared-types';
import { WORKSPACE_ORIGIN, WORKSPACE_SESSION_CHECK_URL } from '@/core/config/workspace';

const REQUEST: WorkspaceSessionRequest = { type: 'datahub-workspace:session-request' };

interface WorkspaceSessionCheckProps {
  /** Email of this app's signed-in user. */
  email: string;
  /** Called when the central session no longer exists or belongs to someone else. */
  onEnded: () => void;
}

/**
 * Keeps this app's session tied to the central Workspace session.
 *
 * Browser storage is per origin, so the app cannot read the website's session. It embeds the website's hidden
 * `/workspace-session.html`, which reports the central session with `postMessage` on load, on request (window focus)
 * and whenever it changes — e.g. Sign out in a Workspace or Blogs Admin tab. Only messages from the Workspace origin
 * (and from that frame) are trusted. When the report says "signed out" or names another account, `onEnded` ends this
 * session. No answer (website unreachable) changes nothing.
 *
 * "Signed out" counts only after the frame has once reported THIS user: on different sites the embedded page's
 * storage is partitioned, so it can never see the central session and would always say "signed out". Until confirmed,
 * only "another user" ends the session; the token's expiry still does (AuthProvider).
 */
export function WorkspaceSessionCheck({ email, onEnded }: WorkspaceSessionCheckProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ended = useRef(onEnded);
  useEffect(() => {
    ended.current = onEnded;
  });

  useEffect(() => {
    if (!WORKSPACE_ORIGIN) return;
    const origin = WORKSPACE_ORIGIN;
    let confirmed = false;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      const status = event.data as Partial<WorkspaceSessionStatus> | null;
      if (status?.type !== 'datahub-workspace:session') return;
      const central = status.session;
      if (!central) {
        if (confirmed) ended.current();
      } else if (central.email.toLowerCase() === email.toLowerCase()) {
        confirmed = true;
      } else {
        ended.current();
      }
    };
    const ask = () => frame.current?.contentWindow?.postMessage(REQUEST, origin);
    const onVisible = () => document.visibilityState === 'visible' && ask();
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', ask);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', ask);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [email]);

  if (!WORKSPACE_SESSION_CHECK_URL) return null;
  return (
    <iframe
      ref={frame}
      src={WORKSPACE_SESSION_CHECK_URL}
      title="DataHub Workspace session check"
      aria-hidden="true"
      tabIndex={-1}
      style={{ position: 'absolute', width: 0, height: 0, border: 0, visibility: 'hidden' }}
    />
  );
}
