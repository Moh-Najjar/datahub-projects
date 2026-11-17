import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { employeeRecords, resetEmployeesMock } from '@/modules/employees/mock/employeesMock';
import { performanceApi as api } from '@/modules/performance/api/performanceApi';
import type { CycleInput, GoalInput, ManagerReviewInput, PerformanceScope, PlanInput, Review, SelfAssessmentInput } from '@/modules/performance/types/performance';
import { addDays } from '@/modules/performance/utils/rules';
import { resetPerformanceMock } from './performanceMock';

/* The simulated performance backend on a fixed clock: Monday 16 Nov 2026, 10:30 (local). */
const NOW = new Date(2026, 10, 16, 10, 30);
const TODAY = '2026-11-16';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetPerformanceMock();
  resetEmployeesMock();
});
afterEach(() => vi.useRealTimers());

const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
function scopeOf(role: Role): PerformanceScope {
  const kind = ['system-admin', 'hr-admin', 'hr-manager'].includes(role) ? 'organization' : role === 'department-manager' ? 'team' : 'own';
  return { kind, userId: users[role], role };
}
const HR = scopeOf('hr-admin');
const HRM = scopeOf('hr-manager');
const MANAGER = scopeOf('department-manager'); // Dana Yousef (emp-0001), Engineering
const EMPLOYEE = scopeOf('employee'); // Sami Odeh (emp-0025)
const ALL = { page: 1, pageSize: 100 } as const;

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}
const reasons = async (p: Promise<unknown>) => (await rejection(p)).fieldErrors;
const code = async (p: Promise<unknown>) => (await rejection(p)).code;

async function currentCycle() {
  return (await api.getReviewCycles({ ...ALL, filters: { status: 'in-progress' } }, HR)).items[0]!;
}
async function myReview(): Promise<Review> {
  const cycle = await currentCycle();
  const own = (await api.getReviews({ ...ALL, filters: { cycleId: cycle.id } }, EMPLOYEE)).items[0]!;
  return api.getReviewById(own.id, EMPLOYEE);
}
const selfInput = (r: Review, patch: Partial<SelfAssessmentInput> = {}): SelfAssessmentInput => ({
  goalRatings: r.goals.map((g) => ({ goalId: g.id, rating: 4, comment: '' })),
  achievements: 'Shipped the onboarding flow.',
  challenges: 'Scope changes.',
  comments: '',
  submit: true,
  ...patch,
});
const managerInput = (r: Review, patch: Partial<ManagerReviewInput> = {}): ManagerReviewInput => ({
  goalRatings: r.goals.map((g) => ({ goalId: g.id, rating: 4, comment: '' })),
  competencyRatings: r.competencies.map((c) => ({ competencyId: c.id, rating: 3, comment: '' })),
  strengths: 'Reliable.',
  improvements: 'Delegate more.',
  development: 'Lead a small project.',
  comments: '',
  overallRating: 4,
  submit: true,
  ...patch,
});

describe('dataset', () => {
  it('overview figures come from the same reviews', async () => {
    const s = await api.getPerformanceSummary(HR);
    const cycle = await currentCycle();
    const reviews = (await api.getReviews({ page: 1, pageSize: 1, filters: { cycleId: cycle.id } }, HR)).total;
    expect(s.inReview).toBe(reviews);
    expect(s.pendingSelf + s.pendingManager + s.completed).toBe(reviews);
    expect(s.completed).toBe((await api.getReviews({ page: 1, pageSize: 1, filters: { cycleId: cycle.id, state: 'completed' } }, HR)).total);
    expect(s.trend.map((t) => t.cycle.name.en)).toEqual(['Annual Review 2024', 'Annual Review 2025', 'Mid-Year Review 2026', 'Year-End Review 2026']);
    for (const t of s.trend.slice(0, 3)) expect(t.average).toBeGreaterThan(0);
    const scale = s.scale.map((l) => l.value);
    expect(scale).toEqual([1, 2, 3, 4, 5]);
    expect(s.distribution.reduce((a, b) => a + b.count, 0)).toBeGreaterThan(0);
  });

  it('closed cycles keep their complete history', async () => {
    const closed = (await api.getReviewCycles({ ...ALL, filters: { status: 'closed' } }, HR)).items;
    expect(closed).toHaveLength(2);
    for (const c of closed) expect(c.progress.managerSubmitted).toBe(c.progress.total);
  });
});

