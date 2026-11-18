import type { ApplicationId } from './data/applications';

/** Router location state passed to the Workspace pages. */
export interface WorkspaceLocationState {
  /** Page to return to after sign-in (locale-neutral or localized path on this site). */
  from?: string;
  /** Shown on the sign-in page after signing out. */
  signedOut?: boolean;
  /** The dashboard explains that the role may not open this application. */
  denied?: ApplicationId;
}
