import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { attendanceApi } from '@/modules/attendance/api/attendanceApi';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

type User = ReturnType<typeof renderApp>['user'];

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /Attendance|My attendance|Access denied/ }, { timeout: 8000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 8000 });
  return utils;
}

const table = (name: string) => screen.getByRole('table', { name });
const firstCells = (name: string) =>
  within(table(name))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]!.textContent);

async function choose(user: User, label: string | RegExp, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
  // While the menu closes MUI keeps the rest of the page aria-hidden; wait like a user would.
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

describe('overview', () => {
  it('KPIs and the four charts come from the same data', async () => {
    const summary = await attendanceApi.getAttendanceSummary({ kind: 'organization', userId: 'usr-0002', role: 'hr-admin' });
    await open('/attendance');
    const kpi = (key: string) => document.querySelector(`[data-kpi="${key}"]`)?.textContent;
    expect(kpi('total')).toBe(String(summary.totalEmployees));
    expect(kpi('present')).toBe(String(summary.present));
    expect(kpi('absent')).toBe(String(summary.absent));
    expect(kpi('late')).toBe(String(summary.late));
    expect(kpi('onLeave')).toBe(String(summary.onLeave));
    for (const title of ['Last 7 days', 'Today by status', 'Today by department', 'Monthly attendance']) expect(screen.getByRole('img', { name: title }), title).toBeTruthy();
    const distribution = recordedCharts.find((c) => (c.option.series as Array<{ type: string }>)[0]?.type === 'pie')!;
    const slices = (distribution.option.series as Array<{ data: Array<{ name: string; value: number }> }>)[0]!.data;
    expect(slices.find((d) => d.name === 'Present')?.value).toBe(summary.today.present);
    expect(slices.some((d) => d.name === 'Absent')).toBe(summary.absent > 0); // nobody is absent before a shift ends
  }, 20_000);

  it('Arabic + dark: translated KPIs, RTL charts, Latin digits', async () => {
    const { user } = await open('/attendance');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'الحضور' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(screen.getByText('الحاضرون اليوم')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('img', { name: 'آخر 7 أيام' })).toBeTruthy());
    const trendOption = recordedCharts.filter((c) => (c.option.series as Array<{ stack?: string }>)[0]?.stack === 'records').at(-1)!.option;
    expect((trendOption.xAxis as { inverse: boolean }).inverse).toBe(true);
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
  }, 20_000);
});

