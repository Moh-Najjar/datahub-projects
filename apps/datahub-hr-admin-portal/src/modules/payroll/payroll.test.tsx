import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failNextRequest } from '@/core/api/mock/mockConfig';
import type { Role } from '@/core/config/permissions';
import { payrollApi } from '@/modules/payroll/api/payrollApi';
import type { PayrollScope } from '@/modules/payroll/types/payroll';
import { formatAmount } from '@/modules/payroll/utils/format';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

type User = ReturnType<typeof renderApp>['user'];
const HR: PayrollScope = { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' };
const EMPLOYEE: PayrollScope = { kind: 'own', userId: 'usr-0005', role: 'employee' };

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /^(Payroll|My payroll|الرواتب|راتبي|Access denied)$/ }, { timeout: 8000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 8000 });
  return utils;
}
const kpi = (key: string) => document.querySelector(`[data-kpi="${key}"]`)?.textContent;
const runId = async (department: string) => (await payrollApi.getPayrollRuns({ page: 1, pageSize: 50, filters: { month: '2026-11', departmentId: department } }, HR)).items.find((r) => r.status !== 'cancelled')!.id;
async function confirm(user: User, button: string) {
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: button }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('overview', () => {
  it('six KPIs from the same dataset, the current period and four charts', async () => {
    const s = await payrollApi.getPayrollSummary(HR);
    await open('/payroll');
    expect(kpi('totalEmployees')).toBe(String(s.totalEmployees));
    expect(kpi('gross')).toBe(`JOD ${formatAmount(s.latest!.gross, 'JOD', 'en')}`);
    expect(kpi('net')).toBe(`JOD ${formatAmount(s.latest!.net, 'JOD', 'en')}`);
    expect(kpi('deductions')).toBe(`JOD ${formatAmount(s.latest!.deductions, 'JOD', 'en')}`);
    expect(kpi('pendingRuns')).toBe('3');
    expect(kpi('awaitingApproval')).toBe('1');
    expect(screen.getByRole('heading', { name: 'Current period: November 2026' })).toBeTruthy();
    for (const title of ['Monthly payroll cost', 'Gross versus net salary', 'Payroll cost by department', 'Salary distribution']) expect(screen.getByRole('img', { name: title }), title).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Recent payroll activity' })).toBeTruthy();
    expect(screen.getByText(/Payments, bank transfers and e-mails are never made/)).toBeTruthy();
  }, 20_000);

  it('Arabic + dark: translated, RTL, charts mirrored, amounts and codes left-to-right', async () => {
    const { user } = await open('/payroll');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'الرواتب' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(screen.getByRole('tab', { name: 'مسيرات الرواتب' })).toBeTruthy();
    const gross = document.querySelector('[data-kpi="gross"] [dir="ltr"]');
    expect(gross?.textContent).toMatch(/^JOD [0-9,]+\.\d{3}$/);
    await waitFor(() => expect(recordedCharts.some((c) => (c.option.xAxis as { inverse?: boolean } | undefined)?.inverse === true)).toBe(true));
  }, 20_000);

  it('error state with retry, then the data', async () => {
    // The first try and the two automatic retries fail.
    for (let i = 0; i < 3; i++) failNextRequest('SERVER');
    const { user } = await open('/payroll');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(kpi('pendingRuns')).toBe('3'));
  }, 20_000);
});

