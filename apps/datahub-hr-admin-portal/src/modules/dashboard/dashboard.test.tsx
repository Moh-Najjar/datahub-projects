import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { chartColors } from '@/core/theme/tokens';
import { dashboardApi } from '@/modules/dashboard/api/dashboardApi';
import * as mock from '@/modules/dashboard/mock/dashboardMock';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

const CHARTS = ['Employee growth', 'Attendance today', 'Employees by department', 'Leave requests'];
const KPI_LABELS = ['Total employees', 'Active employees', 'New hires this month', 'On leave today', 'Attendance today', 'Open positions'];

/** Props the chart titled `name` last received (via the ECharts test double). */
function chartProps(name: string) {
  const box = screen.getByRole('img', { name });
  const index = Number(within(box).getByTestId('echarts-stub').getAttribute('data-chart-index'));
  return recordedCharts[index]!;
}

const kpiList = () => within(screen.getByRole('region', { name: 'Key indicators' }));
const kpiLabels = () => kpiList().queryAllByRole('listitem').map((li) => li.textContent ?? '');
const pendingTypes = () => [...document.querySelectorAll('[data-pending]')].map((el) => el.getAttribute('data-pending'));
const chartsShown = () => CHARTS.filter((name) => screen.queryByRole('img', { name }));

async function openDashboard(role: Role) {
  const utils = renderApp('/dashboard', { as: role });
  // The first render also loads the lazy dashboard + ECharts modules.
  await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0));
  return utils;
}