describe('review cycles', () => {
  const input = (patch: Partial<CycleInput> = {}): CycleInput => ({
    name: { en: 'Quarterly check-in 2027 Q1', ar: 'مراجعة الربع الأول 2027' },
    description: '',
    startDate: '2027-04-01',
    endDate: '2027-04-30',
    periodStart: '2027-01-01',
    periodEnd: '2027-03-31',
    selfAssessmentDeadline: '2027-04-10',
    managerReviewDeadline: '2027-04-20',
    templateId: 'tpl-01',
    ...patch,
  });

  it('validates dates and refuses overlapping review periods', async () => {
    expect(await reasons(api.createReviewCycle(input({ selfAssessmentDeadline: '2027-05-10', managerReviewDeadline: '2027-04-05' }), HR))).toEqual({ selfAssessmentDeadline: ['deadlineOutsideCycle'], managerReviewDeadline: ['managerBeforeSelf'] });
    // The draft "Annual Review 2027" already covers 2027.
    expect(await reasons(api.createReviewCycle(input(), HR))).toEqual({ periodStart: ['periodOverlap'] });
  });

  it('draft → edit → assign → activate (reviews created) → close; configuration needs manage-config', async () => {
    const draft = (await api.getReviewCycles({ ...ALL, filters: { status: 'draft' } }, HR)).items[0]!;
    expect(await reasons(api.updateReviewCycleStatus(draft.id, 'active', '', HR))).toEqual({ status: ['noParticipants'] });
    await api.assignCycleParticipants(draft.id, { add: ['emp-0025', 'emp-0030'], remove: [] }, HR);
    const active = await api.updateReviewCycleStatus(draft.id, 'active', '', HR);
    expect(active).toMatchObject({ status: 'active', participants: 2, progress: { total: 2 } });
    expect(await code(api.updateReviewCycle(draft.id, { ...input(), periodStart: '2028-01-01', periodEnd: '2028-12-31' }, HR))).toBe('CONFLICT'); // only drafts are edited
    expect((await api.updateReviewCycleStatus(draft.id, 'closed', 'Cancelled for the demo', HR)).status).toBe('closed');
    expect(await code(api.updateReviewCycleStatus(draft.id, 'active', '', HR))).toBe('CONFLICT');
    expect(await code(api.createReviewCycle(input({ periodStart: '2030-01-01', periodEnd: '2030-03-31' }), HRM))).toBe('FORBIDDEN'); // HR Manager: no configuration
  });

  it('the cycle becomes "in progress" on the first submission and "completed" when every manager review is in', async () => {
    const draft = (await api.getReviewCycles({ ...ALL, filters: { status: 'draft' } }, HR)).items[0]!;
    await api.assignCycleParticipants(draft.id, { add: ['emp-0025'], remove: [] }, HR);
    await api.updateReviewCycleStatus(draft.id, 'active', '', HR);
    const reviewId = (await api.getReviews({ ...ALL, filters: { cycleId: draft.id } }, HR)).items[0]!.id;
    const review = await api.getReviewById(reviewId, EMPLOYEE);
    await api.submitSelfAssessment(reviewId, selfInput(review), EMPLOYEE);
    expect((await api.getReviewCycleById(draft.id, HR)).status).toBe('in-progress');
    await api.submitManagerReview(reviewId, managerInput(review), MANAGER);
    expect((await api.getReviewCycleById(draft.id, HR)).status).toBe('completed');
    await api.reopenReview(reviewId, 'manager', HR);
    expect((await api.getReviewCycleById(draft.id, HR)).status).toBe('in-progress');
  });
});

