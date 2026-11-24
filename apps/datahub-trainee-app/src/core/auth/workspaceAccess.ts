import type { AccessTokenClaims } from './workspaceHandoff';

/*
 * WORKSPACE-level access: may this signed-in Workspace user OPEN the Trainee App at all?
 * This is separate from the app's business roles (`trainingPolicy.ts`), which only decide what a user can do INSIDE
 * the app. A business role can never grant Workspace access.
 *
 * The backend does not issue training permissions yet. Until it does, the same interim rule the website's launcher
 * uses applies (keep `apps/datahub-website/src/modules/portals/data/applications.ts` in sync):
 *   - the backend lists `trainee-app` among the user's portals (the website checks this), or
 *   - the token carries a `training.*` permission, or
 *   - INTERIM: any signed-in staff user with at least one backend role.
 * Remove the interim line once the backend issues `training.*` permissions.
 */

export const TRAINING_PERMISSION_PREFIX = 'training.';
export const INTERIM_OPEN_TO_ALL_STAFF = true;

export function canOpenTraineeApp(claims: Pick<AccessTokenClaims, 'roles' | 'permissions'>): boolean {
  if (claims.permissions.some((permission) => permission.startsWith(TRAINING_PERMISSION_PREFIX))) return true;
  return INTERIM_OPEN_TO_ALL_STAFF && claims.roles.length > 0;
}
