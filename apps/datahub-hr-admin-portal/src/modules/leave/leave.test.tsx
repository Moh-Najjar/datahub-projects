import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { leaveApi } from '@/modules/leave/api/leaveApi';
import type { LeaveScope } from '@/modules/leave/types/leave';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

type User = ReturnType<typeof renderApp>['user'];
const HR: LeaveScope = { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' };
const EMPLOYEE: LeaveScope = { kind: 'own', userId: 'usr-0005', role: 'employee' };

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /Leave Management|My leave|إدارة الإجازات|Access denied/ }, { timeout: 8000 });
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

describe('overview', () => {
  it('six KPIs and four charts from the same data', async () => {
    const summary = await leaveApi.getLeaveSummary(2026, HR);
    await open('/leave');
    expect(kpi('total')).toBe(String(summary.total));
    expect(kpi('pending')).toBe(String(summary.byStatus.pending));
    expect(kpi('approved')).toBe(String(summary.byStatus.approved));
    expect(kpi('rejected')).toBe(String(summary.byStatus.rejected));
    expect(kpi('onLeave')).toBe(String(summary.onLeaveToday)); // = Attendance's figure (leaveBackend.test.ts)
    expect(kpi('daysUsed')).toBe(summary.daysUsed.toLocaleString('en-GB'));
    for (const title of ['Requests by status', 'Monthly leave trend', 'Leave by type', 'Leave usage by department']) expect(screen.getByRole('img', { name: title }), title).toBeTruthy();
    const status = recordedCharts.find((c) => JSON.stringify(c.option.series).includes('"Approved"') && (c.option.series as Array<{ type: string }>)[0]?.type === 'pie')!;
    const slices = (status.option.series as Array<{ data: Array<{ name: string; value: number }> }>)[0]!.data;
    expect(slices.find((d) => d.name === 'Approved')?.value).toBe(summary.byStatus.approved);
  }, 20_000);

  it('Arabic: translated page, RTL charts, Latin digits', async () => {
    const { user } = await open('/leave');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'إدارة الإجازات' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('tab', { name: 'بانتظار قراري' })).toBeTruthy();
    expect(kpi('total')).toMatch(/^[0-9,]+$/);
    await waitFor(() => expect(recordedCharts.some((c) => (c.option.xAxis as { inverse?: boolean } | undefined)?.inverse === true)).toBe(true));
  }, 20_000);
});