describe('goals', () => {
  const input = (patch: Partial<GoalInput> = {}): GoalInput => ({ title: 'Improve onboarding', description: '', category: 'business', ownerType: 'employee', employeeId: 'emp-0025', departmentId: '', cycleId: null, startDate: TODAY, dueDate: addDays(TODAY, 60), target: 'Onboard 5 customers', priority: 'medium', ...patch });

  it('managers create goals for their team only; employees cannot create', async () => {
    const goal = await api.createGoal(input(), MANAGER);
    expect(goal).toMatchObject({ status: 'not-started', progress: 0, owner: { id: 'emp-0025' } });
    const outsider = employeeRecords.all().find((e) => e.status === 'active' && !employeeRecords.teamUnits(users['department-manager']).has(e.departmentId))!;
    expect(await code(api.createGoal(input({ employeeId: outsider.id }), MANAGER))).toBe('FORBIDDEN');
    expect(await code(api.createGoal(input(), EMPLOYEE))).toBe('FORBIDDEN');
    expect(await reasons(api.createGoal(input({ dueDate: addDays(TODAY, -1) }), HR))).toEqual({ dueDate: ['dueBeforeStart'] });
  });

  it('progress stays within 0–100; completed means 100%; final statuses are locked; history records every change', async () => {
    const goal = await api.createGoal(input(), HR);
    expect(await reasons(api.updateGoalProgress(goal.id, { progress: 120, status: 'in-progress', note: '' }, EMPLOYEE))).toEqual({ progress: ['progressRange'] });
    expect(await reasons(api.updateGoalProgress(goal.id, { progress: -5, status: 'in-progress', note: '' }, EMPLOYEE))).toEqual({ progress: ['progressRange'] });
    expect(await reasons(api.updateGoalProgress(goal.id, { progress: 80, status: 'completed', note: '' }, EMPLOYEE))).toEqual({ progress: ['completedNeeds100'] });
    await api.updateGoalProgress(goal.id, { progress: 40, status: 'in-progress', note: 'Halfway soon' }, EMPLOYEE); // the owner updates their own goal
    const done = await api.updateGoalProgress(goal.id, { progress: 100, status: 'completed', note: '' }, EMPLOYEE);
    expect(done.history.map((h) => h.type)).toEqual(['created', 'progress', 'status', 'progress', 'status']);
    expect(await code(api.updateGoalProgress(goal.id, { progress: 90, status: 'in-progress', note: '' }, HR))).toBe('CONFLICT');
    // Someone else's goal: neither the owner nor their manager.
    const other = (await api.getGoals({ ...ALL, filters: { ownerType: 'employee', status: 'in-progress' } }, HR)).items.find((g) => g.owner?.id !== 'emp-0025')!;
    expect(await code(api.updateGoalProgress(other.id, { progress: 50, status: 'in-progress', note: '' }, EMPLOYEE))).toBe('FORBIDDEN');
  });

  it('a goal added to a cycle becomes part of the employee\'s review', async () => {
    const cycle = await currentCycle();
    const before = await myReview();
    await api.createGoal(input({ cycleId: cycle.id }), HR);
    expect((await myReview()).goals.length).toBe(before.goals.length + 1);
  });
});

