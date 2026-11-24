import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_EVALUATION_CATEGORIES } from '@/core/config/evaluationDefaults';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { compareRanking, evaluationMaxTotal, evaluationTotal, latestEvaluation } from '@/core/utils/scoring';
import { actAs } from '@/test/actors';
import { evaluationsMock } from './evaluationsMock';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const categories = (...scores: number[]) => scores.map((score, i) => ({ categoryName: `Category ${i + 1}`, criteria: `Criteria ${i + 1}`, score }));
const create = (userId: string, scores: number[], over: Record<string, unknown> = {}) => evaluationsMock.create(userId, { evaluatedAt: '2026-11-20T12:00:00.000Z', categories: categories(...scores), ...over });

describe('scoring rules (original, unchanged)', () => {
  it('the total is the SUM of the scores and the maximum is categories × 10', () => {
    expect(evaluationTotal([{ score: 8 }, { score: 7 }, { score: 10 }])).toBe(25);
    expect(evaluationMaxTotal([1, 2, 3])).toBe(30);
    expect(evaluationTotal([])).toBe(0);
  });

  it('there are ten default categories, as in the original', () => {
    expect(DEFAULT_EVALUATION_CATEGORIES).toHaveLength(10);
    expect(DEFAULT_EVALUATION_CATEGORIES[0]!.categoryName).toBe('Presentation Skills');
  });

  it('ranks evaluated people first, then by latest TOTAL (raw sum), then by name', () => {
    const entries = [
      { userName: 'Zed', latestTotal: null },
      { userName: 'Bea', latestTotal: 50 },
      { userName: 'Amy', latestTotal: 50 },
      { userName: 'Cal', latestTotal: 80 },
      { userName: 'Abe', latestTotal: null },
    ];
    expect([...entries].sort(compareRanking).map((e) => e.userName)).toEqual(['Cal', 'Amy', 'Bea', 'Abe', 'Zed']);
  });

  it('uses the evaluation with the latest date as the "latest"', () => {
    const latest = latestEvaluation([{ evaluatedAt: '2026-01-01', id: 'a' }, { evaluatedAt: '2026-03-01', id: 'b' }, { evaluatedAt: '2026-02-01', id: 'c' }]);
    expect(latest!.id).toBe('b');
    expect(latestEvaluation([])).toBeUndefined();
  });
});

