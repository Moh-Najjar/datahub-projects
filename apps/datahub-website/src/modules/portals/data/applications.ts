import { ADMIN_ENABLED } from '@/core/config/admin';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import { TRAINEE_APP_URL } from '@/core/config/traineeApp';
import type { WorkspaceSession } from '@/modules/portals/api/workspaceAuth';

/*
 * The applications of the Workspace and who may open them. Names and descriptions: `workspace.apps.<id>` in
 * `i18n/locales/*.json`. UI checks are not security: each application's backend enforces its own permissions.
 *
 * - Blogs Admin: when the backend lists it (`GET /api/v1/auth/portals`).
 * - HR Admin: when the backend lists it, or the token has HR permissions (`hr.*`) — the backend does not list
 *   `hr-admin` yet.
 * - Trainee App: when the backend lists it, or the token has a training permission (`training.*`). INTERIM (the backend
 *   issues neither yet): any signed-in staff user with a backend role may open it — keep in sync with
 *   `apps/datahub-trainee-app/src/core/auth/workspaceAccess.ts`; remove the interim line once `training.*` exists.
 *   What a user can do INSIDE the app is the app's own business policy and never grants access here.
 */

export const APPLICATION_IDS = ['hr-admin', 'blogs-admin', 'trainee-app'] as const;
export type ApplicationId = (typeof APPLICATION_IDS)[number];

/** Display order; `available` = the application is configured in this build. */
const APPLICATIONS: readonly { id: ApplicationId; available: boolean }[] = [
  { id: 'hr-admin', available: HR_ADMIN_PORTAL_URL !== undefined },
  { id: 'blogs-admin', available: ADMIN_ENABLED },
  { id: 'trainee-app', available: TRAINEE_APP_URL !== undefined },
];

/** INTERIM: until the backend issues `training.*` permissions, every signed-in staff user may open the Trainee App. */
const INTERIM_TRAINEE_APP_OPEN_TO_STAFF = true;

export function canOpen(session: WorkspaceSession, app: ApplicationId): boolean {
  if (session.applications.includes(app)) return true;
  if (app === 'hr-admin') return session.permissions.some((p) => p.startsWith('hr.'));
  if (app === 'trainee-app') return session.permissions.some((p) => p.startsWith('training.')) || INTERIM_TRAINEE_APP_OPEN_TO_STAFF && session.roles.length > 0;
  return false;
}

/** The applications this session may open in this build, in display order. */
export function applicationsFor(session: WorkspaceSession): ApplicationId[] {
  return APPLICATIONS.filter((app) => app.available && canOpen(session, app.id)).map((app) => app.id);
}