describe('role-based dashboard', () => {
  it('System Administrator: every KPI, chart and pending action, including system activity', async () => {
    await openDashboard('system-admin');
    for (const label of KPI_LABELS) expect(kpiLabels().some((t) => t.includes(label)), label).toBe(true);
    expect(chartsShown()).toEqual(CHARTS);
    expect(pendingTypes()).toEqual(['leave-approvals', 'probation-reviews', 'documents-expiring', 'attendance-corrections', 'open-positions', 'payroll-changes']);
    expect(screen.getByText("Hala Darwish's portal role was changed")).toBeTruthy();
    expect(screen.getByText('An overview of HR operations across the organization.')).toBeTruthy();
  });

  it('HR Administrator: organisation-wide HR overview, no system (user/role) activity', async () => {
    await openDashboard('hr-admin');
    expect(chartsShown()).toEqual(CHARTS);
    expect(screen.queryByText(/portal role was changed/)).toBeNull();
    expect(pendingTypes()).toContain('leave-approvals');
  });

  it('HR Manager: payroll item only because the matrix grants payroll:read', async () => {
    await openDashboard('hr-manager');
    expect(pendingTypes()).toContain('payroll-changes');
    expect(chartsShown()).toEqual(CHARTS);
  });

  it('Department Manager: own team only — no organisation-wide widgets', async () => {
    await openDashboard('department-manager');
    expect(screen.getByText('An overview of your team in Engineering.')).toBeTruthy();
    const team = mock.summary('team', new Date());
    expect(kpiList().getByText(String(team.totalEmployees.current))).toBeTruthy();
    expect(kpiLabels().some((t) => t.includes('Open positions'))).toBe(false);
    expect(chartsShown()).toEqual(['Employee growth', 'Attendance today', 'Leave requests']);
    expect(pendingTypes()).toEqual(['leave-approvals', 'probation-reviews', 'attendance-corrections']);
    expect(screen.queryByText(/New position opened/)).toBeNull();
  });

  it('Payroll Officer: employee figures and payroll item only — no attendance, leave or recruitment', async () => {
    await openDashboard('payroll-officer');
    expect(kpiLabels().map((t) => KPI_LABELS.find((l) => t.includes(l)))).toEqual(['Total employees', 'Active employees', 'New hires this month']);
    expect(chartsShown()).toEqual(['Employee growth', 'Employees by department']);
    expect(pendingTypes()).toEqual(['payroll-changes']);
    expect(screen.queryByText(/leave request/i)).toBeNull();
  });

  it('Recruiter: recruitment figures only', async () => {
    await openDashboard('recruiter');
    expect(kpiLabels().map((t) => KPI_LABELS.find((l) => t.includes(l)))).toEqual(['Open positions']);
    expect(chartsShown()).toEqual([]);
    expect(pendingTypes()).toEqual(['open-positions']);
    expect(screen.getByText('New position opened: Senior Data Engineer')).toBeTruthy();
    expect(screen.queryByText(/was added as a new employee/)).toBeNull();
  });

  it('Employee: no dashboard (self-service profile instead)', async () => {
    const spy = vi.spyOn(dashboardApi, 'getSummary');
    renderApp('/dashboard', { as: 'employee' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('dashboard content and states', () => {
  it('KPI values come from the same data as the charts', async () => {
    await openDashboard('hr-admin');
    const summary = mock.summary('organization', new Date());
    expect(document.querySelector('[data-kpi="totalEmployees"]')!.textContent).toBe(new Intl.NumberFormat('en-GB').format(summary.totalEmployees.current));
    const growth = chartProps('Employee growth').option.series as Array<{ data: number[] }>;
    expect(growth[0]!.data.at(-1)).toBe(summary.totalEmployees.current);
    expect(screen.getAllByText('vs yesterday')).toHaveLength(2); // on leave today + attendance rate
  });

  it('passes the API data to ECharts with auto-resize, full width and the SVG renderer', async () => {
    await openDashboard('hr-admin');
    const props = chartProps('Leave requests');
    const leave = mock.leaveOverview('organization', new Date());
    expect((props.option.series as Array<{ name: string; data: number[] }>).find((s) => s.name === 'Pending')!.data).toEqual(leave.months.map((m) => m.pending));
    expect(props.autoResize).toBe(true);
    expect(props.notMerge).toBe(true);
    expect(props.style?.width).toBe('100%');
    expect(props.opts?.renderer).toBe('svg');
    // Charts lay out their own RTL; the drawing surface must stay LTR (inherited RTL misplaces SVG text).
    expect(screen.getByRole('img', { name: 'Leave requests' }).getAttribute('dir')).toBe('ltr');
  });

  it('shows loading placeholders while data loads', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    renderApp('/dashboard', { as: 'hr-admin' });
    expect((await screen.findAllByRole('status')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 4000 });
  });

  it('shows a chart error with retry, then recovers', async () => {
    const spy = vi.spyOn(dashboardApi, 'getEmployeeGrowth').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/dashboard', { as: 'hr-admin' });
    const alert = await screen.findByText('This chart could not be loaded.');
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: 'Employee growth' })).toBeTruthy();
  });

  it('shows empty states', async () => {
    vi.spyOn(dashboardApi, 'getRecentActivity').mockResolvedValue({ items: [] });
    vi.spyOn(dashboardApi, 'getEmployeeGrowth').mockResolvedValue({ months: [] });
    vi.spyOn(dashboardApi, 'getPendingActions').mockResolvedValue({ items: [] });
    await openDashboard('hr-admin');
    expect(screen.getByText('No recent activity you can view.')).toBeTruthy();
    expect(screen.getByText('No data to display yet.')).toBeTruthy();
    expect(screen.getByText('Nothing needs your attention right now.')).toBeTruthy();
  });
});

describe('theme and language', () => {
  it('chart colours follow the light/dark theme', async () => {
    const { user } = await openDashboard('hr-admin');
    expect(chartProps('Employee growth').option.color).toEqual([chartColors.light.blue, chartColors.light.reference]);
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await waitFor(() => expect(chartProps('Employee growth').option.color).toEqual([chartColors.dark.blue, chartColors.dark.reference]));
  });

  it('Arabic: translated dashboard, Arabic chart labels and RTL chart layout', async () => {
    const { user } = await openDashboard('hr-admin');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('region', { name: 'المؤشرات الرئيسية' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    const growth = chartProps('نمو عدد الموظفين').option;
    expect((growth.series as Array<{ name: string }>)[0]!.name).toBe('عدد الموظفين');
    expect((growth.xAxis as { inverse: boolean }).inverse).toBe(true);
    expect((chartProps('الموظفون حسب القسم').option.yAxis as { data: string[] }).data).toContain('الهندسة');
    expect(screen.getByText('نظرة عامة على عمليات الموارد البشرية في المؤسسة.')).toBeTruthy();
  });
});
