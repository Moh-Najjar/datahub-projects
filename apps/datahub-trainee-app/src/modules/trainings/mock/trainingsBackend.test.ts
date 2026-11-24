import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_DEPARTMENTS as D, SEED_USERS as U } from '@/core/api/mock/seedData';
import { commit, db, reloadMockDatabase } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { setCurrentActor } from '@/core/auth/actor';
import { actAs } from '@/test/actors';
import { trainingsMock } from './trainingsMock';

const page = (over: Record<string, unknown> = {}) => ({ page: 1, pageSize: 50, ...over });
const input = (over: Record<string, unknown> = {}) => ({ title: 'Cloud Security Basics', description: 'Identity, networks and secrets.', departmentId: D.cloud, startDate: null, endDate: null, durationHours: null, ...over });
const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};

describe('creating a training', () => {
  beforeEach(() => actAs(U.superAdmin));

  it('starts as a Draft, with the signed-in user as trainer, last in its department', () => {
    const before = db().trainings.filter((t) => t.departmentId === D.cloud).length;
    const created = trainingsMock.create(input());
    expect(created.status).toBe('draft');
    expect(created.trainerId).toBe(U.superAdmin);
    expect(created.trainerName).toBe('Layla Haddad');
    // original rule: sortOrder = highest in the department + 1
    const maxOther = Math.max(...db().trainings.filter((t) => t.departmentId === D.cloud && t.id !== created.id).map((t) => t.sortOrder));
    expect(created.sortOrder).toBe(maxOther + 1);
    expect(db().trainings.filter((t) => t.departmentId === D.cloud)).toHaveLength(before + 1);
  });

  it('persists across a refresh', () => {
    const created = trainingsMock.create(input({ title: 'Survives refresh' }));
    reloadMockDatabase();
    expect(trainingsMock.get(created.id).title).toBe('Survives refresh');
  });

  it('records the creation on the activity timeline', () => {
    const created = trainingsMock.create(input());
    expect(db().activities.find((a) => a.type === 'training-created' && a.trainingId === created.id)).toMatchObject({ actorId: U.superAdmin });
  });

  it('validates the original rules: title ≤ 200 and required, description required, department must exist', () => {
    expect(error(() => trainingsMock.create(input({ title: '   ' }))).fieldErrors).toEqual({ title: ['field.required'] });
    expect(error(() => trainingsMock.create(input({ title: 'x'.repeat(201) }))).fieldErrors).toEqual({ title: ['field.tooLong'] });
    expect(error(() => trainingsMock.create(input({ description: '' }))).fieldErrors).toEqual({ description: ['field.required'] });
    expect(error(() => trainingsMock.create(input({ departmentId: 'dep-nope' }))).code).toBe('NOT_FOUND');
  });

  it('validates the optional dates and duration', () => {
    expect(error(() => trainingsMock.create(input({ startDate: '2026-12-10', endDate: '2026-12-01' }))).fieldErrors).toEqual({ endDate: ['training.endBeforeStart'] });
    expect(error(() => trainingsMock.create(input({ durationHours: 0 }))).fieldErrors).toEqual({ durationHours: ['training.durationInvalid'] });
    expect(trainingsMock.create(input({ startDate: '2026-12-01', endDate: '2026-12-10', durationHours: 12 })).durationHours).toBe(12);
  });
});

