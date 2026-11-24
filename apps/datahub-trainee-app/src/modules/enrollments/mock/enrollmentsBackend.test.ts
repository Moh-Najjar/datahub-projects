import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { db, reloadMockDatabase } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { certificateReference, clampProgress, isCertificateEligible, statusForProgress, withProgress, withStatus } from '@/core/utils/enrollmentRules';
import { actAs } from '@/test/actors';
import { enrollmentsMock } from './enrollmentsMock';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const list = (over: Record<string, unknown> = {}) => enrollmentsMock.list({ page: 1, pageSize: 100, ...over });
const find = (trainingId: string, userId: string) => list({ filters: { trainingId, userId } }).items[0]!;

describe('assigning a training', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('creates an Assigned enrollment, recording who assigned it and when', () => {
    const created = enrollmentsMock.create({ trainingId: 'trn-0002', userId: U.lina });
    expect(created).toMatchObject({ status: 'assigned', progress: 0, completedAt: null, assignedByUserName: 'Omar Nasser', userName: 'Lina Barakat', trainingTitle: 'ETL Pipelines with Python' });
    expect(Date.parse(created.assignedAt)).toBeLessThanOrEqual(Date.now());
  });

  it('prevents duplicate assignments (Conflict)', () => {
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-0001', userId: U.yousef })).code).toBe('CONFLICT');
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-0001', userId: U.yousef })).reason).toBe('enrollment.duplicate');
    expect(list({ filters: { trainingId: 'trn-0001', userId: U.yousef } }).total).toBe(1);
  });

  it('records the enrollment on the activity timeline', () => {
    enrollmentsMock.create({ trainingId: 'trn-0002', userId: U.lina });
    expect(db().activities.find((a) => a.type === 'trainee-enrolled' && a.userId === U.lina && a.trainingId === 'trn-0002')).toBeTruthy();
  });

  it('only Intern, Trainee and Employee users can be enrolled', () => {
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-0002', userId: U.adminAi })).reason).toBe('enrollment.userRole');
    actAs(U.superAdmin);
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-0002', userId: U.superAdmin })).reason).toBe('enrollment.userRole');
  });

  it('refuses an unknown training or user', () => {
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-9999', userId: U.lina })).code).toBe('NOT_FOUND');
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-0002', userId: 'usr-9999' })).code).toBe('NOT_FOUND');
  });

  it('a DepartmentAdmin can assign only trainings of their own department — to users of any department', () => {
    expect(error(() => enrollmentsMock.create({ trainingId: 'trn-0004', userId: U.lina })).reason).toBe('enrollment.trainingOutsideDepartment');
    // original rule: assignable users are not limited to the admin's department
    expect(enrollmentsMock.create({ trainingId: 'trn-0002', userId: U.tariq }).userName).toBe('Tariq Awad');
  });
});