describe('creating, editing and deleting evaluations', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('records an evaluation with its total and maximum', () => {
    const created = create(U.ziad, [9, 8, 7]);
    expect(created).toMatchObject({ userName: 'Ziad Tamimi', total: 24, maxTotal: 30, evaluatedByUserName: 'Omar Nasser', enrollmentId: null, departmentName: 'Data Engineering' });
    expect(created.categories.map((c) => c.categoryName)).toEqual(['Category 1', 'Category 2', 'Category 3']);
  });

  it('lists a person\'s history newest first, including seeded ones', () => {
    create(U.yousef, [10, 10]);
    const history = evaluationsMock.listForUser(U.yousef);
    expect(history).toHaveLength(3);
    const dates = history.map((e) => Date.parse(e.evaluatedAt));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('links an evaluation to one of the person\'s enrollments, and refuses someone else\'s', () => {
    const own = db().enrollments.find((e) => e.userId === U.ziad && e.trainingId === 'trn-0001')!;
    const created = create(U.ziad, [8], { enrollmentId: own.id });
    expect(created).toMatchObject({ enrollmentId: own.id, trainingId: 'trn-0001', trainingTitle: 'SQL & Data Modeling Foundations' });
    const others = db().enrollments.find((e) => e.userId === U.noor)!;
    expect(error(() => create(U.ziad, [8], { enrollmentId: others.id })).fieldErrors).toEqual({ enrollmentId: ['evaluation.enrollmentMismatch'] });
    expect(error(() => create(U.ziad, [8], { enrollmentId: 'enr-9999' })).code).toBe('NOT_FOUND');
  });

  it('enforces 1–10 whole-number scores, named categories and at least one category', () => {
    expect(error(() => create(U.ziad, [0])).fieldErrors).toEqual({ categories: ['evaluation.scoreInvalid'] });
    expect(error(() => create(U.ziad, [11])).fieldErrors).toEqual({ categories: ['evaluation.scoreInvalid'] });
    expect(error(() => create(U.ziad, [7.5])).fieldErrors).toEqual({ categories: ['evaluation.scoreInvalid'] });
    expect(error(() => create(U.ziad, [])).fieldErrors).toEqual({ categories: ['evaluation.categoriesRequired'] });
    expect(error(() => evaluationsMock.create(U.ziad, { evaluatedAt: '2026-11-20', categories: [{ categoryName: '', criteria: '', score: 5 }] })).fieldErrors).toEqual({ categories: ['evaluation.categoryInvalid'] });
    expect(error(() => evaluationsMock.create(U.ziad, { evaluatedAt: '2026-11-20', categories: [{ categoryName: 'x'.repeat(201), criteria: '', score: 5 }] })).code).toBe('VALIDATION');
    expect(error(() => evaluationsMock.create(U.ziad, { evaluatedAt: '2026-11-20', categories: [{ categoryName: 'ok', criteria: 'x'.repeat(1001), score: 5 }] })).code).toBe('VALIDATION');
    expect(create(U.ziad, [1, 10]).total).toBe(11);
    expect(error(() => create(U.ziad, [5], { evaluatedAt: 'not a date' })).fieldErrors).toEqual({ evaluatedAt: ['field.date'] });
  });

  it('only trainees, employees and interns can be evaluated', () => {
    expect(error(() => create(U.adminAi, [5])).fieldErrors).toEqual({ userId: ['evaluation.userNotEvaluable'] });
    actAs(U.superAdmin);
    expect(error(() => create(U.superAdmin, [5])).code).toBe('VALIDATION');
    expect(error(() => create('usr-9999', [5])).code).toBe('NOT_FOUND');
  });

  it('edits the date and categories, and deletes', () => {
    const created = create(U.ziad, [5, 5]);
    const edited = evaluationsMock.update(created.id, { evaluatedAt: '2026-11-21T12:00:00.000Z', categories: categories(9, 9, 9) });
    expect(edited).toMatchObject({ total: 27, maxTotal: 30 });
    expect(edited.updatedAt).not.toBeNull();
    evaluationsMock.remove(created.id);
    expect(evaluationsMock.listForUser(U.ziad).some((e) => e.id === created.id)).toBe(false);
    expect(error(() => evaluationsMock.update(created.id, { evaluatedAt: '2026-11-21', categories: categories(5) })).code).toBe('NOT_FOUND');
  });

  it('records the submission on the activity timeline', () => {
    create(U.ziad, [8]);
    expect(db().activities.find((a) => a.type === 'evaluation-submitted' && a.userId === U.ziad)).toBeTruthy();
  });
});

describe('department boundaries', () => {
  it('a DepartmentAdmin can evaluate people of their department, or enrollments of their own trainings', () => {
    actAs(U.adminDataEngineering);
    expect(create(U.lina, [8]).userName).toBe('Lina Barakat');
    // Yousef is enrolled in an AI training; Omar cannot evaluate against it
    const aiEnrollment = db().enrollments.find((e) => e.userId === U.yousef && e.trainingId === 'trn-0004')!;
    expect(error(() => create(U.yousef, [8], { enrollmentId: aiEnrollment.id })).code).toBe('FORBIDDEN');
  });

  it('cannot evaluate someone with no link to their department', () => {
    actAs(U.adminDataEngineering);
    expect(error(() => create(U.sara, [8])).reason).toBe('evaluation.outsideDepartment');
    expect(error(() => evaluationsMock.listForUser(U.sara)).code).toBe('FORBIDDEN');
  });

  it('cannot edit or delete an evaluation of another department', () => {
    actAs(U.adminDataEngineering);
    const other = db().evaluations.find((e) => e.userId === U.hadi)!;
    expect(error(() => evaluationsMock.update(other.id, { evaluatedAt: '2026-11-21', categories: categories(5) })).code).toBe('FORBIDDEN');
    expect(error(() => evaluationsMock.remove(other.id)).code).toBe('FORBIDDEN');
  });

  it('SuperAdmin can do everything', () => {
    actAs(U.superAdmin);
    expect(create(U.sara, [6, 7]).total).toBe(13);
  });

  it('learners cannot evaluate or read evaluations', () => {
    actAs(U.yousef);
    expect(error(() => evaluationsMock.listForUser(U.yousef)).code).toBe('FORBIDDEN');
    expect(error(() => create(U.noor, [5])).code).toBe('FORBIDDEN');
  });
});