describe('editing, publishing and deleting', () => {
  beforeEach(() => actAs(U.superAdmin));

  it('edits the title, description and status', () => {
    const updated = trainingsMock.update('trn-0003', { title: 'Data Quality, Revised', description: 'New text', status: 'published', startDate: null, endDate: null, durationHours: 12 });
    expect(updated).toMatchObject({ title: 'Data Quality, Revised', status: 'published' });
  });

  it('records publishing once, when the status changes to Published', () => {
    trainingsMock.update('trn-0003', { title: 'T', description: 'D', status: 'published', startDate: null, endDate: null, durationHours: null });
    trainingsMock.update('trn-0003', { title: 'T2', description: 'D', status: 'published', startDate: null, endDate: null, durationHours: null });
    expect(db().activities.filter((a) => a.type === 'training-published' && a.trainingId === 'trn-0003')).toHaveLength(1);
  });

  it('can unpublish back to a draft', () => {
    const t = trainingsMock.get('trn-0001');
    const back = trainingsMock.update(t.id, { title: t.title, description: t.description, status: 'draft', startDate: t.startDate, endDate: t.endDate, durationHours: t.durationHours });
    expect(back.status).toBe('draft');
  });

  it('refuses an unknown status', () => {
    const t = trainingsMock.get('trn-0001');
    expect(error(() => trainingsMock.update(t.id, { title: t.title, description: t.description, status: 'weird' as never, startDate: null, endDate: null, durationHours: null })).fieldErrors).toEqual({ status: ['training.statusInvalid'] });
  });

  it('deleting removes the content, assignments, submissions and enrollments with it', () => {
    expect(db().materials.some((m) => m.trainingId === 'trn-0001')).toBe(true);
    expect(db().enrollments.some((e) => e.trainingId === 'trn-0001')).toBe(true);
    const evaluationEnrollment = db().evaluations.find((e) => e.enrollmentId && db().enrollments.find((x) => x.id === e.enrollmentId)?.trainingId === 'trn-0001');
    trainingsMock.remove('trn-0001');
    expect(db().trainings.some((t) => t.id === 'trn-0001')).toBe(false);
    expect(db().materials.some((m) => m.trainingId === 'trn-0001')).toBe(false);
    expect(db().assignments.some((a) => a.trainingId === 'trn-0001')).toBe(false);
    expect(db().submissions.some((s) => s.assignmentId === 'asg-0001')).toBe(false);
    expect(db().enrollments.some((e) => e.trainingId === 'trn-0001')).toBe(false);
    // evaluations of those enrollments are kept, just unlinked
    if (evaluationEnrollment) expect(db().evaluations.find((e) => e.id === evaluationEnrollment.id)!.enrollmentId).toBeNull();
    expect(error(() => trainingsMock.get('trn-0001')).code).toBe('NOT_FOUND');
  });
});

