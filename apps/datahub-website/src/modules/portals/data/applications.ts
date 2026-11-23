import { ADMIN_ENABLED } from '@/core/config/admin';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import type { WorkspaceSession } from '@/modules/portals/api/workspaceAuth';

/*
 * The applications of the Workspace and who may open them. Names and descriptions: `workspace.apps.<id>` in
 * `i18n/locales/*.json`. UI checks are not security: each application's backend enforces its own permissions.
 *
 * - Blogs Admin: when the backend lists it (`GET /api/v1/auth/portals`).
 * - HR Admin: when the backend lists it, or the token has HR permissions (`hr.*`) — the backend does not list
 *   `hr-admin` yet.
 */

export const APPLICATION_IDS = ['hr-admin', 'blogs-admin'] as const;
export type ApplicationId = (typeof APPLICATION_IDS)[number];

/** Display order; `available` = the application is configured in this build. */
const APPLICATIONS: readonly { id: ApplicationId; available: boolean }[] = [
  { id: 'hr-admin', available: HR_ADMIN_PORTAL_URL !== undefined },
  { id: 'blogs-admin', available: ADMIN_ENABLED },
];

export function canOpen(session: WorkspaceSession, app: ApplicationId): boolean {
  if (session.applications.includes(app)) return true;
  return app === 'hr-admin' && session.permissions.some((p) => p.startsWith('hr.'));
}

/** The applications this session may open in this build, in display order. */
export function applicationsFor(session: WorkspaceSession): ApplicationId[] {
  return APPLICATIONS.filter((app) => app.available && canOpen(session, app.id)).map((app) => app.id);
}
