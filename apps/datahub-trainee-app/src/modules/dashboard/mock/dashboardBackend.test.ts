import { describe, expect, it } from 'vitest';
import { SEED_DEPARTMENTS, SEED_USERS as U } from '@/core/api/mock/seedData';
import { db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { setCurrentActor } from '@/core/auth/actor';
import { actAs } from '@/test/actors';
import { dashboardMock } from './dashboardMock';

const manager = () => {
  const data = dashboardMock.get();
  if (data.kind !== 'manager') throw new Error('expected the manager dashboard');
  return data;
};
const learner = () => {
  const data = dashboardMock.get();
  if (data.kind !== 'learner') throw new Error('expected the learner dashboard');
  return data;
};

describe('manager dashboard', () => {
  it('SuperAdmin sees the whole programme, and the figures agree with the records', () => {
    actAs(U.superAdmin);
    const { stats, statusBreakdown, scopeDepartmentName } = manager();
    expect(scopeDepartmentName).toBeNull();
    expect(stats.totalTrainings).toBe(db().trainings.length);
    expect(stats.publishedTrainings).toBe(db().trainings.filter((t) => t.status === 'published').length);
    expect(stats.totalEnrollments).toBe(db().enrollments.length);
    expect(stats.completedEnrollments).toBe(db().enrollments.filter((e) => e.status === 'completed').length);
    expect(stats.completionRate).toBeCloseTo((stats.completedEnrollments / stats.totalEnrollments) * 100, 5);
    expect(statusBreakdown.assigned + statusBreakdown.inProgress + statusBreakdown.completed).toBe(stats.totalEnrollments);
  });

  it('counts active trainees as active people with an unfinished enrollment', () => {
    actAs(U.superAdmin);
    const unfinished = new Set(db().enrollments.filter((e) => e.status !== 'completed').map((e) => e.userId));
    expect(manager().stats.activeTrainees).toBe(unfinished.size);
  });

  it('a DepartmentAdmin sees only their department', () => {
    actAs(U.adminDataEngineering);
    const data = manager();
    expect(data.scopeDepartmentName).toBe('Data Engineering');
    expect(data.stats.totalTrainings).toBe(3);
    expect(data.stats.totalEnrollments).toBe(6);
    expect(data.trainingProgress.every((p) => ['trn-0001', 'trn-0002', 'trn-0003'].includes(p.trainingId))).toBe(true);
  });

  it('shows average progress of the most-enrolled trainings', () => {
    actAs(U.superAdmin);
    const first = manager().trainingProgress[0]!;
    expect(first.trainingId).toBe('trn-0001');
    expect(first.enrollments).toBe(4);
    expect(first.averageProgress).toBeCloseTo((60 + 100 + 80 + 0) / 4, 5);
  });

  it('lists upcoming deadlines: open assignments closing soon and published trainings ending soon', () => {
    actAs(U.superAdmin);
    const deadlines = manager().deadlines;
    expect(deadlines.map((d) => d.id)).toContain('assignment-asg-0004'); // closes in 3 days
    expect(deadlines.map((d) => d.id)).toContain('assignment-asg-0001'); // closes in 5 days
    expect(deadlines.map((d) => d.id)).not.toContain('assignment-asg-0003'); // already closed
    expect(deadlines.map((d) => d.id)).not.toContain('assignment-asg-0002'); // not open yet
    const times = deadlines.map((d) => Date.parse(d.kind === 'training' ? `${d.dueAt}T23:59:59` : d.dueAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('counts every upcoming deadline ("due soon"), while the list shows the soonest six', () => {
    actAs(U.superAdmin);
    const data = manager();
    expect(data.stats.dueSoon).toBeGreaterThanOrEqual(data.deadlines.length);
    expect(data.deadlines.length).toBe(Math.min(6, data.stats.dueSoon));
  });

  it('filters by department (SuperAdmin) and by the period in which enrollments were assigned', () => {
    actAs(U.superAdmin);
    const dep = SEED_DEPARTMENTS.dataEngineering;
    const byDepartment = dashboardMock.get({ departmentId: dep, period: 'all' });
    if (byDepartment.kind !== 'manager') throw new Error('expected the manager dashboard');
    expect(byDepartment.stats.totalTrainings).toBe(db().trainings.filter((t) => t.departmentId === dep).length);
    const depTrainings = new Set(db().trainings.filter((t) => t.departmentId === dep).map((t) => t.id));
    expect(byDepartment.stats.totalEnrollments).toBe(db().enrollments.filter((e) => depTrainings.has(e.trainingId)).length);
    expect(dashboardMock.recentActivity(50, dep).every((a) => db().activities.find((x) => x.id === a.id)?.departmentId === dep)).toBe(true);

    const now = Date.now();
    const recent = dashboardMock.get({ departmentId: null, period: '30' }, now);
    if (recent.kind !== 'manager') throw new Error('expected the manager dashboard');
    expect(recent.stats.totalEnrollments).toBe(db().enrollments.filter((e) => Date.parse(e.assignedAt) >= now - 30 * 86_400_000).length);
  });

  it('refuses a DepartmentAdmin another department in the filter', () => {
    actAs(U.adminDataEngineering);
    expect(() => dashboardMock.get({ departmentId: SEED_DEPARTMENTS.cloud, period: 'all' })).toThrow(ApiError);
    expect(() => dashboardMock.recentActivity(10, SEED_DEPARTMENTS.cloud)).toThrow(ApiError);
  });

  it('lists each training row with its status and end date (for the trainings table)', () => {
    actAs(U.superAdmin);
    for (const row of manager().trainingProgress) {
      const training = db().trainings.find((t) => t.id === row.trainingId)!;
      expect(row.status).toBe(training.status);
      expect(row.endDate).toBe(training.endDate);
    }
  });
});

describe('learner dashboard', () => {
  it('shows only the learner\'s own figures', () => {
    actAs(U.noor);
    const data = learner();
    expect(data.stats).toMatchObject({ enrolled: 2, completed: 1, inProgress: 1, certificates: 1 });
    expect(data.stats.averageProgress).toBeCloseTo((100 + 35) / 2, 5);
    expect(data.current.map((c) => c.trainingId)).toEqual(['trn-0002']);
  });

  it('only lists deadlines of unfinished trainings and assignments not yet submitted', () => {
    actAs(U.noor); // already submitted asg-0001, completed trn-0001
    expect(learner().deadlines.map((d) => d.id)).not.toContain('assignment-asg-0001');
    actAs(U.yousef); // has not submitted asg-0001
    expect(learner().deadlines.map((d) => d.id)).toContain('assignment-asg-0001');
  });

  it('is different from the manager dashboard (not the same view for everyone)', () => {
    actAs(U.noor);
    expect(dashboardMock.get().kind).toBe('learner');
    actAs(U.adminAi);
    expect(dashboardMock.get().kind).toBe('manager');
  });

  it('requires a signed-in user', () => {
    setCurrentActor(null);
    expect(() => dashboardMock.get()).toThrow(ApiError);
  });
});

describe('activity timeline', () => {
  it('shows the newest events first, scoped by role', () => {
    actAs(U.superAdmin);
    const all = dashboardMock.recentActivity(50);
    const times = all.map((a) => Date.parse(a.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(all.length).toBe(db().activities.length);

    actAs(U.adminAi);
    expect(dashboardMock.recentActivity(50).every((a) => ['Rania Khoury', 'Omar Nasser', 'Layla Haddad'].includes(a.actorName))).toBe(true);
    expect(dashboardMock.recentActivity(50).length).toBeLessThan(all.length);

    actAs(U.hadi);
    const mine = dashboardMock.recentActivity(50);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((a) => a.userName === 'Hadi Mansour')).toBe(true);
  });

  it('respects the limit', () => {
    actAs(U.superAdmin);
    expect(dashboardMock.recentActivity(3)).toHaveLength(3);
  });
});