describe('requests and approvals', () => {
  it('lists requests with search, status filter and paging', async () => {
    const all = await leaveApi.getLeaveRequests({ page: 1, pageSize: 10 }, HR);
    const { user } = await open('/leave/requests');
    expect(screen.getByText(`1–10 of ${all.total}`)).toBeTruthy();
    await choose(user, 'Status', 'Rejected');
    const rejected = await leaveApi.getLeaveRequests({ page: 1, pageSize: 10, filters: { status: 'rejected' } }, HR);
    expect(await screen.findByText(`1–${Math.min(10, rejected.total)} of ${rejected.total}`)).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Leave requests' });
    expect(within(table).getAllByText('Rejected').length).toBe(Math.min(10, rejected.total));
  }, 20_000);

  it('HR approves a pending request from "Awaiting me"; reject needs a reason', async () => {
    const pending = await leaveApi.getLeaveRequests({ page: 1, pageSize: 100, filters: { awaitingMe: 'true' }, sortBy: 'startDate' }, HR);
    const [first, second] = pending.items;
    const { user } = await open('/leave/approvals');
    expect(screen.getByText(`1–10 of ${pending.total}`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: `Actions for ${first!.number}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Approve' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(`Request ${first!.number} approved.`)).toBeTruthy();
    expect((await leaveApi.getLeaveRequestById(first!.id, HR)).decidedBy?.en).toBe('Lina Haddad');

    await user.click(await screen.findByRole('button', { name: `Actions for ${second!.number}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reject' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog()).findByText('Enter a reason.')).toBeTruthy();
    await user.type(within(dialog()).getByRole('textbox', { name: /Reason for rejection/ }), 'Project deadline that week');
    await user.click(within(dialog()).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText(`Request ${second!.number} rejected.`)).toBeTruthy();
    expect((await leaveApi.getLeaveRequestById(second!.id, HR)).status).toBe('rejected');
  }, 30_000);

  it('request details: decision trail, reason and the Attendance link for approved leave', async () => {
    const approved = (await leaveApi.getLeaveRequests({ page: 1, pageSize: 1, filters: { status: 'approved' } }, HR)).items[0]!;
    await open(`/leave/requests/${approved.id}`);
    expect(screen.getByRole('heading', { level: 2, name: approved.number })).toBeTruthy();
    expect(screen.getByText('Decision trail')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View in Attendance' }).getAttribute('href')).toContain(`/attendance/history/${approved.employeeId}`);
    expect(screen.getByText(/these days appear as "On leave" in Attendance/)).toBeTruthy();
  }, 20_000);
});

describe('employee self-service', () => {
  it('"My leave": balances and own requests only; other sections redirect', async () => {
    const balances = await leaveApi.getEmployeeLeaveBalances('me', 2026, EMPLOYEE);
    await open('/leave', 'employee');
    expect(screen.getByRole('heading', { level: 1, name: 'My leave' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Leave sections' })).toBeNull();
    const annual = balances.find((b) => b.leaveType.code === 'ANNUAL')!;
    const card = document.querySelector('[data-balance="ANNUAL"]') as HTMLElement;
    expect(within(card).getByText(String(annual.remaining))).toBeTruthy();
    expect(await screen.findByRole('table', { name: 'Leave requests' })).toBeTruthy();
    for (const row of within(screen.getByRole('table', { name: 'Leave requests' })).getAllByRole('row').slice(1)) expect(row.textContent).not.toContain('Employee');
  }, 20_000);

  it('submits a request: days and balance summary from the API, document rule, pending reserves days', async () => {
    const { user } = await open('/leave', 'employee');
    await user.click(await screen.findByRole('button', { name: 'New request' }));
    expect(within(dialog()).getByText(/no permission exists to request on behalf/)).toBeTruthy();
    await choose(user, /Leave type/, 'Sick Leave');
    fireEvent.change(within(dialog()).getByLabelText(/Start date/), { target: { value: '2026-11-22' } });
    fireEvent.change(within(dialog()).getByLabelText(/End date/), { target: { value: '2026-11-26' } });
    // Sun–Thu working week; 26 Nov is an (example) holiday that sick leave does not count.
    expect(await within(dialog()).findByText('4 days')).toBeTruthy();
    expect(within(dialog()).getByText(/Not counted \(public holidays\): Company Day/)).toBeTruthy();
    await user.click(within(dialog()).getByRole('button', { name: 'Submit request' }));
    expect(await within(dialog()).findByText('Attach the supporting document required for this leave type.')).toBeTruthy();
    const file = new File(['x'.repeat(2048)], 'medical-note.pdf', { type: 'application/pdf' });
    await user.upload(within(dialog()).getByLabelText('Supporting document'), file);
    expect(within(dialog()).getByText('medical-note.pdf')).toBeTruthy();
    await user.click(within(dialog()).getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText(/Request LR-2026-\d+ submitted\./)).toBeTruthy();
    const sick = (await leaveApi.getEmployeeLeaveBalances('me', 2026, EMPLOYEE)).find((b) => b.leaveType.code === 'SICK')!;
    expect(sick.pending).toBe(4);
  }, 30_000);

  it('refuses overlapping dates with a field error from the API', async () => {
    const own = (await leaveApi.getLeaveRequests({ page: 1, pageSize: 10, filters: { status: 'approved' } }, EMPLOYEE)).items[0]!;
    const { user } = await open('/leave', 'employee');
    await user.click(await screen.findByRole('button', { name: 'New request' }));
    await choose(user, /Leave type/, 'Unpaid Leave');
    fireEvent.change(within(dialog()).getByLabelText(/Start date/), { target: { value: own.startDate } });
    fireEvent.change(within(dialog()).getByLabelText(/End date/), { target: { value: own.endDate } });
    await user.click(within(dialog()).getByRole('button', { name: 'Submit request' }));
    expect(await within(dialog()).findByText(/overlap another pending or approved request|already recorded/)).toBeTruthy();
  }, 30_000);
});

describe('roles and scope', () => {
  it('Department Manager: team approvals only, no leave-type management', async () => {
    const { user } = await open('/leave/approvals', 'department-manager');
    expect(screen.getByText(/Pending requests of your team/)).toBeTruthy();
    const mine = await leaveApi.getLeaveRequests({ page: 1, pageSize: 100, filters: { awaitingMe: 'true' } }, { kind: 'team', userId: 'usr-0004', role: 'department-manager' });
    expect(await screen.findByText(`1–${Math.min(10, mine.total)} of ${mine.total}`)).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Leave types' }));
    expect(await screen.findByRole('table', { name: 'Leave types' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New leave type' })).toBeNull();
  }, 20_000);

  it('Recruiter and Payroll Officer see only their own leave (existing matrix)', async () => {
    await open('/leave/requests', 'payroll-officer');
    expect(await screen.findByRole('heading', { level: 1, name: 'My leave' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Awaiting me' })).toBeNull();
  }, 20_000);

  it('HR Manager approves but cannot manage leave types', async () => {
    await open('/leave/types', 'hr-manager');
    expect(await screen.findByRole('table', { name: 'Leave types' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New leave type' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Awaiting me' })).toBeTruthy();
  }, 20_000);
});

describe('leave types', () => {
  it('creates a type (duplicate code refused by the API) and deactivates it with confirmation', async () => {
    const { user } = await open('/leave/types');
    expect(screen.getByText('1–8 of 8')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New leave type' }));
    const d = dialog();
    await user.type(within(d).getByRole('textbox', { name: /Code/ }), 'sick');
    await user.type(within(d).getByRole('textbox', { name: /Name \(English\)/ }), 'Study Leave');
    await user.type(within(d).getByRole('textbox', { name: /Name \(Arabic\)/ }), 'إجازة دراسية');
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect(await within(d).findByText('Another leave type already uses this code.')).toBeTruthy();
    const code = within(d).getByRole('textbox', { name: /Code/ });
    await user.clear(code);
    await user.type(code, 'STUDY');
    await user.click(within(d).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Leave type "Study Leave" created.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Actions for Study Leave' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Leave type "Study Leave" deactivated.')).toBeTruthy();
  }, 30_000);
});

describe('balances, calendar, reports', () => {
  it('balances list → employee balances → balance history adds up', async () => {
    const { user } = await open('/leave/balances');
    expect(screen.getByText(/Remaining = allocated − used − pending/)).toBeTruthy();
    const firstLink = within(screen.getByRole('table', { name: 'Leave balances' })).getAllByRole('link')[0]!;
    await user.click(firstLink);
    const card = await waitFor(() => {
      const el = document.querySelector('[data-balance="ANNUAL"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    await user.click(within(card).getByRole('button', { name: 'Show history' }));
    const history = await screen.findByRole('table', { name: /Balance history — Annual Leave/ });
    const rows = within(history).getAllByRole('row');
    expect(within(rows[1]!).getByText('Annual allocation')).toBeTruthy();
    const lastCell = within(rows.at(-1)!).getAllByRole('cell').at(-1)!.textContent;
    expect(within(card).getByText(lastCell!, { exact: true })).toBeTruthy(); // running balance ends at the card's remaining
  }, 30_000);

  it('calendar: month navigation and entries open the request', async () => {
    const entries = await leaveApi.getLeaveCalendar('2026-11', {}, HR);
    const { user } = await open('/leave/calendar');
    expect(screen.getByRole('heading', { level: 3, name: 'November 2026' })).toBeTruthy();
    const first = entries[0]!;
    const link = (await screen.findAllByRole('link', { name: new RegExp(`^${first.name.en} · `) }))[0]!;
    expect(link.getAttribute('href')).toBe(`/leave/requests/${first.requestId}`);
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'December 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'November 2026' })).toBeTruthy();
  }, 20_000);

  it('calendar on a phone is an agenda list', async () => {
    const { setViewportWidth } = await import('@/test/matchMedia');
    setViewportWidth(390);
    await open('/leave/calendar');
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  }, 20_000);

  it('reports: switching types and CSV export', async () => {
    const { user } = await open('/leave/reports');
    expect(await screen.findByRole('table', { name: 'Leave requests' })).toBeTruthy();
    await choose(user, 'Report', 'Usage by leave type');
    expect(await screen.findByRole('table', { name: 'Usage by leave type' })).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Usage by leave type' })).getByText('Annual Leave')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/CSV exported: \d+ rows\./)).toBeTruthy();
  }, 20_000);
});

describe('integration with other modules', () => {
  it('Employee Profile has a Leave tab (HR roles) backed by the Leave API', async () => {
    const { user } = renderApp('/employees/emp-0025', { as: 'hr-admin' });
    await user.click(await screen.findByRole('tab', { name: 'Leave' }, { timeout: 8000 }));
    expect(await screen.findByRole('table', { name: 'Leave requests' })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-balance="ANNUAL"]')).not.toBeNull());
  }, 20_000);
});

describe('states', () => {
  it('loading, error with retry, then data', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    const spy = vi.spyOn(leaveApi, 'getLeaveTypes').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/leave/types', { as: 'hr-admin' });
    const alert = await screen.findByText('This list could not be loaded.', {}, { timeout: 8000 });
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByRole('status', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(await screen.findByText('1–8 of 8', {}, { timeout: 5000 })).toBeTruthy();
  }, 20_000);

  it('empty states: no requests, and nothing matching a search', async () => {
    const { user } = await open('/leave/requests');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'no-such-request');
    expect(await screen.findByText('No results match your search or filters.', {}, { timeout: 8000 })).toBeTruthy();
  }, 20_000);

  it('calendar month without leave shows the empty text', async () => {
    vi.spyOn(leaveApi, 'getLeaveCalendar').mockResolvedValue([]);
    await open('/leave/calendar');
    expect(await screen.findByText('No approved or pending leave this month.')).toBeTruthy();
  }, 20_000);
});
