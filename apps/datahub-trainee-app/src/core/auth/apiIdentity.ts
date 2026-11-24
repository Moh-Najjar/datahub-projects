import type { Role } from '@/core/domain/training';
import { SESSION_STORAGE_KEY, type Session } from './authContext';
import type { TrainingActor, TrainingPermission } from './trainingPolicy';

/*
 * Training identity with the REAL backend (DATA_SOURCE `api`): everything comes from the Workspace access token — the
 * backend checks the same token on every request and enforces scope. The app's permission names stay the same, so
 * guards, navigation and screens don't change; this file is the one mapping from backend permissions to them.
 * (With the simulated backend, the mock directory and `trainingPolicy.ts` decide instead.)
 */

const anyOf = (granted: ReadonlySet<string>, ...names: string[]) => names.some((name) => granted.has(name));

/** The app's permissions granted by the token's backend permissions. */
export function trainingPermissionsFromToken(permissions: readonly string[]): TrainingPermission[] {
  const granted = new Set(permissions);
  const manages = anyOf(granted, 'academy.trainings.manage', 'training.courses.manage');
  const academyUser = permissions.some((p) => p.startsWith('academy.') || p.startsWith('training.'));
  const out: TrainingPermission[] = [];
  if (academyUser) out.push('dashboard.view');
  if (manages) out.push('trainings.manage');
  if (anyOf(granted, 'academy.enrollments.manage', 'training.enrollments.manage')) out.push('enrollments.manage');
  if (anyOf(granted, 'academy.evaluations.manage')) out.push('evaluations.manage');
  if (anyOf(granted, 'academy.evaluations.view', 'academy.reports.view')) out.push('rankings.view');
  if (anyOf(granted, 'identity.users.manage')) out.push('users.manage');
  if (anyOf(granted, 'organization.departments.manage')) out.push('departments.manage');
  // Learners: people who can see trainings but not manage them.
  if (!manages && anyOf(granted, 'academy.trainings.view', 'academy.materials.view', 'training.courses.view')) out.push('trainings.learn');
  if (!manages && anyOf(granted, 'academy.submissions.create')) out.push('assignments.submit');
  if (anyOf(granted, 'academy.certificates.view', 'training.certificates.issue') || out.includes('trainings.learn')) out.push('certificates.view');
  return out;
}

/**
 * The business role shown in the UI and used for learner/manager screens. The backend does not expose the original
 * portal's Academy roles per user yet, so: Workspace `system-admin` → SuperAdmin; other people who manage trainings →
 * DepartmentAdmin (department unknown → not scoped in the UI; the backend scopes); everyone else → Employee (a learner).
 */
export function roleFromToken(workspaceRoles: readonly string[], permissions: readonly TrainingPermission[]): Role {
  if (workspaceRoles.includes('system-admin')) return 'SuperAdmin';
  if (permissions.includes('trainings.manage')) return 'DepartmentAdmin';
  return 'Employee';
}

export function actorFromSession(session: Session): TrainingActor {
  const permissions = trainingPermissionsFromToken(session.permissions);
  return { userId: session.user.id, fullName: session.user.name || session.user.email, email: session.user.email, role: roleFromToken(session.user.workspaceRoles, permissions), departmentId: null };
}

/** The app permissions of this tab's signed-in session (for API services, which have no React context). */
export function currentTrainingPermissions(): TrainingPermission[] {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as Partial<Session>) : null;
    return Array.isArray(session?.permissions) ? trainingPermissionsFromToken(session.permissions) : [];
  } catch {
    return [];
  }
}
