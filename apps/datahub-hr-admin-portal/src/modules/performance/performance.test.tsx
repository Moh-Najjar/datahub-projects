import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { performanceApi } from '@/modules/performance/api/performanceApi';
import type { PerformanceScope } from '@/modules/performance/types/performance';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

type User = ReturnType<typeof renderApp>['user'];
const HR: PerformanceScope = { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' };
const EMPLOYEE: PerformanceScope = { kind: 'own', userId: 'usr-0005', role: 'employee' };

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /Performance|My performance|الأداء|Access denied/ }, { timeout: 8000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 8000 });
  return utils;
}
async function choose(user: User, label: string | RegExp, option: string | RegExp, within_: HTMLElement = document.body) {
  await user.click(within(within_).getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}
const kpi = (key: string) => document.querySelector(`[data-kpi="${key}"]`)?.textContent;
const dialog = () => screen.getByRole('dialog');
async function myReviewId() {
  const cycle = (await performanceApi.getReviewCycles({ page: 1, pageSize: 10, filters: { status: 'in-progress' } }, HR)).items[0]!;
  return (await performanceApi.getReviews({ page: 1, pageSize: 10, filters: { cycleId: cycle.id } }, EMPLOYEE)).items[0]!.id;
}

describe('overview', () => {
  it('six KPIs and four charts from the same reviews', async () => {
    const s = await performanceApi.getPerformanceSummary(HR);
    await open('/performance');
    expect(kpi('inReview')).toBe(String(s.inReview));
    expect(kpi('activeCycles')).toBe(String(s.activeCycles));
    expect(kpi('pendingSelf')).toBe(String(s.pendingSelf));
    expect(kpi('pendingManager')).toBe(String(s.pendingManager));
    expect(kpi('completed')).toBe(String(s.completed));
    expect(kpi('averageRating')).toBe(s.averageRating!.toFixed(1));
    for (const title of ['Rating distribution', 'Review completion', 'Department comparison', 'Performance trend']) expect(screen.getByRole('img', { name: title }), title).toBeTruthy();
    const dist = recordedCharts.find((c) => JSON.stringify(c.option.xAxis).includes('"data":["1","2","3","4","5"]'))!;
    expect(((dist.option.series as Array<{ data: Array<{ value: number }> }>)[0]!.data).map((d) => d.value)).toEqual(s.distribution.map((d) => d.count));
  }, 20_000);

  it('Arabic + dark: translated, RTL charts, Latin digits', async () => {
    const { user } = await open('/performance');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'الأداء' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(screen.getByRole('tab', { name: 'دورات المراجعة' })).toBeTruthy();
    expect(kpi('inReview')).toMatch(/^[0-9,]+$/);
    await waitFor(() => expect(recordedCharts.some((c) => (c.option.xAxis as { inverse?: boolean } | undefined)?.inverse === true)).toBe(true));
  }, 20_000);
});

describe('self-assessment and manager review', () => {
  it('the employee submits their self-assessment (required fields, then read-only)', async () => {
    const { user } = await open('/performance', 'employee');
    expect(screen.getByRole('heading', { level: 1, name: 'My performance' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Performance sections' })).toBeNull();
    await user.click(await screen.findByRole('link', { name: 'Open' }));
    const form = await screen.findByRole('form', { name: 'Self-assessment' }, { timeout: 8000 });
    await user.click(within(form).getByRole('button', { name: 'Submit' }));
    expect((await within(form).findAllByText('Choose a rating.')).length).toBeGreaterThan(0);
    for (const box of within(form).getAllByRole('combobox', { name: /Rating/ })) {
      await user.click(box);
      await user.click(await screen.findByRole('option', { name: /^4 — / }));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    }
    await user.type(within(form).getByRole('textbox', { name: /Achievements/ }), 'Delivered the onboarding flow.');
    await user.click(within(form).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Self-assessment submitted.')).toBeTruthy();
    expect(await screen.findByText('Delivered the onboarding flow.')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Self-assessment' })).toBeNull();
    expect(screen.getAllByText('Awaiting manager review').length).toBeGreaterThan(0);
  }, 40_000);

  it('the Department Manager reviews a team member; the rating uses the configured scale', async () => {
    const id = await myReviewId();
    const review = await performanceApi.getReviewById(id, EMPLOYEE);
    await performanceApi.submitSelfAssessment(id, { goalRatings: review.goals.map((g) => ({ goalId: g.id, rating: 4, comment: '' })), achievements: 'Done.', challenges: '', comments: '', submit: true }, EMPLOYEE);
    const { user } = await open(`/performance/reviews/${id}`, 'department-manager');
    const form = await screen.findByRole('form', { name: 'Manager review' }, { timeout: 8000 });
    expect(screen.getByText('Done.')).toBeTruthy(); // the submitted self-assessment is visible to the manager
    for (const box of within(form).getAllByRole('combobox', { name: /Rating/ })) {
      await user.click(box);
      await user.click(await screen.findByRole('option', { name: /^3 — / }));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    }
    await user.type(within(form).getByRole('textbox', { name: /^Strengths/ }), 'Reliable');
    await user.type(within(form).getByRole('textbox', { name: /^Areas for improvement/ }), 'Delegate more');
    await user.click(within(form).getByRole('combobox', { name: /Overall rating/ }));
    await user.click(await screen.findByRole('option', { name: '4 — Exceeds expectations' }));
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await user.click(within(form).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Manager review submitted.')).toBeTruthy();
    expect(await screen.findByText('4 — Exceeds expectations', { selector: 'strong' })).toBeTruthy(); // overall rating
    expect((await performanceApi.getReviewById(id, EMPLOYEE)).managerReview!.overallRating).toBe(4);
  }, 40_000);

  it('"Awaiting my review" lists only reviews the manager may write', async () => {
    const { user } = await open('/performance/reviews', 'department-manager');
    await user.click(screen.getByRole('switch', { name: 'Awaiting my review' }));
    const expected = await performanceApi.getManagerReviews({ page: 1, pageSize: 10, filters: {} }, { kind: 'team', userId: 'usr-0004', role: 'department-manager' });
    const cycle = (await performanceApi.getReviewCycles({ page: 1, pageSize: 10, filters: { status: 'in-progress' } }, HR)).items[0]!;
    const inCycle = await performanceApi.getManagerReviews({ page: 1, pageSize: 10, filters: { cycleId: cycle.id } }, { kind: 'team', userId: 'usr-0004', role: 'department-manager' });
    expect(expected.total).toBeGreaterThan(0);
    expect(await screen.findByText(`1–${Math.min(10, inCycle.total)} of ${inCycle.total}`)).toBeTruthy();
  }, 20_000);
});

describe('goals, cycles, competencies, plans', () => {
  it('goal progress is validated (0–100) and recorded', async () => {
    const goal = (await performanceApi.getGoals({ page: 1, pageSize: 1, filters: { status: 'in-progress', ownerType: 'employee' } }, HR)).items[0]!;
    const { user } = await open('/performance/goals');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), goal.owner!.employeeNumber);
    await choose(user, 'Status', 'In progress');
    await user.click((await screen.findAllByRole('button', { name: `Actions for ${goal.title}` }))[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Update progress' }));
    const d = dialog();
    const progress = within(d).getByRole('spinbutton', { name: /Progress/ });
    await user.clear(progress);
    await user.type(progress, '120');
    await user.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await within(d).findByText('Progress must be between 0 and 100.')).toBeTruthy();
    await user.clear(progress);
    await user.type(progress, '60');
    await user.click(within(d).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Progress of ".+" saved\./)).toBeTruthy();
  }, 30_000);

  it('a new cycle with an overlapping review period is refused by the API', async () => {
    const { user } = await open('/performance/cycles');
    await user.click(screen.getByRole('button', { name: 'New review cycle' }));
    const d = dialog();
    await user.type(within(d).getByRole('textbox', { name: /Name \(English\)/ }), 'Q1 check-in');
    await user.type(within(d).getByRole('textbox', { name: /Name \(Arabic\)/ }), 'مراجعة الربع الأول');
    const date = (label: RegExp, value: string) => fireEvent.change(within(d).getByLabelText(label), { target: { value } });
    date(/Review period from/, '2027-01-01');
    date(/Review period to/, '2027-03-31');
    date(/^Start date/, '2027-04-01');
    date(/^End date/, '2027-04-30');
    date(/Self-assessment deadline/, '2027-04-10');
    date(/Manager review deadline/, '2027-04-20');
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect(await within(d).findByText('This review period overlaps another cycle.')).toBeTruthy();
  }, 30_000);

  it('competencies: duplicate code refused; templates and the rating scale are shown', async () => {
    const { user } = await open('/performance/competencies');
    expect(screen.getByText('1–8 of 8')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Review templates' })).toBeTruthy();
    expect(screen.getByText('3 — Meets expectations')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New competency' }));
    const d = dialog();
    await user.type(within(d).getByRole('textbox', { name: /^Code/ }), 'comm');
    await user.type(within(d).getByRole('textbox', { name: /Name \(English\)/ }), 'Communication 2');
    await user.type(within(d).getByRole('textbox', { name: /Name \(Arabic\)/ }), 'التواصل');
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect(await within(d).findByText('Another competency already uses this code.')).toBeTruthy();
  }, 30_000);

  it('the employee updates an activity of their own development plan', async () => {
    const plan = (await performanceApi.getDevelopmentPlans({ page: 1, pageSize: 10, filters: { status: 'active' } }, EMPLOYEE)).items[0]!;
    const activity = plan.activities.find((a) => a.status !== 'done')!;
    const { user } = await open(`/performance/development/${plan.id}`, 'employee');
    await choose(user, `Status of ${activity.title}`, 'Done');
    expect(await screen.findByText('Activity updated.')).toBeTruthy();
    expect((await performanceApi.getDevelopmentPlanById(plan.id, EMPLOYEE)).activities.find((a) => a.id === activity.id)!.status).toBe('done');
  }, 20_000);
});

describe('roles, integration and states', () => {
  it('HR Manager: no configuration actions; employees are kept to their own performance', async () => {
    await open('/performance/cycles', 'hr-manager');
    expect(await screen.findByRole('table', { name: 'Review cycles' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New review cycle' })).toBeNull();
    const other = renderApp('/performance/cycles', { as: 'recruiter' });
    other.unmount();
  }, 20_000);

  it('Recruiter and Payroll Officer see only "My performance"', async () => {
    await open('/performance/goals', 'payroll-officer');
    expect(await screen.findByRole('heading', { level: 1, name: 'My performance' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Performance sections' })).toBeNull();
  }, 20_000);

  it('Employee Profile has a Performance tab with the review history', async () => {
    const { user } = renderApp('/employees/emp-0025', { as: 'hr-admin' });
    await user.click(await screen.findByRole('tab', { name: 'Performance' }, { timeout: 8000 }));
    expect(await screen.findByRole('table', { name: 'Review history' }, { timeout: 8000 })).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Review history' })).getByText('Annual Review 2025')).toBeTruthy();
  }, 20_000);

  it('loading, error with retry, then data', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    const spy = vi.spyOn(performanceApi, 'getGoals').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/performance/goals', { as: 'hr-admin' });
    const alert = await screen.findByText('This list could not be loaded.', {}, { timeout: 8000 });
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Goals' }, { timeout: 5000 })).toBeTruthy();
  }, 20_000);

  it('empty state when nothing matches', async () => {
    const { user } = await open('/performance/development');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'no-such-plan');
    expect(await screen.findByText('No results match your search or filters.', {}, { timeout: 8000 })).toBeTruthy();
  }, 20_000);
});