describe('listing: search, filter, sort, pagination', () => {
  beforeEach(() => actAs(U.superAdmin));

  it('orders by the manual order, then newest first (original)', () => {
    const list = trainingsMock.list(page({ filters: { departmentId: D.dataEngineering } })).items;
    expect(list.map((t) => t.id)).toEqual(['trn-0001', 'trn-0002', 'trn-0003']);
  });

  it('searches title, description, trainer and department', () => {
    expect(trainingsMock.list(page({ search: 'power bi' })).items.map((t) => t.id)).toEqual(['trn-0008']);
    expect(trainingsMock.list(page({ search: 'Rania' })).items.every((t) => t.trainerName === 'Rania Khoury')).toBe(true);
  });

  it('filters by status and department', () => {
    expect(trainingsMock.list(page({ filters: { status: 'archived' } })).items.map((t) => t.id)).toEqual(['trn-0007']);
    expect(trainingsMock.list(page({ filters: { departmentId: D.ai, status: 'published' } })).items.map((t) => t.id)).toEqual(['trn-0004', 'trn-0005']);
  });

  it('sorts by title, enrollments and creation date in both directions', () => {
    const asc = trainingsMock.list(page({ sortBy: 'title', sortDirection: 'asc' })).items.map((t) => t.title);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    const desc = trainingsMock.list(page({ sortBy: 'enrollments', sortDirection: 'desc' })).items.map((t) => t.enrollmentCount);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('paginates', () => {
    const first = trainingsMock.list({ page: 1, pageSize: 4 });
    const second = trainingsMock.list({ page: 2, pageSize: 4 });
    expect(first.total).toBe(10);
    expect(first.totalPages).toBe(3);
    expect(first.items).toHaveLength(4);
    expect(second.items.map((t) => t.id)).not.toEqual(first.items.map((t) => t.id));
  });

  it('shows enrollment counts and completions', () => {
    const t = trainingsMock.get('trn-0001');
    expect(t.enrollmentCount).toBe(4);
    expect(t.completedCount).toBe(1);
  });
});

describe('manual order (drag and drop)', () => {
  beforeEach(() => actAs(U.superAdmin));

  it('stores the new positions', () => {
    trainingsMock.reorder({ orderedIds: ['trn-0003', 'trn-0001', 'trn-0002'] });
    const order = trainingsMock.list(page({ filters: { departmentId: D.dataEngineering } })).items.map((t) => t.id);
    expect(order).toEqual(['trn-0003', 'trn-0001', 'trn-0002']);
  });

  it('refuses an unknown training', () => {
    expect(error(() => trainingsMock.reorder({ orderedIds: ['trn-0001', 'trn-9999'] })).code).toBe('NOT_FOUND');
  });

  it('leaves the order untouched when any item is refused', () => {
    actAs(U.adminDataEngineering);
    const before = db().trainings.map((t) => [t.id, t.sortOrder]);
    expect(error(() => trainingsMock.reorder({ orderedIds: ['trn-0002', 'trn-0004'] })).code).toBe('FORBIDDEN');
    expect(db().trainings.map((t) => [t.id, t.sortOrder])).toEqual(before);
  });
});

describe('department boundaries (DepartmentAdmin)', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('sees only trainings of their own department', () => {
    const list = trainingsMock.list(page()).items;
    expect(list.length).toBe(3);
    expect(list.every((t) => t.departmentId === D.dataEngineering)).toBe(true);
  });

  it('cannot ask for another department', () => {
    expect(error(() => trainingsMock.list(page({ filters: { departmentId: D.ai } }))).code).toBe('FORBIDDEN');
  });

  it('cannot open, create in, edit, delete or reorder another department\'s training', () => {
    expect(error(() => trainingsMock.get('trn-0004')).code).toBe('FORBIDDEN');
    expect(error(() => trainingsMock.create(input({ departmentId: D.ai }))).reason).toBe('training.outsideDepartment');
    expect(error(() => trainingsMock.update('trn-0004', { title: 'x', description: 'y', status: 'draft', startDate: null, endDate: null, durationHours: null })).code).toBe('FORBIDDEN');
    expect(error(() => trainingsMock.remove('trn-0004')).code).toBe('FORBIDDEN');
  });

  it('can create in their own department', () => {
    expect(trainingsMock.create(input({ departmentId: D.dataEngineering })).departmentId).toBe(D.dataEngineering);
  });
});

describe('learners (Trainee / Intern / Employee)', () => {
  it('see only PUBLISHED trainings they are ENROLLED in', () => {
    // Ziad is enrolled only in trn-0001.
    actAs(U.ziad);
    expect(trainingsMock.list(page()).items.map((t) => t.id)).toEqual(['trn-0001']);
    expect(trainingsMock.get('trn-0001').myEnrollment).toMatchObject({ status: 'assigned', progress: 0 });
  });

  it('cannot open a training they are not enrolled in', () => {
    actAs(U.ziad);
    expect(error(() => trainingsMock.get('trn-0002')).reason).toBe('training.notEnrolled');
  });

  it('cannot open an enrolled training that is not published', () => {
    actAs(U.superAdmin);
    db().enrollments.push({ id: 'enr-x', trainingId: 'trn-0003', userId: U.ziad, assignedByUserId: U.superAdmin, status: 'assigned', progress: 0, assignedAt: new Date().toISOString(), completedAt: null });
    commit();
    actAs(U.ziad);
    expect(error(() => trainingsMock.get('trn-0003')).reason).toBe('training.notPublished');
    expect(trainingsMock.list(page()).items.map((t) => t.id)).not.toContain('trn-0003');
  });

  it('cannot create, edit, delete or reorder', () => {
    actAs(U.yousef);
    expect(error(() => trainingsMock.create(input({ departmentId: D.dataEngineering }))).code).toBe('FORBIDDEN');
    expect(error(() => trainingsMock.remove('trn-0001')).code).toBe('FORBIDDEN');
    expect(error(() => trainingsMock.reorder({ orderedIds: ['trn-0001'] })).code).toBe('FORBIDDEN');
    expect(error(() => trainingsMock.options()).code).toBe('FORBIDDEN');
    expect(error(() => trainingsMock.roster('trn-0001')).code).toBe('FORBIDDEN');
  });

  it('every call is UNAUTHORIZED without a signed-in user', () => {
    setCurrentActor(null);
    expect(error(() => trainingsMock.list(page())).code).toBe('UNAUTHORIZED');
    expect(error(() => trainingsMock.get('trn-0001')).code).toBe('UNAUTHORIZED');
    expect(error(() => trainingsMock.create(input())).code).toBe('UNAUTHORIZED');
  });
});

describe('roster', () => {
  it('lists the people enrolled in a training with their progress (staff only)', () => {
    actAs(U.adminDataEngineering);
    const roster = trainingsMock.roster('trn-0001');
    expect(roster.map((r) => r.userName)).toEqual(['Lina Barakat', 'Noor Aldeen', 'Yousef Darwish', 'Ziad Tamimi']);
    expect(roster.find((r) => r.userName === 'Noor Aldeen')).toMatchObject({ status: 'completed', progress: 100 });
  });
});
