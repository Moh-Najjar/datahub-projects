import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { employeesApi } from '@/modules/employees';
import { payrollApi } from '@/modules/payroll';
import { reportsApi } from '@/modules/reports/api/reportsApi';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* Reports & Analytics UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const settled = () => waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 15_000 });
async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /^(Reports & Analytics|التقارير والتحليلات|Access denied)$/ }, { timeout: 10_000 });
  await settled();
  return utils;
}
const kpi = (key: string) => document.querySelector(`[data-kpi="${key}"]`)?.textContent;
const kpiStatus = (key: string) => document.querySelector(`[data-kpi-status^="${key}:"]`)?.getAttribute('data-kpi-status')?.split(':')[1];
const tabs = () => within(screen.getByRole('navigation', { name: 'Reports sections' })).getAllByRole('tab').map((t) => t.textContent);

describe('access by role', () => {
  it('HR Administrator: every section', async () => {
    await open('/reports');
    expect(tabs()).toEqual(['Overview', 'Employees', 'Attendance', 'Leave', 'Recruitment', 'Performance', 'Payroll', 'Documents', 'HR insights', 'Executive', 'Report builder', 'Saved reports']);
  }, 30_000);

  it('Department Manager: team sections only — no payroll, insights or executive', async () => {
    await open('/reports', 'department-manager');
    expect(tabs()).toEqual(['Overview', 'Employees', 'Attendance', 'Leave', 'Recruitment', 'Performance', 'Documents', 'Report builder', 'Saved reports']);
    expect(screen.getByText('Reports on the departments you manage.')).toBeTruthy();
  }, 30_000);

  it('Payroll Officer and Recruiter land on their own category', async () => {
    await open('/reports', 'payroll-officer');
    expect(tabs()).toEqual(['Payroll', 'Report builder', 'Saved reports']);
    expect(screen.getByRole('tab', { name: 'Payroll' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('heading', { name: 'Payroll summary' })).toBeTruthy();
  }, 30_000);

  it('a section outside the role goes back to the allowed start', async () => {
    await open('/reports/payroll', 'recruiter');
    expect(screen.getByRole('tab', { name: 'Recruitment' }).getAttribute('aria-selected')).toBe('true');
  }, 30_000);

  it('Employee: access denied', async () => {
    await open('/reports', 'employee');
    expect(screen.getByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
  }, 30_000);
});

describe('overview', () => {
  it('eight key figures from the source modules and seven charts', async () => {
    const total = (await employeesApi.getEmployees({ page: 1, pageSize: 1 }, { kind: 'organization', role: 'hr-admin' })).total;
    await open('/reports');
    await waitFor(() => expect(kpi('totalEmployees')).toBe(total.toLocaleString('en-US')));
    for (const key of ['activeEmployees', 'attendanceRate', 'pendingLeave', 'openPositions', 'averageRating', 'documentCompliance']) expect(kpi(key), key).toBeTruthy();
    expect(kpi('payrollCost')).toMatch(/^JOD [0-9,]+\.\d{3}$/);
    for (const title of ['Headcount trend', 'Attendance trend', 'Leave by type', 'Recruitment funnel', 'Rating distribution', 'Payroll cost trend', 'Document compliance']) expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    await waitFor(() => expect(recordedCharts.length).toBeGreaterThanOrEqual(7));
  }, 30_000);

  it('restricted figures say so instead of showing zero', async () => {
    await open('/reports', 'department-manager');
    await waitFor(() => expect(kpiStatus('payrollCost')).toBe('restricted'));
    expect(screen.getAllByText('Not in your permissions').length).toBeGreaterThanOrEqual(2); // KPI + chart
    expect(kpi('payrollCost')).toBeUndefined();
  }, 30_000);

  it('a failing module marks only its figures, with retry', async () => {
    const spy = vi.spyOn(payrollApi, 'getPayrollReports').mockRejectedValueOnce(new ApiError('SERVER')).mockRejectedValueOnce(new ApiError('SERVER')).mockRejectedValueOnce(new ApiError('SERVER'));
    const { user } = await open('/reports');
    await waitFor(() => expect(kpiStatus('payrollCost')).toBe('error'));
    expect(kpi('totalEmployees')).toBeTruthy();
    spy.mockRestore();
    await user.click(within(document.querySelector('[data-kpi-status^="payrollCost:"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(kpi('payrollCost')).toMatch(/^JOD /));
  }, 30_000);

  it('invalid filters show what to fix', async () => {
    await open('/reports');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('The end date is before the start date.')).toBeTruthy();
  }, 30_000);
});

describe('category reports', () => {
  it('choose a report, search, sort, export CSV and print', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const { user } = await open('/reports/employees');
    expect(await screen.findByRole('heading', { name: 'Employee directory' })).toBeTruthy();
    await user.click(screen.getByRole('combobox', { name: 'Report' }));
    await user.click(await screen.findByRole('option', { name: 'Headcount by department' }));
    expect(await screen.findByRole('heading', { name: 'Headcount by department' })).toBeTruthy();
    await settled();
    const table = screen.getByRole('table', { name: 'Headcount by department' });
    expect(within(table).getByRole('columnheader', { name: /Department/ })).toBeTruthy();
    await user.type(screen.getByRole('searchbox', { name: 'Search in results' }), 'Engineering');
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBeLessThan(6));
    await user.click(within(table).getByRole('button', { name: 'Active' }));
    expect(screen.getByText('How this is calculated')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/^Exported \d+ records to employees-by-department_/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Print / PDF' }));
    expect(await screen.findByText(/Save as PDF/)).toBeTruthy();
  }, 40_000);

  it('only the filters that apply to a report are shown', async () => {
    await open('/reports/leave?report=leave.pending');
    expect(await screen.findByRole('heading', { name: 'Pending approvals' })).toBeTruthy();
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Employment type' })).toBeNull();
  }, 30_000);

  it('payroll amounts are exact and in JOD, with the status basis stated', async () => {
    await open('/reports/payroll?report=payroll.monthly');
    expect(await screen.findByRole('heading', { name: 'Monthly payroll cost' })).toBeTruthy();
    await settled();
    expect(screen.getByText(/Approved and paid payroll runs only/)).toBeTruthy();
    const amount = document.querySelector('table bdi[dir="ltr"]');
    expect(amount?.textContent).toMatch(/^[0-9,]+\.\d{3}$/);
  }, 30_000);

  it('error state with retry', async () => {
    const spy = vi.spyOn(reportsApi, 'getEmployeeReports').mockRejectedValue(new ApiError('SERVER'));
    const { user } = await open('/reports/employees');
    expect(await screen.findByText('The report could not be generated.')).toBeTruthy();
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Employee directory' })).toBeTruthy();
  }, 30_000);
});

describe('saved reports and builder', () => {
  it('save, list, reopen, rename and delete a report configuration', async () => {
    const { user } = await open('/reports/employees?report=employees.new-hires');
    await user.click(await screen.findByRole('button', { name: 'Save report' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save report' });
    const name = within(dialog).getByRole('textbox', { name: /Name/ });
    await user.clear(name);
    await user.type(name, 'Autumn hires');
    await user.click(within(dialog).getByRole('button', { name: 'Save report' }));
    expect(await screen.findByText('Saved "Autumn hires".')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('tab', { name: 'Saved reports' }));
    const row = (await screen.findByRole('cell', { name: 'Autumn hires' })).closest('tr')!;
    expect(within(row).getByText('New hires')).toBeTruthy();
    await user.click(within(row).getByRole('link', { name: 'Open: Autumn hires' }));
    expect(await screen.findByText('Opened from your saved report "Autumn hires".')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Saved reports' }));
    await user.click(await screen.findByRole('button', { name: 'Rename: Autumn hires' }));
    const rename = await screen.findByRole('dialog', { name: 'Rename saved report' });
    await user.clear(within(rename).getByRole('textbox', { name: /Name/ }));
    await user.type(within(rename).getByRole('textbox', { name: /Name/ }), 'Hires Q4');
    await user.click(within(rename).getByRole('button', { name: 'Update' }));
    expect(await screen.findByRole('cell', { name: 'Hires Q4' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Delete: Hires Q4' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/You have no saved reports yet/)).toBeTruthy();
  }, 40_000);

  it('builds a grouped report from an existing dataset', async () => {
    const { user } = await open('/reports/builder');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Employee number' })).toBeTruthy(), { timeout: 10_000 });
    await user.click(screen.getByRole('combobox', { name: 'Group by' }));
    await user.click(await screen.findByRole('option', { name: 'Status' }));
    await user.click(screen.getByRole('button', { name: 'Run preview' }));
    const table = await screen.findByRole('table', { name: /Preview/ }, { timeout: 10_000 });
    expect(within(table).getByRole('columnheader', { name: 'Records' })).toBeTruthy();
    expect(within(table).getByText('Active')).toBeTruthy();
  }, 40_000);
});

describe('Arabic and RTL', () => {
  it('translated, right-to-left, charts mirrored, identifiers left-to-right', async () => {
    const { user } = await open('/reports/employees?report=employees.by-department');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'التقارير والتحليلات' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(await screen.findByRole('heading', { name: 'عدد الموظفين حسب القسم' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'منشئ التقارير' })).toBeTruthy();
    await waitFor(() => expect(recordedCharts.some((c) => (c.option.xAxis as { inverse?: boolean } | undefined)?.inverse === true)).toBe(true));
  }, 30_000);
});
