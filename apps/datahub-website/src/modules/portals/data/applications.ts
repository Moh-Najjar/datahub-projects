import { ADMIN_ENABLED } from '@/core/config/admin';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import { TRAINEE_APP_URL } from '@/core/config/traineeApp';
import type { WorkspaceSession } from '@/modules/portals/api/workspaceAuth';

/*
 * The applications of the Workspace and who may open them. Ids are the backend's portal keys
 * (`GET /api/v1/auth/portals`, verified 2026-11-24: `hr-admin`, `blogs-admin`, `academy-admin` = the Trainee App).
 * A user may open exactly the applications the backend lists for them. Names and descriptions: `workspace.apps.<id>` in
 * `i18n/locales/*.json`. UI checks are not security: each application's backend enforces its own permissions; what a user
 * can do INSIDE an application is that application's own policy.
 */

export const APPLICATION_IDS = ['hr-admin', 'blogs-admin', 'academy-admin'] as const;
export type ApplicationId = (typeof APPLICATION_IDS)[number];

/** Display order; `available` = the application is configured in this build. */
const APPLICATIONS: readonly { id: ApplicationId; available: boolean }[] = [
  { id: 'hr-admin', available: HR_ADMIN_PORTAL_URL !== undefined },
  { id: 'blogs-admin', available: ADMIN_ENABLED },
  { id: 'academy-admin', available: TRAINEE_APP_URL !== undefined },
];

/** The backend lists the application among the user's portals. */
export function canOpen(session: WorkspaceSession, app: ApplicationId): boolean {
  return session.applications.includes(app);
}

/** The applications this session may open in this build, in display order. */
export function applicationsFor(session: WorkspaceSession): ApplicationId[] {
  return APPLICATIONS.filter((app) => app.available && canOpen(session, app.id)).map((app) => app.id);
}
