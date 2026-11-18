/*
 * Public API of the Workspace (the site's central staff session), used by Blogs Admin (`modules/admin`).
 * Pages are lazy-loaded by the router directly (WorkspaceLayout, WorkspaceLoginPage, WorkspacePage, WorkspaceLogoutPage).
 */
export type { WorkspaceSession } from './api/workspaceAuth';
export { canOpen } from './data/applications';
export { useWorkspaceSession } from './hooks/useWorkspaceSession';
export type { WorkspaceLocationState } from './types';