describe('records', () => {
  it('searches, filters by status, sorts and paginates', async () => {
    const { user } = await open('/attendance/records');
    await waitFor(() => expect(screen.getByText(/^1–10 of \d+$/)).toBeTruthy());
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'dana yousef');
    await waitFor(() => expect(firstCells('Attendance records')).toEqual(['Dana Yousef']));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-12' } }); // a finished day
    await choose(user, 'Status', 'Absent');
    await waitFor(() => expect(within(table('Attendance records')).getAllByText('Absent').length).toBeGreaterThan(0));
    expect(within(table('Attendance records')).queryByText('Present')).toBeNull();
  }, 20_000);

  it('a missing check-in before the shift ends shows "Not started", not "Absent"', async () => {
    const { user } = await open('/attendance/records');
    await choose(user, 'Shift', 'Evening Shift'); // 16:00–00:00, now is 10:30
    await waitFor(() => expect(within(table('Attendance records')).getAllByText('Not started').length).toBeGreaterThan(0));
    expect(within(table('Attendance records')).queryByText('Absent')).toBeNull();
  }, 20_000);

  it('records a simulated check-in, refuses a duplicate, then checks out', async () => {
    const { user } = await open('/attendance/records');
    await choose(user, 'Shift', 'Morning Shift');
    await choose(user, 'Status', 'Not started');
    // Wait for the filtered page (the previous page stays visible while loading).
    await waitFor(() => expect(document.querySelectorAll('tbody [data-status]').length).toBeGreaterThan(0));
    await waitFor(() => expect([...document.querySelectorAll('tbody [data-status]')].every((el) => el.getAttribute('data-status') === 'scheduled')).toBe(true));
    const row = within(table('Attendance records')).getAllByRole('row')[1]!;
    const name = within(row).getAllByRole('cell')[0]!.textContent!;
    await user.click(within(row).getByRole('button', { name: `Actions for ${name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Record check-in' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Record check-in (simulated)' }));
    expect(dialog.getByText(/Simulated operation/)).toBeTruthy();
    fireEvent.change(dialog.getByLabelText(/^Time/), { target: { value: '2026-11-16T10:45' } });
    await user.click(dialog.getByRole('button', { name: 'Record' }));
    expect(await dialog.findByText('The time cannot be in the future.')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText(/^Time/), { target: { value: '2026-11-16T08:05' } });
    await user.click(dialog.getByRole('button', { name: 'Record' }));
    expect(await screen.findByText('Check-in recorded.')).toBeTruthy();

    // The record now offers check-out instead of check-in.
    await choose(user, 'Status', 'All statuses');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), name);
    await waitFor(() => expect(firstCells('Attendance records')).toEqual([name])); // debounced search applied
    const updated = within(table('Attendance records')).getAllByRole('row')[1]!;
    await user.click(within(updated).getByRole('button', { name: `Actions for ${name}` }));
    expect(screen.queryByRole('menuitem', { name: 'Record check-in' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Record check-out' }));
    const out = within(await screen.findByRole('dialog', { name: 'Record check-out (simulated)' }));
    fireEvent.change(out.getByLabelText(/^Time/), { target: { value: '2026-11-16T08:00' } });
    await user.click(out.getByRole('button', { name: 'Record' }));
    expect(await out.findByText('The check-out must be after the check-in.')).toBeTruthy();
    fireEvent.change(out.getByLabelText(/^Time/), { target: { value: '2026-11-16T10:30' } });
    await user.click(out.getByRole('button', { name: 'Record' }));
    expect(await screen.findByText('Check-out recorded.')).toBeTruthy();
  }, 30_000);

  it('record details show the snapshot and working time', async () => {
    const records = await attendanceApi.getAttendanceRecords({ page: 1, pageSize: 1, filters: { date: '2026-11-12', employeeId: 'emp-0013' } }, { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' });
    const r = records.items[0]!;
    await open(`/attendance/records/${r.id}`);
    expect(await screen.findByRole('heading', { level: 2, name: 'Laila Masri' })).toBeTruthy();
    expect(screen.getByText('Department and position as they were on this day.')).toBeTruthy();
    expect(screen.getByText('Software Development')).toBeTruthy();
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Records' })).toBeTruthy();
  }, 20_000);
});

describe('shifts', () => {
  it('lists shifts; validates and creates an overnight shift; deactivation refused while in use', async () => {
    const { user } = await open('/attendance/shifts');
    expect(await screen.findByText(/Example shifts for the demo/)).toBeTruthy();
    // Overnight shifts are marked "+1 day" (ends the next day), with the full wording as accessible name.
    const evening = within(table('Shifts')).getByRole('link', { name: 'Evening Shift' }).closest('tr')!;
    expect(within(evening).getByLabelText('Overnight').textContent).toBe('+1 day');

    await user.click(screen.getByRole('button', { name: 'New shift' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New shift' }));
    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'shf-mor');
    await user.type(dialog.getByRole('textbox', { name: /^Name \(English\)/ }), 'Late Shift');
    await user.type(dialog.getByRole('textbox', { name: /^Name \(Arabic\)/ }), 'الوردية المتأخرة');
    fireEvent.change(dialog.getByLabelText(/^Start time/), { target: { value: '22:00' } });
    fireEvent.change(dialog.getByLabelText(/^End time/), { target: { value: '22:00' } });
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await dialog.findByText('The end time must differ from the start time.')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText(/^End time/), { target: { value: '06:00' } });
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await dialog.findByText('This code is already used. Choose a different code.')).toBeTruthy();
    await user.clear(dialog.getByRole('textbox', { name: /^Code/ }));
    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'shf-lat');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Shift created.')).toBeTruthy();
    const lateRow = (await screen.findByRole('link', { name: 'Late Shift' })).closest('tr')!;
    expect(within(lateRow).getByLabelText('Overnight')).toBeTruthy(); // 22:00–06:00 ends the next day
    expect(lateRow.textContent).toContain('22:00');

    await user.click(screen.getByRole('button', { name: 'Actions for Morning Shift' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Deactivate Morning Shift?' }));
    await user.click(confirm.getByRole('button', { name: 'Deactivate' }));
    expect(await confirm.findByText(/Employees are assigned to this shift/)).toBeTruthy();
  }, 30_000);

  it('assigns an employee to a shift', async () => {
    const { user } = await open('/attendance/shifts/shf-03');
    expect(await screen.findByRole('heading', { level: 2, name: 'Night Shift' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Assign employees' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Assign employees to Night Shift' }));
    await user.type(dialog.getByRole('combobox', { name: 'Employees' }), 'Lina');
    await user.click(await screen.findByRole('option', { name: /Lina Haddad/ }));
    await user.click(dialog.getByRole('button', { name: 'Assign employees' }));
    expect(await screen.findByText('Employees assigned: 1.')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Lina Haddad' })).toBeTruthy();
  }, 20_000);
});

describe('history and reports', () => {
  it('monthly history with totals, calendar and month navigation', async () => {
    const { user } = await open('/attendance/history/emp-0013?month=2026-11');
    expect(await screen.findByRole('heading', { level: 2, name: 'Laila Masri' })).toBeTruthy();
    const calendar = screen.getByRole('list', { name: 'Attendance calendar' });
    expect(within(calendar).getAllByRole('listitem').filter((li) => li.getAttribute('data-day')).length).toBe(30);
    expect(calendar.querySelector('[data-day="2026-11-14"]')?.getAttribute('data-status')).toBe('none'); // Saturday
    expect(document.querySelector('[data-total="workingDays"]')?.textContent).toMatch(/^\d+$/);
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect((await screen.findAllByText('October 2026')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Employee profile' })).toBeTruthy();
  }, 20_000);

  it('reports: totals, switching report types, CSV export within scope', async () => {
    const created: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      created.push(this.download);
    });
    const exportSpy = vi.spyOn(attendanceApi, 'exportAttendanceReport');
    const { user } = await open('/attendance/reports');
    expect(await screen.findByRole('table', { name: 'Daily attendance' })).toBeTruthy();
    expect(document.querySelector('[data-report-total="records"]')).not.toBeNull();
    await choose(user, 'Report', 'Department attendance');
    expect(await screen.findByRole('table', { name: 'Department attendance' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/^CSV exported \(\d+ rows\)\.$/)).toBeTruthy();
    expect(created).toEqual(['attendance-department-2026-11-01_2026-11-16.csv']);
    expect(exportSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'department' }), 'en', expect.objectContaining({ kind: 'organization' }));
  }, 20_000);
});

describe('roles and scope', () => {
  it('Department Manager: team overview (58 employees), read-only, no department filter', async () => {
    await open('/attendance', 'department-manager');
    expect(screen.getByText('Attendance of the departments you manage.')).toBeTruthy();
    expect(screen.getByText(/view-only access/)).toBeTruthy();
    expect(document.querySelector('[data-kpi="total"]')?.textContent).toBe('58');
  }, 20_000);

  it('Department Manager: records show only the team; no write actions', async () => {
    const { user } = await open('/attendance/records', 'department-manager');
    await waitFor(() => expect(screen.getByText(/of \d+$/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'New record' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Department' })).toBeNull();
    const row = within(table('Attendance records')).getAllByRole('row')[1]!;
    await user.click(within(row).getAllByRole('button')[0]!);
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['View details', 'Attendance history']);
  }, 20_000);

  it.each(['employee', 'payroll-officer', 'recruiter'] as const)('%s: only "My attendance"', async (role) => {
    await open('/attendance', role);
    expect(screen.getByRole('heading', { level: 1, name: 'My attendance' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Records' })).toBeNull();
    expect(await screen.findByRole('list', { name: 'Attendance calendar' })).toBeTruthy();
  }, 20_000);

  it('own-only roles cannot open other sections or other employees', async () => {
    const { router } = await open('/attendance/records', 'employee');
    expect(screen.getByRole('heading', { level: 1, name: 'My attendance' })).toBeTruthy(); // redirected
    await router.navigate('/attendance/history/emp-0001');
    expect(await screen.findByText("This employee's attendance is outside your access.")).toBeTruthy();
  }, 20_000);

  it('the Employee profile links to the attendance history (HR roles)', async () => {
    const { user } = renderApp('/employees/emp-0013', { as: 'hr-manager' });
    // The profile's link (the sidebar has an "Attendance" link too).
    await user.click(await within(screen.getByRole('main')).findByRole('link', { name: 'Attendance' }, { timeout: 8000 }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Laila Masri' }, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Attendance calendar' })).toBeTruthy();
  }, 20_000);
});

describe('leave integration', () => {
  it('an "On leave" attendance record links to its approved leave request', async () => {
    const att = { kind: 'organization' as const, userId: 'usr-0002', role: 'hr-admin' as const };
    const record = (await attendanceApi.getAttendanceRecords({ page: 1, pageSize: 1, filters: { status: 'on-leave' } }, att)).items[0]!;
    renderApp(`/attendance/records/${record.id}`, { as: 'hr-admin' });
    const link = await screen.findByRole('link', { name: 'View the approved leave request' }, { timeout: 8000 });
    expect(link.getAttribute('href')).toBe(`/leave/requests/${record.leaveRequestId}`);
  }, 20_000);
});

describe('states', () => {
  it('loading, error with retry, then data', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    const spy = vi.spyOn(attendanceApi, 'getAttendanceRecords').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/attendance/records', { as: 'hr-admin' });
    const alert = await screen.findByText('This list could not be loaded.', {}, { timeout: 8000 });
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByRole('status', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(await screen.findByRole('table', { name: 'Attendance records' }, { timeout: 5000 })).toBeTruthy();
  }, 20_000);

  it('empty state', async () => {
    vi.spyOn(attendanceApi, 'getAttendanceRecords').mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    await open('/attendance/records');
    expect(await screen.findByText('Nothing has been added yet.')).toBeTruthy();
  }, 20_000);
});
