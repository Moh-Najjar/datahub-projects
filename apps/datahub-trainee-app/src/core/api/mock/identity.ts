import type { TrainingActor } from '@/core/auth/trainingPolicy';
import { commit, db, newId } from './mockDatabase';
import type { DbUser, Role } from './dbTypes';

/*
 * MOCK identity mapping: how a signed-in Workspace user becomes a record of the simulated training directory.
 * This is the "mock authorization policy" — it is kept apart from Workspace authentication and it only ever affects
 * MOCK training data. It cannot grant any Workspace permission and never touches the Workspace identity.
 * A real training backend replaces it with its own user/role store.
 */

export interface WorkspaceProfile {
  email: string;
  name: string;
  /** The user's Workspace (backend) roles. */
  roles: readonly string[];
}

/**
 * Default training role of a Workspace user who has no record in the training directory:
 * Workspace `system-admin` → SuperAdmin, everyone else → Employee (a learner).
 */
export function defaultTrainingRole(workspaceRoles: readonly string[]): Role {
  return workspaceRoles.includes('system-admin') ? 'SuperAdmin' : 'Employee';
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The directory user for this Workspace user (matched by e-mail), created on first sign-in when missing. */
export function resolveMockIdentity(profile: WorkspaceProfile): string {
  const database = db();
  const existing = database.users.find((u) => sameEmail(u.email, profile.email));
  if (existing) return existing.id;
  const created: DbUser = {
    id: newId('usr'),
    fullName: profile.name || profile.email,
    email: profile.email.trim().replace(/\s+/g, ''),
    role: defaultTrainingRole(profile.roles),
    isActive: true,
    departmentId: null,
    createdAt: new Date().toISOString(),
  };
  database.users.push(created);
  commit();
  return created.id;
}

/** The actor for a directory user, or `null` when it does not exist (any more). */
export function actorForUser(userId: string): TrainingActor | null {
  const user = db().users.find((u) => u.id === userId);
  return user ? { userId: user.id, fullName: user.fullName, email: user.email, role: user.role, departmentId: user.departmentId } : null;
}

export interface SimulationProfile {
  userId: string;
  fullName: string;
  role: Role;
  departmentName: string | null;
}

/** Directory users a tester may "view as" (mock only). */
export function listSimulationProfiles(): SimulationProfile[] {
  const database = db();
  return database.users
    .filter((u) => u.isActive)
    .map((u) => ({
      userId: u.id,
      fullName: u.fullName,
      role: u.role,
      departmentName: database.departments.find((d) => d.id === u.departmentId)?.name ?? null,
    }));
}