describe('listing: search, filter, sort, pagination', () => {
  beforeEach(() => actAs(U.superAdmin));

  it('orders by newest assignment first (original)', () => {
    const dates = list().items.map((e) => Date.parse(e.assignedAt));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('searches by person and training, filters by training and status', () => {
    expect(list({ search: 'noor' }).items.every((e) => e.userName === 'Noor Aldeen')).toBe(true);
    expect(list({ search: 'machine learning' }).items.every((e) => e.trainingTitle === 'Machine Learning Essentials')).toBe(true);
    expect(list({ filters: { trainingId: 'trn-0001' } }).total).toBe(4);
    expect(list({ filters: { status: 'completed' } }).items.every((e) => e.status === 'completed')).toBe(true);
    expect(list({ filters: { status: 'completed' } }).total).toBe(3);
  });

  it('sorts by progress and paginates', () => {
    const sorted = list({ sortBy: 'progress', sortDirection: 'desc' }).items.map((e) => e.progress);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
    const first = enrollmentsMock.list({ page: 1, pageSize: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.total).toBe(16);
    expect(first.totalPages).toBe(4);
  });

  it('a DepartmentAdmin sees only enrollments of their department\'s trainings', () => {
    actAs(U.adminAi);
    const items = list().items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((e) => e.departmentName === 'Artificial Intelligence')).toBe(true);
    // including people from other departments enrolled in the AI trainings (Yousef is from Data Engineering)
    expect(items.some((e) => e.userName === 'Yousef Darwish')).toBe(true);
  });

  it('learners cannot list enrollments', () => {
    actAs(U.yousef);
    expect(error(() => list()).code).toBe('FORBIDDEN');
  });
});

describe('status rules (original) and progress (added)', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('Completed stamps the completion date; any other status clears it', () => {
    const e = find('trn-0001', U.ziad);
    const done = enrollmentsMock.updateStatus(e.id, { status: 'completed' });
    expect(done).toMatchObject({ status: 'completed', progress: 100 });
    expect(done.completedAt).not.toBeNull();
    const reopened = enrollmentsMock.updateStatus(e.id, { status: 'in-progress' });
    expect(reopened).toMatchObject({ status: 'in-progress', completedAt: null });
    expect(reopened.progress).toBeGreaterThan(0);
    expect(reopened.progress).toBeLessThan(100);
    expect(enrollmentsMock.updateStatus(e.id, { status: 'assigned' })).toMatchObject({ status: 'assigned', progress: 0, completedAt: null });
  });

  it('any status can be set at any time (the original has no transition restrictions)', () => {
    const e = find('trn-0001', U.yousef);
    for (const status of ['completed', 'assigned', 'in-progress', 'completed', 'assigned'] as const) {
      expect(enrollmentsMock.updateStatus(e.id, { status }).status).toBe(status);
    }
  });

  it('refuses an unknown status', () => {
    expect(error(() => enrollmentsMock.updateStatus(find('trn-0001', U.ziad).id, { status: 'nope' as never })).code).toBe('VALIDATION');
  });

  it('progress moves the status: 0 Assigned, 1–99 In Progress, 100 Completed', () => {
    const e = find('trn-0001', U.ziad);
    expect(enrollmentsMock.updateProgress(e.id, { progress: 40 })).toMatchObject({ status: 'in-progress', progress: 40, completedAt: null });
    expect(enrollmentsMock.updateProgress(e.id, { progress: 0 })).toMatchObject({ status: 'assigned', progress: 0 });
  });

  it('reaching 100% completes the enrollment and records it', () => {
    const e = find('trn-0001', U.ziad);
    const done = enrollmentsMock.updateProgress(e.id, { progress: 100 });
    expect(done).toMatchObject({ status: 'completed', progress: 100 });
    expect(done.completedAt).not.toBeNull();
    expect(db().activities.find((a) => a.type === 'enrollment-completed' && a.userId === U.ziad)).toBeTruthy();
  });

  it('records progress updates on the timeline (and not for unchanged values)', () => {
    const e = find('trn-0001', U.ziad);
    enrollmentsMock.updateProgress(e.id, { progress: 25 });
    enrollmentsMock.updateProgress(e.id, { progress: 25 });
    expect(db().activities.filter((a) => a.type === 'progress-updated' && a.userId === U.ziad && a.progress === 25)).toHaveLength(1);
  });

  it('keeps an existing completion date when completing again', () => {
    const e = find('trn-0001', U.noor);
    expect(e.status).toBe('completed');
    const again = enrollmentsMock.updateProgress(e.id, { progress: 100 });
    expect(again.completedAt).toBe(e.completedAt);
  });

  it('refuses progress outside 0–100', () => {
    const e = find('trn-0001', U.ziad);
    expect(error(() => enrollmentsMock.updateProgress(e.id, { progress: 101 })).fieldErrors).toEqual({ progress: ['enrollment.progressInvalid'] });
    expect(error(() => enrollmentsMock.updateProgress(e.id, { progress: -1 })).code).toBe('VALIDATION');
  });

  it('a DepartmentAdmin cannot change another department\'s enrollment', () => {
    const other = (actAs(U.superAdmin), find('trn-0004', U.hadi));
    actAs(U.adminDataEngineering);
    expect(error(() => enrollmentsMock.updateProgress(other.id, { progress: 10 })).code).toBe('FORBIDDEN');
    expect(error(() => enrollmentsMock.updateStatus(other.id, { status: 'completed' })).code).toBe('FORBIDDEN');
    expect(error(() => enrollmentsMock.remove(other.id)).code).toBe('FORBIDDEN');
  });
});

describe('removing an enrollment', () => {
  it('deletes it, keeps the person\'s evaluations and unlinks them', () => {
    actAs(U.adminDataEngineering);
    const e = find('trn-0001', U.noor);
    const linked = db().evaluations.filter((x) => x.enrollmentId === e.id);
    expect(linked.length).toBe(1);
    enrollmentsMock.remove(e.id);
    reloadMockDatabase();
    expect(list({ filters: { trainingId: 'trn-0001', userId: U.noor } }).total).toBe(0);
    expect(db().evaluations.find((x) => x.id === linked[0]!.id)!.enrollmentId).toBeNull();
    // a new assignment is possible again
    expect(enrollmentsMock.create({ trainingId: 'trn-0001', userId: U.noor }).status).toBe('assigned');
  });
});

describe('pure enrollment rules', () => {
  it('clamps and maps progress to a status', () => {
    expect(clampProgress(150)).toBe(100);
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(33.6)).toBe(34);
    expect(clampProgress(Number.NaN)).toBe(0);
    expect([0, 1, 99, 100].map(statusForProgress)).toEqual(['assigned', 'in-progress', 'in-progress', 'completed']);
  });

  it('withStatus / withProgress agree with each other', () => {
    const now = '2026-11-23T10:00:00.000Z';
    expect(withStatus({ status: 'assigned', progress: 0, completedAt: null }, 'completed', now)).toEqual({ status: 'completed', progress: 100, completedAt: now });
    expect(withStatus({ status: 'completed', progress: 100, completedAt: '2026-01-01T00:00:00.000Z' }, 'in-progress', now)).toEqual({ status: 'in-progress', progress: 99, completedAt: null });
    expect(withProgress({ status: 'in-progress', progress: 50, completedAt: null }, 100, now).completedAt).toBe(now);
  });

  it('certificates exist only for completed enrollments and have a stable unique reference', () => {
    expect(isCertificateEligible({ status: 'completed' })).toBe(true);
    expect(isCertificateEligible({ status: 'in-progress' })).toBe(false);
    expect(certificateReference({ id: 'enr-0003', completedAt: '2026-11-12T15:00:00.000Z' })).toBe('DH-CERT-0003-20261112');
    expect(certificateReference({ id: 'enr-0003', completedAt: '2026-11-12T15:00:00.000Z' })).toBe(certificateReference({ id: 'enr-0003', completedAt: '2026-11-12T15:00:00.000Z' }));
    expect(certificateReference({ id: 'enr-0004', completedAt: '2026-11-12T15:00:00.000Z' })).not.toBe(certificateReference({ id: 'enr-0003', completedAt: '2026-11-12T15:00:00.000Z' }));
  });
});