describe('self-assessment and manager review', () => {
  it('the employee submits their own self-assessment once; required ratings; scale enforced', async () => {
    const r = await myReview();
    expect(r.can.selfAssess).toBe(true);
    expect(await reasons(api.submitSelfAssessment(r.id, selfInput(r, { goalRatings: r.goals.map((g) => ({ goalId: g.id, rating: null, comment: '' })), achievements: '' }), EMPLOYEE))).toMatchObject({ 'goalRatings.0.rating': ['ratingRequired'], achievements: ['required'] });
    expect(await reasons(api.submitSelfAssessment(r.id, selfInput(r, { goalRatings: r.goals.map((g) => ({ goalId: g.id, rating: 7, comment: '' })) }), EMPLOYEE))).toMatchObject({ 'goalRatings.0.rating': ['ratingScale'] });
    const draft = await api.submitSelfAssessment(r.id, selfInput(r, { submit: false, achievements: '' }), EMPLOYEE);
    expect(draft.selfAssessment!.status).toBe('draft');
    const submitted = await api.submitSelfAssessment(r.id, selfInput(r), EMPLOYEE);
    expect(submitted).toMatchObject({ state: 'pending-manager', selfAssessment: { status: 'submitted', submittedAt: NOW.toISOString() }, can: { selfAssess: false } });
    expect(await code(api.submitSelfAssessment(r.id, selfInput(r), EMPLOYEE))).toBe('CONFLICT'); // final until reopened
    await api.reopenReview(r.id, 'self', HR);
    expect((await api.getReviewById(r.id, EMPLOYEE)).can.selfAssess).toBe(true);
  });

  it('nobody else writes a self-assessment; drafts are private', async () => {
    const r = await myReview();
    expect(await code(api.submitSelfAssessment(r.id, selfInput(r), MANAGER))).toBe('FORBIDDEN');
    await api.submitSelfAssessment(r.id, selfInput(r, { submit: false }), EMPLOYEE);
    expect((await api.getReviewById(r.id, MANAGER)).selfAssessment).toBeNull();
  });

  it('manager review: team only, never one\'s own, after the self-assessment; the employee sees it once submitted', async () => {
    const r = await myReview();
    expect(await reasons(api.submitManagerReview(r.id, managerInput(r), MANAGER))).toEqual({ form: ['selfPending'] });
    await api.submitSelfAssessment(r.id, selfInput(r), EMPLOYEE);
    const asManager = await api.getReviewById(r.id, MANAGER);
    expect(asManager.selfAssessment!.achievements).toBe('Shipped the onboarding flow.');
    expect(await reasons(api.submitManagerReview(r.id, managerInput(asManager, { overallRating: null }), MANAGER))).toEqual({ overallRating: ['ratingRequired'] });
    await api.submitManagerReview(r.id, managerInput(asManager, { submit: false }), MANAGER);
    expect((await api.getReviewById(r.id, EMPLOYEE)).managerReview).toBeNull(); // manager draft is not visible to the employee
    const done = await api.submitManagerReview(r.id, managerInput(asManager), MANAGER);
    expect(done).toMatchObject({ state: 'completed', managerReview: { status: 'submitted', overallRating: 4, reviewer: { en: 'Dana Yousef' } } });
    expect((await api.getReviewById(r.id, EMPLOYEE)).managerReview!.overallRating).toBe(4);
    // Dana's own review cannot be written by Dana.
    const cycle = await currentCycle();
    const dana = (await api.getReviews({ ...ALL, filters: { cycleId: cycle.id } }, HR)).items.find((x) => x.employee.id === 'emp-0001')!;
    expect(await code(api.submitManagerReview(dana.id, managerInput(await api.getReviewById(dana.id, HR)), MANAGER))).toBe('FORBIDDEN');
    // Outside the team.
    const outside = (await api.getReviews({ ...ALL, filters: { cycleId: cycle.id, state: 'pending-manager' } }, HR)).items.find((x) => !employeeRecords.teamUnits(users['department-manager']).has(employeeRecords.get(x.employee.id)!.departmentId))!;
    expect(await code(api.getReviewById(outside.id, MANAGER))).toBe('FORBIDDEN');
  });

  it('the rating scale is configurable (labels), its values are fixed', async () => {
    const scale = await api.getRatingScale(HR);
    const relabelled = scale.map((l) => (l.value === 3 ? { ...l, label: { en: 'Solid', ar: 'جيد' } } : l));
    expect((await api.updateRatingScale(relabelled, HR))[2]!.label.en).toBe('Solid');
    expect(await reasons(api.updateRatingScale(scale.slice(0, 4), HR))).toEqual({ form: ['scaleValuesFixed'] });
    expect(await code(api.updateRatingScale(scale, HRM))).toBe('FORBIDDEN');
  });
});

