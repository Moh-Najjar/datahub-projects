import type { AccessTokenClaims } from './workspaceHandoff';

/*
 * WORKSPACE-level access: may this signed-in Workspace user OPEN the Trainee App at all?
 * This is separate from the app's business roles (`trainingPolicy.ts`), which only decide what a user can do INSIDE
 * the app. A business role can never grant Workspace access.
 *
 * The Workspace (website) opens this app only for users whose backend portal list includes `academy-admin`
 * (`GET /api/v1/auth/portals`). This app cannot ask the backend itself yet (the API's CORS list does not include its
 * origins — 2026-11-24) and the token carries no training permission, so here:
 *   - the token carries a `training.*` permission, or
 *   - INTERIM: any signed-in staff user with at least one backend role (entry is through the Workspace's backend check).
 * Replace the interim line with a portals check (or a `training.*` permission) once the backend allows this origin.
 */

export const TRAINING_PERMISSION_PREFIX = 'training.';
export const INTERIM_OPEN_TO_ALL_STAFF = true;

export function canOpenTraineeApp(claims: Pick<AccessTokenClaims, 'roles' | 'permissions'>): boolean {
  if (claims.permissions.some((permission) => permission.startsWith(TRAINING_PERMISSION_PREFIX))) return true;
  return INTERIM_OPEN_TO_ALL_STAFF && claims.roles.length > 0;
}
