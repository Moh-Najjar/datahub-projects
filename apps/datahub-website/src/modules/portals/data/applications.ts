import { ADMIN_ENABLED } from '@/core/config/admin';
import { HR_ADMIN_PORTAL_URL } from '@/core/config/hrAdminPortal';
import type { WorkspaceRole } from './accounts';

/*
 * The applications of the Workspace and who may open them — PROTOTYPE access rules, kept in this one place. The
 * dashboard cards, the Blogs Admin guard and the HR handoff all read them. Names and descriptions are in
 * `i18n/locales/*.json` under `workspace.apps.<id>`. The backend will own these rules (UI checks are not security).
 *
 * To add an application: add its id here (and to the `apps` strings), its roles, and how the card opens it.
 */

export type ApplicationId = 'hr-admin' | 'blogs-admin';

/** Every HR portal role uses HR Admin (the portal shows each role its own pages). */
const HR_ROLES: readonly WorkspaceRole[] = ['system-admin', 'hr-admin', 'hr-manager', 'department-manager', 'employee', 'recruiter', 'payroll-officer'];

export const APPLICATION_ACCESS: Record<ApplicationId, readonly WorkspaceRole[]> = {
  'hr-admin': HR_ROLES,
  'blogs-admin': ['blogs-admin', 'system-admin'],
};

/** Display order; `available` = the application is configured in this build. */
const APPLICATIONS: readonly { id: ApplicationId; available: boolean }[] = [
  { id: 'hr-admin', available: HR_ADMIN_PORTAL_URL !== undefined },
  { id: 'blogs-admin', available: ADMIN_ENABLED },
];

export const canOpen = (role: WorkspaceRole, app: ApplicationId): boolean => APPLICATION_ACCESS[app].includes(role);

/** The applications a role may open in this build, in display order. */
export function applicationsFor(role: WorkspaceRole): ApplicationId[] {
  return APPLICATIONS.filter((app) => app.available && canOpen(role, app.id)).map((app) => app.id);
}