describe('competencies, templates, development plans', () => {
  it('competency CRUD with unique codes; in-use competencies cannot be deactivated', async () => {
    const c = await api.createCompetency({ code: 'cust', name: { en: 'Customer focus', ar: 'التركيز على العملاء' }, description: '', criteria: '' }, HR);
    expect(c).toMatchObject({ code: 'CUST', status: 'active' });
    expect(await reasons(api.createCompetency({ code: 'COMM', name: { en: 'X', ar: 'س' }, description: '', criteria: '' }, HR))).toEqual({ code: ['duplicateCode'] });
    expect((await api.updateCompetency(c.id, { code: 'CUST', name: { en: 'Customer focus', ar: 'التركيز على العملاء' }, description: 'Puts customers first.', criteria: '' }, HR)).description).toBe('Puts customers first.');
    expect((await api.updateCompetencyStatus(c.id, 'inactive', HR)).status).toBe('inactive');
    expect(await reasons(api.updateCompetencyStatus('cmp-01', 'inactive', HR))).toEqual({ status: ['competencyInUse'] });
    const tpl = await api.createReviewTemplate({ name: { en: 'Sales review', ar: 'مراجعة المبيعات' }, competencyIds: ['cmp-01', 'cmp-02'] }, HR);
    expect(tpl.competencies.map((x) => x.id)).toEqual(['cmp-01', 'cmp-02']);
    expect(await reasons(api.updateReviewTemplate('tpl-01', { name: { en: 'Standard', ar: 'قياسية' }, competencyIds: ['cmp-01'] }, HR))).toEqual({ form: ['templateInUse'] });
  });

  it('plans: team managers create; the employee updates activities; completion needs every activity done', async () => {
    const input: PlanInput = { employeeId: 'emp-0025', title: 'Grow into a lead role', objectives: ['Lead a feature'], activities: [{ type: 'leadership', title: 'Lead the Q1 feature', targetDate: addDays(TODAY, 60), status: 'planned' }], targetDate: addDays(TODAY, 90), status: 'active', cycleId: null };
    expect(await reasons(api.createDevelopmentPlan({ ...input, activities: [{ ...input.activities[0]!, targetDate: addDays(TODAY, 120) }] }, MANAGER))).toEqual({ 'activities.0.targetDate': ['activityAfterPlan'] });
    const plan = await api.createDevelopmentPlan(input, MANAGER);
    expect(plan.progress).toBe(0);
    expect(await code(api.createDevelopmentPlan(input, EMPLOYEE))).toBe('FORBIDDEN');
    expect(await reasons(api.updateDevelopmentPlan(plan.id, { ...input, activities: plan.activities, status: 'completed' }, MANAGER))).toEqual({ status: ['activitiesOpen'] });
    const updated = await api.updatePlanActivities(plan.id, [{ id: plan.activities[0]!.id, status: 'done' }], EMPLOYEE);
    expect(updated.progress).toBe(100);
    expect((await api.updateDevelopmentPlan(plan.id, { ...input, activities: updated.activities, status: 'completed' }, MANAGER)).status).toBe('completed');
  });
});

describe('history and scope', () => {
  it('employee history: own only for employees; team for managers; everything for HR', async () => {
    const own = await api.getEmployeePerformanceHistory('me', EMPLOYEE);
    expect(own.employee.id).toBe('emp-0025');
    expect(own.reviews.length).toBeGreaterThan(0);
    expect(own.reviews.every((r) => r.employee.id === 'emp-0025')).toBe(true);
    expect(await code(api.getEmployeePerformanceHistory('emp-0030', EMPLOYEE))).toBe('FORBIDDEN');
    expect((await api.getEmployeePerformanceHistory('emp-0025', MANAGER)).employee.id).toBe('emp-0025');
    expect((await api.getEmployeePerformanceHistory('emp-0030', HR)).employee.id).toBe('emp-0030');
  });

  it('lists are scoped; Recruiter and Payroll Officer see only their own performance', async () => {
    const team = employeeRecords.teamUnits(users['department-manager']);
    for (const r of (await api.getReviews(ALL, MANAGER)).items) expect(team.has(employeeRecords.get(r.employee.id)!.departmentId) || r.employee.id === 'emp-0001').toBe(true);
    for (const role of ['recruiter', 'payroll-officer', 'employee'] as const) {
      const mine = employeeRecords.employeeIdOf(users[role]);
      expect((await api.getGoals(ALL, scopeOf(role))).items.every((g) => g.owner?.id === mine || g.owner === null)).toBe(true);
      expect((await api.getReviews(ALL, scopeOf(role))).items.every((r) => r.employee.id === mine)).toBe(true);
      expect(await code(api.getPerformanceSummary({ ...scopeOf(role), kind: 'organization' }))).toBe('FORBIDDEN');
    }
  });
});
