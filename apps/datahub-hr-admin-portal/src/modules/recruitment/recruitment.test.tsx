import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { recruitmentApi } from '@/modules/recruitment/api/recruitmentApi';
import type { RecruitmentScope } from '@/modules/recruitment/types/recruitment';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

type User = ReturnType<typeof renderApp>['user'];
const HR: RecruitmentScope = { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' };

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /Recruitment|التوظيف|Access denied/ }, { timeout: 8000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 8000 });
  return utils;
}
async function choose(user: User, label: string | RegExp, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}
const kpi = (key: string) => document.querySelector(`[data-kpi="${key}"]`)?.textContent;
const dialog = () => screen.getByRole('dialog');
/** Opens a select and picks its first (enabled) option. */
async function chooseFirst(user: User, label: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  const options = (await screen.findAllByRole('option')).filter((o) => o.getAttribute('aria-disabled') !== 'true');
  await user.click(options[0]!);
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}
async function rowAction(user: User, rowName: string, action: string | RegExp) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${rowName}` }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

describe('overview', () => {
  it('six KPIs, four charts and recent activity from the same dataset', async () => {
    const s = await recruitmentApi.getRecruitmentSummary(HR);
    await open('/recruitment');
    expect(kpi('openPositions')).toBe(String(s.openPositions));
    expect(kpi('totalCandidates')).toBe(String(s.totalCandidates));
    expect(kpi('newCandidates')).toBe(String(s.newCandidates));
    expect(kpi('inInterview')).toBe(String(s.inInterview));
    expect(kpi('pendingOffers')).toBe(String(s.pendingOffers));
    expect(kpi('hired')).toBe(String(s.hired));
    for (const title of ['Candidates by stage', 'Recruitment activity', 'Candidates by position', 'Hiring funnel']) expect(screen.getByRole('img', { name: title }), title).toBeTruthy();
    const funnel = recordedCharts.find((c) => JSON.stringify(c.option.yAxis).includes('Interviewed'))!;
    expect(((funnel.option.series as Array<{ data: Array<{ value: number }> }>)[0]!.data).map((d) => d.value)).toEqual(s.funnel.map((f) => f.count));
    expect(within(screen.getByRole('list', { name: 'Recent activity' })).getAllByRole('listitem')).toHaveLength(s.recent.length);
  }, 20_000);

  it('Arabic: translated, RTL charts, Latin digits', async () => {
    const { user } = await open('/recruitment');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'التوظيف' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('tab', { name: 'مسار التوظيف' })).toBeTruthy();
    expect(kpi('totalCandidates')).toMatch(/^[0-9,]+$/);
    await waitFor(() => expect(recordedCharts.some((c) => (c.option.xAxis as { inverse?: boolean } | undefined)?.inverse === true)).toBe(true));
  }, 20_000);
});

describe('requisitions', () => {
  it('lists, filters by status, and creates a draft (validation, then success)', async () => {
    const all = await recruitmentApi.getRequisitions({ page: 1, pageSize: 10 }, HR);
    const { user } = await open('/recruitment/requisitions');
    expect(screen.getByText(`1–10 of ${all.total}`)).toBeTruthy();
    await choose(user, 'Status', 'Closed');
    const closed = await recruitmentApi.getRequisitions({ page: 1, pageSize: 10, filters: { status: 'closed' } }, HR);
    expect(await screen.findByText(`1–${closed.total} of ${closed.total}`)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'New requisition' }));
    const d = dialog();
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect((await within(d).findAllByText('This field is required.')).length).toBeGreaterThan(0);
    await user.type(within(d).getByRole('textbox', { name: /Job title \(English\)/ }), 'Data Analyst');
    await user.type(within(d).getByRole('textbox', { name: /Job title \(Arabic\)/ }), 'محلل بيانات');
    await choose(user, /^Department/, /Engineering/);
    await chooseFirst(user, /^Position/);
    await chooseFirst(user, /^Location/);
    await user.type(within(d).getByRole('textbox', { name: /Job description/ }), 'Analyse data (demo).');
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText(/Requisition REQ-2026-\d{3} created as a draft\./)).toBeTruthy();
  }, 30_000);

  it('details: status workflow (submit for approval) and its candidates', async () => {
    const draft = (await recruitmentApi.getRequisitions({ page: 1, pageSize: 1, filters: { status: 'draft' } }, HR)).items[0]!;
    const { user } = await open(`/recruitment/requisitions/${draft.id}`);
    expect(screen.getByRole('heading', { level: 2, name: draft.title.en })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText(`Requisition ${draft.number} is now Pending approval.`)).toBeTruthy();
  }, 20_000);
});

describe('candidates and pipeline', () => {
  it('search by e-mail; duplicate e-mail refused by the API', async () => {
    const c = (await recruitmentApi.getCandidates({ page: 1, pageSize: 1 }, HR)).items[0]!;
    const { user } = await open('/recruitment/candidates');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), c.email);
    expect(await screen.findByText('1–1 of 1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New candidate' }));
    const d = dialog();
    await user.type(within(d).getByRole('textbox', { name: /First name \(English\)/ }), 'Test');
    await user.type(within(d).getByRole('textbox', { name: /Last name \(English\)/ }), 'Person');
    await user.type(within(d).getByRole('textbox', { name: /^E-mail/ }), c.email);
    await user.type(within(d).getByRole('textbox', { name: /^Phone/ }), '+962 79 000 1111');
    await chooseFirst(user, /Applied position/);
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect(await within(d).findByText('Another active candidate already uses this e-mail address.')).toBeTruthy();
  }, 30_000);

  it('profile timeline records every stage change; moving uses only allowed stages', async () => {
    const c = (await recruitmentApi.getCandidates({ page: 1, pageSize: 1, filters: { stage: 'new' } }, HR)).items[0]!;
    const { user } = await open(`/recruitment/candidates/${c.id}`);
    await user.click(screen.getByRole('button', { name: 'Move stage' }));
    const d = dialog();
    await user.click(within(d).getByRole('combobox', { name: 'New stage' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Screening', 'Rejected']);
    await user.click(screen.getByRole('option', { name: 'Screening' }));
    await user.type(within(d).getByRole('textbox', { name: 'Note' }), 'Strong CV');
    await user.click(within(d).getByRole('button', { name: 'Move' }));
    expect(await screen.findByText(/is now in Screening\./)).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    const timeline = await screen.findByRole('list', { name: 'Timeline' });
    expect(within(timeline).getAllByRole('listitem')[0]!.textContent).toContain('Moved from New application to Screening');
    expect(within(timeline).getByText('Strong CV')).toBeTruthy();
  }, 30_000);

  it('pipeline board: column counts match the data; list view toggle', async () => {
    const req = (await recruitmentApi.getRequisitions({ page: 1, pageSize: 1, filters: { status: 'open' }, sortBy: 'number', sortDirection: 'asc' }, HR)).items[0]!;
    const candidates = (await recruitmentApi.getCandidates({ page: 1, pageSize: 100, filters: { requisitionId: req.id } }, HR)).items;
    const { user } = await open(`/recruitment/pipeline?requisition=${req.id}`);
    await waitFor(() => expect(document.querySelector('[data-count="new"]')?.textContent).not.toBe('…'));
    for (const stage of ['new', 'screening', 'interview', 'hired', 'rejected'] as const) {
      expect(document.querySelector(`[data-count="${stage}"]`)?.textContent, stage).toBe(String(candidates.filter((c) => c.stage === stage).length));
    }
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(await screen.findByRole('table', { name: 'Candidates' })).toBeTruthy();
  }, 20_000);
});

describe('interviews and offers', () => {
  it('cancelling an interview requires a reason', async () => {
    const scheduled = (await recruitmentApi.getInterviews({ page: 1, pageSize: 1, filters: { status: 'scheduled' }, sortBy: 'start', sortDirection: 'desc' }, HR)).items[0]!;
    const { user } = await open(`/recruitment/interviews/${scheduled.id}`);
    await user.click(screen.getByRole('button', { name: 'Cancel interview' }));
    const d = dialog();
    await user.click(within(d).getByRole('button', { name: 'Cancel interview' }));
    expect(await within(d).findByText('Enter a reason.')).toBeTruthy();
    await user.type(within(d).getByRole('textbox', { name: /Reason for cancelling/ }), 'Interviewer unavailable');
    await user.click(within(d).getByRole('button', { name: 'Cancel interview' }));
    expect(await screen.findByText('Interview cancelled.')).toBeTruthy();
    expect((await recruitmentApi.getInterviewById(scheduled.id, HR)).status).toBe('cancelled');
  }, 20_000);

  it('feedback: ratings and recommendation required, then recorded', async () => {
    const pending = (await recruitmentApi.getInterviews({ page: 1, pageSize: 100, filters: { status: 'completed' } }, HR)).items.find((i) => i.can.feedbackFor.length > 0)!;
    const { user } = await open(`/recruitment/interviews/${pending.id}`);
    await user.click(screen.getAllByRole('button', { name: /Submit feedback|Feedback for/ })[0]!);
    const d = dialog();
    await user.click(within(d).getByRole('button', { name: 'Submit feedback' }));
    expect((await within(d).findAllByText('Choose a rating from 1 to 5.')).length).toBe(5);
    // MUI Rating: user-event pointer clicks do not reach the hidden radio inputs in jsdom; click them directly.
    for (const group of within(d).getAllByRole('group')) fireEvent.click(within(group).getByRole('radio', { name: '4 of 5' }));
    await user.type(within(d).getByRole('textbox', { name: /Strengths/ }), 'Clear communication');
    await user.type(within(d).getByRole('textbox', { name: /Areas for improvement/ }), 'Depth on testing');
    await user.click(within(d).getByRole('combobox', { name: /Recommendation/ }));
    await user.click(await screen.findByRole('option', { name: 'Hire' }));
    await user.click(within(d).getByRole('button', { name: 'Submit feedback' }));
    expect(await screen.findByText('Feedback submitted.')).toBeTruthy();
    expect((await recruitmentApi.getInterviewById(pending.id, HR)).feedbackCount).toBe(pending.feedbackCount + 1);
  }, 30_000);

  it('a draft offer is sent (simulated) from the offers list', async () => {
    const draft = (await recruitmentApi.getOffers({ page: 1, pageSize: 1, filters: { status: 'draft' } }, HR)).items[0]!;
    const { user } = await open('/recruitment/offers');
    expect(screen.getByText(/Offers are simulated/)).toBeTruthy();
    await choose(user, 'Status', 'Draft');
    await rowAction(user, draft.number, 'Send offer');
    expect(within(dialog()).getByText(/No e-mail is sent/)).toBeTruthy();
    await user.click(within(dialog()).getByRole('button', { name: 'Send offer' }));
    expect(await screen.findByText(`Offer ${draft.number} is now Sent.`)).toBeTruthy();
  }, 20_000);
});

describe('candidate → employee conversion', () => {
  it('HR opens the Employee Management form pre-filled from the candidate and the accepted offer', async () => {
    const ready = (await recruitmentApi.getCandidates({ page: 1, pageSize: 100, filters: { stage: 'hired' } }, HR)).items.find((c) => c.can.convert)!;
    const draft = await recruitmentApi.getConversionDraft(ready.id, HR);
    const { user } = await open(`/recruitment/candidates/${ready.id}`);
    expect(screen.getByText(/can now be converted into an employee record/)).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Create employee record' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Create the employee record for/ })).toBeTruthy();
    const form = await screen.findByRole('form', { name: /Add employee|New employee|Create employee/i }).catch(() => document.querySelector('form')!);
    expect((within(form as HTMLElement).getByRole('textbox', { name: /Employee number/ }) as HTMLInputElement).value).toBe(draft.employeeNumber);
    expect((within(form as HTMLElement).getByRole('textbox', { name: /Work e-?mail/i }) as HTMLInputElement).value).toBe(draft.workEmail);
    expect(screen.getByRole('button', { name: 'Create employee' })).toBeTruthy();
  }, 30_000);

  it('a Recruiter (no organization.employees.manage) cannot convert', async () => {
    const ready = (await recruitmentApi.getCandidates({ page: 1, pageSize: 100, filters: { stage: 'hired' } }, HR)).items.find((c) => c.can.convert)!;
    await open(`/recruitment/candidates/${ready.id}`, 'recruiter');
    expect(await screen.findByText(/An HR user with permission to create employees can convert/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Create employee record' })).toBeNull();
  }, 20_000);
});

describe('roles and states', () => {
  it('Department Manager: team requisitions, read-only, no Offers section', async () => {
    const team = await recruitmentApi.getRequisitions({ page: 1, pageSize: 10 }, { kind: 'team', userId: 'usr-0004', role: 'department-manager' });
    await open('/recruitment/requisitions', 'department-manager');
    expect(screen.getByText(/read-only access to recruitment/)).toBeTruthy();
    expect(await screen.findByText(`1–${Math.min(10, team.total)} of ${team.total}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New requisition' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Offers' })).toBeNull();
  }, 20_000);

  it('Employee and Payroll Officer get access denied', async () => {
    for (const role of ['employee', 'payroll-officer'] as const) {
      const { unmount } = renderApp('/recruitment', { as: role });
      expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' }, { timeout: 8000 })).toBeTruthy();
      unmount();
    }
  }, 20_000);

  it('loading, error with retry, then data', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    const spy = vi.spyOn(recruitmentApi, 'getCandidates').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/recruitment/candidates', { as: 'hr-admin' });
    const alert = await screen.findByText('This list could not be loaded.', {}, { timeout: 8000 });
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Candidates' }, { timeout: 5000 })).toBeTruthy();
  }, 20_000);

  it('empty state when nothing matches', async () => {
    const { user } = await open('/recruitment/requisitions');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'no-such-requisition');
    expect(await screen.findByText('No results match your search or filters.', {}, { timeout: 8000 })).toBeTruthy();
  }, 20_000);
});
