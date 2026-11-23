import type { WorkspaceSession } from '@/modules/portals/api/workspaceAuth';
import type { WorkspaceRole } from '@/modules/portals/data/roles';

/** The role to show under the user's name: the translated label, or the backend's role names. */
export const roleLabel = (session: WorkspaceSession, labels: Record<WorkspaceRole, string>): string => (session.role ? labels[session.role] : session.roles.join(', '));
