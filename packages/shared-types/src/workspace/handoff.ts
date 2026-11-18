/**
 * DataHub Workspace → HR Admin Portal sign-in handoff (PROTOTYPE).
 *
 * Staff sign in once on the website's Workspace (`/workspace/login/`). The HR portal runs on another origin and cannot
 * read that session, so the Workspace opens `<HR portal>/sso#token=<base64url(JSON WorkspaceHandoffPayload)>` and the
 * portal turns a valid token into its own session for the same demo account. The token travels in the URL hash
 * (never sent to servers), lives about 2 minutes and carries no password or permissions.
 *
 * It is NOT signed and proves nothing: a backend-issued, signed token will replace it. Only the Workspace's token
 * builder and the portal's token parser change then.
 */

/** Fixed issuer of prototype handoff tokens. */
export type WorkspaceHandoffIssuer = 'datahub-workspace-prototype';

/**
 * Session check (PROTOTYPE). Applications on other origins cannot read the Workspace's browser storage, so they embed
 * the website's hidden `/workspace-session.html` page; it answers with `postMessage` — to their origin only — whether
 * the central session still exists and for whom (and announces every change, e.g. a sign-out in another tab). An
 * application whose user no longer matches ends its own session. A backend session check replaces this later.
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
  /** The signed-in account (a demo account's email in the prototype). */
  email: string;
  /** ISO date-time, about 2 minutes after the token was created. */
  expiresAt: string;
}
