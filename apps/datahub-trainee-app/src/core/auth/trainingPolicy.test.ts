import { describe, expect, it } from 'vitest';
import { ROLES } from '@/core/domain/training';
import { canOpenTraineeApp } from './workspaceAccess';
import { LEARNER_ROLES, ROLE_PERMISSIONS, actorCan, canManageDepartment, isDepartmentScoped, isLearnerRole, isManagerRole, roleCan, type TrainingActor } from './trainingPolicy';

const actor = (role: TrainingActor['role'], departmentId: string | null = null): TrainingActor => ({ userId: 'u', fullName: 'Test', email: 't@example.test', role, departmentId });

describe('role / permission matrix (original Training Portal)', () => {
  it('SuperAdmin has every permission, including department management', () => {
    expect(ROLE_PERMISSIONS.SuperAdmin).toEqual(expect.arrayContaining(['departments.manage', 'users.manage', 'trainings.manage', 'enrollments.manage', 'evaluations.manage', 'rankings.view']));
  });

  it('DepartmentAdmin manages everything except departments', () => {
    expect(roleCan('DepartmentAdmin', 'users.manage')).toBe(true);
    expect(roleCan('DepartmentAdmin', 'trainings.manage')).toBe(true);
    expect(roleCan('DepartmentAdmin', 'enrollments.manage')).toBe(true);
    expect(roleCan('DepartmentAdmin', 'evaluations.manage')).toBe(true);
    expect(roleCan('DepartmentAdmin', 'rankings.view')).toBe(true);
    expect(roleCan('DepartmentAdmin', 'departments.manage')).toBe(false);
  });

  it('Trainee, Intern and Employee are three roles with IDENTICAL rights (as in the original)', () => {
    expect(ROLE_PERMISSIONS.Trainee).toEqual(ROLE_PERMISSIONS.Intern);
    expect(ROLE_PERMISSIONS.Intern).toEqual(ROLE_PERMISSIONS.Employee);
    for (const role of LEARNER_ROLES) {
      expect(roleCan(role, 'trainings.learn')).toBe(true);
      expect(roleCan(role, 'assignments.submit')).toBe(true);
      expect(roleCan(role, 'certificates.view')).toBe(true);
      for (const forbidden of ['users.manage', 'trainings.manage', 'enrollments.manage', 'evaluations.manage', 'rankings.view', 'departments.manage'] as const) {
        expect(roleCan(role, forbidden)).toBe(false);
      }
    }
  });

  it('only the five original roles exist (no Trainer role)', () => {
    expect([...ROLES]).toEqual(['SuperAdmin', 'DepartmentAdmin', 'Trainee', 'Employee', 'Intern']);
  });

  it('classifies roles', () => {
    expect(ROLES.filter(isManagerRole)).toEqual(['SuperAdmin', 'DepartmentAdmin']);
    expect(ROLES.filter(isLearnerRole)).toEqual(['Trainee', 'Employee', 'Intern']);
  });

  it('actorCan is false without an actor', () => {
    expect(actorCan(null, 'dashboard.view')).toBe(false);
    expect(actorCan(actor('Trainee'), 'dashboard.view')).toBe(true);
  });
});

describe('department boundaries', () => {
  it('SuperAdmin manages every department; DepartmentAdmin only their own', () => {
    expect(canManageDepartment(actor('SuperAdmin'), 'dep-1')).toBe(true);
    expect(canManageDepartment(actor('DepartmentAdmin', 'dep-1'), 'dep-1')).toBe(true);
    expect(canManageDepartment(actor('DepartmentAdmin', 'dep-1'), 'dep-2')).toBe(false);
    expect(canManageDepartment(actor('DepartmentAdmin', 'dep-1'), null)).toBe(false);
  });

  it('a DepartmentAdmin without a department manages nothing', () => {
    expect(canManageDepartment(actor('DepartmentAdmin', null), null)).toBe(false);
    expect(canManageDepartment(actor('DepartmentAdmin', null), 'dep-1')).toBe(false);
  });

  it('learners never manage a department', () => {
    expect(canManageDepartment(actor('Trainee', 'dep-1'), 'dep-1')).toBe(false);
  });

  it('only DepartmentAdmin is department-scoped', () => {
    expect(isDepartmentScoped(actor('DepartmentAdmin', 'd'))).toBe(true);
    expect(isDepartmentScoped(actor('SuperAdmin'))).toBe(false);
  });
});

describe('Workspace access is separate from training roles', () => {
  it('a training permission or any staff role lets a Workspace user open the app', () => {
    expect(canOpenTraineeApp({ roles: [], permissions: ['training.trainings.view'] })).toBe(true);
    expect(canOpenTraineeApp({ roles: ['employee'], permissions: [] })).toBe(true);
  });

  it('a token with no roles and no training permission cannot', () => {
    expect(canOpenTraineeApp({ roles: [], permissions: ['hr.leave.view'] })).toBe(false);
  });

  it('the policy module exposes no way to grant Workspace access', () => {
    // Business roles only answer "what can this person do inside the app" — there is no Workspace permission in them.
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].some((p) => p.startsWith('hr.') || p.startsWith('identity.') || p.startsWith('cms.'))).toBe(false);
    }
  });
});
