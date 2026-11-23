/*
 * DataHub Workspace → HR Admin Portal sign-in handoff.
 *
 * Staff sign in once on the website's Workspace (`/workspace/login/`, verified by the backend). The HR portal runs on
 * another origin and cannot read that session, so the Workspace opens
 * `<HR portal>/sso#token=<base64url(JSON WorkspaceHandoffPayload)>`. The payload carries the backend access token (a
 * JWT the backend verifies on every request); the portal reads the user, role, permissions and expiry from it. The
 * token travels in the URL hash (never sent to servers) and the portal removes it from the address bar at once.
 */

/** Fixed issuer of handoff payloads. */
export type WorkspaceHandoffIssuer = 'datahub-workspace-prototype';

/**
 * Session check. Applications on other origins cannot read the Workspace's browser storage, so they embed the website's
 * hidden `/workspace-session.html` page; it answers with `postMessage` — to their origin only — whether the central
 * session still exists and for whom (and announces every change, e.g. a sign-out in another tab). An application whose
 * user no longer matches ends its own session.
 */
export interface WorkspaceSessionStatus {
  type: 'datahub-workspace:session';
  /** The signed-in account, or `null` after sign-out / expiry. */
  session: { email: string; expiresAt: string } | null;
}

/** Sent by an embedding application to ask for the current `WorkspaceSessionStatus`. */
export interface WorkspaceSessionRequest {
  type: 'datahub-workspace:session-request';
}

/** The decoded handoff token. */
export interface WorkspaceHandoffPayload {
  issuer: WorkspaceHandoffIssuer;
  /** The signed-in account's email. */
  email: string;
  /** ISO date-time, about 2 minutes after the payload was created (the handoff link's own lifetime). */
  expiresAt: string;
  /** The backend access token (JWT) of the Workspace session. */
  accessToken: string;
}
