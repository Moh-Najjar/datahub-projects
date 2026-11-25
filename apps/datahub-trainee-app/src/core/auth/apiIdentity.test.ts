import { describe, expect, it } from 'vitest';
import { roleFromToken, trainingPermissionsFromToken } from './apiIdentity';

const learner = trainingPermissionsFromToken(['academy.trainings.view', 'academy.materials.view', 'academy.submissions.create']);
const manager = trainingPermissionsFromToken(['academy.trainings.manage', 'academy.enrollments.manage']);

describe('role from the Workspace token (real backend)', () => {
  it("uses the account's own role name: trainee, intern, employee, department admin", () => {
    expect(roleFromToken(['trainee'], learner)).toBe('Trainee');
    expect(roleFromToken(['Intern'], learner)).toBe('Intern');
    expect(roleFromToken(['employee'], learner)).toBe('Employee');
    expect(roleFromToken(['department-admin'], manager)).toBe('DepartmentAdmin');
    expect(roleFromToken(['Department_Admin'], manager)).toBe('DepartmentAdmin');
  });

  it('system-admin is SuperAdmin; with several roles the most privileged wins', () => {
    expect(roleFromToken(['system-admin'], manager)).toBe('SuperAdmin');
    expect(roleFromToken(['trainee', 'system-admin'], manager)).toBe('SuperAdmin');
    expect(roleFromToken(['intern', 'trainee'], learner)).toBe('Trainee');
  });

  it('other role names fall back to the permissions: managers → DepartmentAdmin, everyone else → Employee', () => {
    expect(roleFromToken(['hr-manager'], manager)).toBe('DepartmentAdmin');
    expect(roleFromToken(['recruiter'], learner)).toBe('Employee');
    expect(roleFromToken([], [])).toBe('Employee');
  });
});