describe('payroll run workflow', () => {
  it('Payroll Officer calculates, validates and submits; HR approves; the officer records the (simulated) payment', async () => {
    const id = await runId('dep-ops');
    const officer = await open(`/payroll/runs/${id}`, 'payroll-officer');
    await officer.user.click(await screen.findByRole('button', { name: 'Calculate' }));
    expect(await screen.findByText('The payroll was calculated.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Submit for approval' }) as HTMLButtonElement).disabled).toBe(true);
    await officer.user.click(screen.getByRole('button', { name: 'Validate' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Submit for approval' }) as HTMLButtonElement).disabled).toBe(false));
    await officer.user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText('Waiting for an approver (HR Administrator or System Administrator).')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    const run = await payrollApi.getPayrollRunById(id, HR);
    const table = screen.getByRole('table', { name: 'Employees' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.getByText(`JOD ${formatAmount(run.totals!.net, 'JOD', 'en')}`)).toBeTruthy();
    officer.unmount();

    const hr = await open(`/payroll/runs/${id}`, 'hr-admin');
    await hr.user.click(await screen.findByRole('button', { name: 'Approve' }));
    await confirm(hr.user, 'Approve');
    expect(await screen.findByText('The run was approved.')).toBeTruthy();
    hr.unmount();

    const back = await open(`/payroll/runs/${id}`, 'payroll-officer');
    await back.user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    expect(screen.getByText(/No money is transferred/)).toBeTruthy();
    await confirm(back.user, 'Mark as paid');
    expect(await screen.findByText(/No bank transfer was made/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getAllByText(/Marked as paid by .* \(simulated\)/).length).toBeGreaterThan(0);
  }, 40_000);

  it('rejection requires a reason; creators cannot approve their own run', async () => {
    const id = await runId('dep-eng');
    const { user, unmount } = await open(`/payroll/runs/${id}`, 'hr-admin');
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('Give a reason (at least 5 characters).')).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Loan figures need a second check.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Loan figures need a second check.', { selector: 'div' })).toBeTruthy();
    unmount();

    const own = await payrollApi.createPayrollRun({ periodStart: '2026-12-01', periodEnd: '2026-12-31', paymentDate: '2026-12-31', payFrequency: 'monthly', departmentId: null, currency: 'JOD' }, HR);
    await payrollApi.calculatePayrollRun(own.id, HR);
    await payrollApi.validatePayrollRun(own.id, HR);
    await payrollApi.submitPayrollForApproval(own.id, HR);
    await open(`/payroll/runs/${own.id}`, 'hr-admin');
    expect(await screen.findByText(/You created this run, so you cannot approve or reject it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  }, 30_000);

  it('creates a run (duplicate periods are refused) and opens the employee breakdown', async () => {
    const { user } = await open('/payroll/runs', 'payroll-officer');
    await user.click(await screen.findByRole('button', { name: 'New payroll run' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Payroll period/), { target: { value: '2026-11' } });
    fireEvent.change(within(dialog).getByLabelText(/Payment date/), { target: { value: '2026-11-30' } });
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('A payroll run already covers these employees for this period.')).toBeTruthy();
    await user.click(within(dialog).getByRole('combobox', { name: 'Department scope' }));
    await user.click(await screen.findByRole('option', { name: 'Human Resources' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText(/was created as a draft/)).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Calculate' }));
    const table = await screen.findByRole('table', { name: 'Employees' });
    const first = within(table).getAllByRole('link')[0]!;
    await user.click(first);
    expect(await screen.findByRole('table', { name: 'Earnings' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Deductions' })).toBeTruthy();
    expect(screen.getByText('Calculation inputs')).toBeTruthy();
    expect(screen.getByText(/Overtime is not paid/)).toBeTruthy();
  }, 30_000);
});

describe('compensation', () => {
  it('updating compensation adds a history record; earlier records stay', async () => {
    const list = await payrollApi.getEmployeeCompensations({ page: 1, pageSize: 1, filters: { status: 'active', employmentStatus: 'active' } }, HR);
    const id = list.items[0]!.employeeId;
    const before = (await payrollApi.getEmployeeCompensation(id, HR)).history.length;
    const { user } = await open(`/payroll/compensation/${id}`, 'payroll-officer');
    await user.click(await screen.findByRole('button', { name: 'Update compensation' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByRole('textbox', { name: /Monthly basic salary/ });
    await user.clear(amount);
    await user.type(amount, '1234.5678');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/at most the currency's decimals/)).toBeTruthy();
    await user.clear(amount);
    await user.type(amount, '1234.567');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The compensation was saved.')).toBeTruthy();
    const history = screen.getByRole('table', { name: 'Salary history' });
    await waitFor(() => expect(within(history).getAllByRole('row')).toHaveLength(before + 2));
    expect(within(history).getByText('JOD 1,234.567')).toBeTruthy();
  }, 30_000);

  it('the list filters by employment status and shows salaries only here (payroll:read)', async () => {
    const { user } = await open('/payroll/compensation');
    const table = await screen.findByRole('table', { name: 'Employee compensation' });
    expect(within(table).getAllByText(/^JOD /).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('combobox', { name: 'Employee status' }));
    await user.click(await screen.findByRole('option', { name: 'Inactive' }));
    await waitFor(() => expect(within(table).queryAllByText('Not set').length + within(table).getAllByRole('row').length).toBeGreaterThan(1));
  }, 20_000);
});

describe('self-service and permissions', () => {
  it('the employee sees only My payroll and their own payslips', async () => {
    const { user, router } = await open('/payroll', 'employee');
    expect(screen.getByRole('heading', { level: 1, name: 'My payroll' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Payroll sections' })).toBeNull();
    expect(screen.queryByText('Total gross payroll')).toBeNull();
    const history = screen.getByRole('table', { name: 'My payroll history' });
    expect(within(history).getAllByRole('row')).toHaveLength(12); // header + 11 payslips
    await user.click(within(history).getByRole('link', { name: 'Open the payslip for October 2026' }));
    expect(await screen.findByRole('article')).toBeTruthy();
    expect(screen.getAllByText('Sami Odeh').length).toBeGreaterThan(0);
    // Organization pages redirect; another employee's payslip is "not found".
    await router.navigate('/payroll/runs');
    await waitFor(() => expect(router.state.location.pathname).toBe('/payroll'));
    const other = (await payrollApi.getPayslips({ page: 1, pageSize: 5, filters: { month: '2026-10' } }, HR)).items.find((p) => p.employeeId !== 'emp-0025')!;
    await router.navigate(`/payroll/payslips/${other.id}`);
    expect(await screen.findByText('This payslip does not exist or is not available to you.')).toBeTruthy();
    expect((await payrollApi.getMyPayslips({ page: 1, pageSize: 1 }, EMPLOYEE)).items[0]!.employeeId).toBe('emp-0025');
  }, 30_000);

  it('Department Manager and Recruiter: own payroll only; HR Manager reads without actions', async () => {
    for (const role of ['department-manager', 'recruiter'] as Role[]) {
      const { unmount } = await open('/payroll', role);
      expect(screen.getByRole('heading', { level: 1, name: 'My payroll' })).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
      unmount();
    }
    const id = await runId('dep-eng');
    await open(`/payroll/runs/${id}`, 'hr-manager');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New payroll run' })).toBeNull();
  }, 30_000);
});

describe('payslips and reports', () => {
  it('a bilingual payslip, switchable between English and Arabic', async () => {
    const slip = (await payrollApi.getPayslips({ page: 1, pageSize: 1, filters: { month: '2026-10' } }, HR)).items[0]!;
    const { user } = await open(`/payroll/payslips/${slip.id}`);
    const doc = await screen.findByRole('article');
    expect(doc.getAttribute('dir')).toBe('ltr');
    expect(within(doc).getByText('Net salary')).toBeTruthy();
    expect(within(doc).getByText('صافي الراتب')).toBeTruthy();
    expect(within(doc).getByText(`JOD ${formatAmount(slip.net, 'JOD', 'en')}`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'العربية' }));
    await waitFor(() => expect(screen.getByRole('article').getAttribute('dir')).toBe('rtl'));
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy();
  }, 20_000);

  it('reports: totals, empty state and CSV export', async () => {
    const { user } = await open('/payroll/reports');
    const table = await screen.findByRole('table', { name: 'Payroll summary' });
    expect(within(table).getByText('Total')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/payroll-summary-.*\.csv was downloaded/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2027-03' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-01' } });
    expect(await screen.findByText('No approved payroll matches these filters.')).toBeTruthy();
  }, 30_000);
});
