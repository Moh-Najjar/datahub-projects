import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { attendanceApi } from '@/modules/attendance';
import { documentsApi } from '@/modules/documents';
import { employeesApi } from '@/modules/employees';
import { leaveApi } from '@/modules/leave';
import { payrollApi } from '@/modules/payroll';
import { performanceApi } from '@/modules/performance';
import { recruitmentApi } from '@/modules/recruitment';
import { REPORTS } from '@/modules/reports/api/catalog';
import { fetchAll } from '@/modules/reports/api/sources';
import { reportsApi } from '@/modules/reports/api/reportsApi';
import type { BuilderConfig, ReportFilters, ReportId, ReportsCaller } from '@/modules/reports/types/reports';
import { reportAccess } from '@/modules/reports/utils/access';
import { attendanceRate, ratio } from '@/modules/reports/utils/calculations';

/* Reports & Analytics on a fixed clock (Monday 16 Nov 2026, 10:30): every report against its SOURCE module's API. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
const as = (role: Role): ReportsCaller => ({ userId: users[role], role });
const ADMIN = as('system-admin');
const HR = as('hr-admin');
const MANAGER = as('department-manager'); // Dana Yousef (emp-0001), Engineering
const PAYROLL = as('payroll-officer');
const RECRUITER = as('recruiter');
const EMPLOYEE = as('employee');

const F: ReportFilters = { from: '2026-09-01', to: '2026-11-16', departmentId: '', locationId: '', employmentType: '', employeeStatus: '' };
const ORG = { kind: 'organization', userId: ADMIN.userId, role: ADMIN.role } as const;

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const e = await promise.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e, 'expected an error').toBeInstanceOf(ApiError);
  return e as ApiError;
}
const value = (r: { summary: Array<{ key: string; value: unknown }> }, key: string) => r.summary.find((s) => s.key === key)?.value;

describe('access (from the existing permission matrix)', () => {
  it('gives each role only its reporting areas', () => {
    const tabs = (role: Role) => [...reportAccess(as(role)).tabs].sort();
    const all = ['attendance', 'builder', 'documents', 'employees', 'executive', 'insights', 'leave', 'overview', 'payroll', 'performance', 'recruitment', 'saved'];
    expect(tabs('system-admin')).toEqual(all);
    expect(tabs('hr-admin')).toEqual(all);
    expect(tabs('hr-manager')).toEqual(all); // HR Manager holds hr.payroll.view
    expect(tabs('department-manager')).toEqual(['attendance', 'builder', 'documents', 'employees', 'leave', 'overview', 'performance', 'recruitment', 'saved']);
    expect(tabs('payroll-officer')).toEqual(['builder', 'payroll', 'saved']);
    expect(tabs('recruiter')).toEqual(['builder', 'recruitment', 'saved']);
    expect(tabs('employee')).toEqual([]);
  });

  it('keeps team readers in team scope and away from offers and individual salaries', () => {
    const a = reportAccess(MANAGER);
    expect(a.scopes).toEqual({ employees: 'team', attendance: 'team', leave: 'team', recruitment: 'team', performance: 'team', payroll: null, documents: 'team' });
    expect(a.offers).toBe(false);
    expect(a.personal).toBe(false);
  });

  it('is enforced by the API, not only hidden in the UI', async () => {
    expect((await failure(reportsApi.getReportsOverview(F, EMPLOYEE))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getEmployeeReports('employees.directory', F, EMPLOYEE))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getEmployeeReports('employees.directory', F, PAYROLL))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getPayrollReports('payroll.summary', F, RECRUITER))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getPayrollReports('payroll.summary', F, MANAGER))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getRecruitmentReports('recruitment.offers', F, MANAGER))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getHRInsights(F, MANAGER))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getExecutiveDashboard(F, PAYROLL))).code).toBe('FORBIDDEN');
    expect((await failure(reportsApi.getEmployeeReports('employees.demographics', F, MANAGER))).code).toBe('FORBIDDEN');
    // A category's operation runs only its own reports.
    expect((await failure(reportsApi.getEmployeeReports('payroll.summary' as ReportId, F, ADMIN))).code).toBe('FORBIDDEN');
  });

  it('validates filters', async () => {
    const reasons = async (f: Partial<ReportFilters>) => (await failure(reportsApi.getEmployeeReports('employees.new-hires', { ...F, ...f }, HR))).fieldErrors;
    expect(await reasons({ from: '2026-02-30' })).toEqual({ from: ['invalidDate'] });
    expect(await reasons({ from: '2026-11-01', to: '2026-10-01' })).toEqual({ to: ['endBeforeStart'] });
    expect(await reasons({ from: '2024-01-01', to: '2026-01-01' })).toEqual({ to: ['rangeTooLong'] });
    expect(await reasons({ employmentType: 'freelance' as never })).toEqual({ employmentType: ['invalid'] });
  });
});

describe('every catalogue report', () => {
  it('runs for the System Administrator with rows matching its columns', async () => {
    for (const id of REPORTS.keys()) {
      const r = await reportsApi.getReport(id, F, ADMIN);
      expect(r.id).toBe(id);
      const keys = new Set(r.columns.map((c) => c.key));
      for (const row of r.rows) for (const k of Object.keys(row)) expect(keys.has(k), `${id}: ${k}`).toBe(true);
      if (r.chart) for (const s of r.chart.series) expect(s.values).toHaveLength(r.chart.categories.length);
      expect(r.currency === null || r.currency === 'JOD').toBe(true);
    }
  }, 60_000);
});

describe('consistency with the source modules', () => {
  it('employees: directory and headcount match Employee Management', async () => {
    const source = await employeesApi.getEmployees({ page: 1, pageSize: 1 }, { kind: 'organization', role: 'system-admin' });
    const directory = await reportsApi.getEmployeeReports('employees.directory', F, ADMIN);
    expect(directory.rows).toHaveLength(source.total);
    const byDept = await reportsApi.getEmployeeReports('employees.by-department', F, ADMIN);
    expect(byDept.rows.reduce((s, r) => s + (r.total as number), 0)).toBe(source.total);
    const active = (await employeesApi.getEmployees({ page: 1, pageSize: 1, filters: { status: 'active' } }, { kind: 'organization', role: 'system-admin' })).total;
    expect(value(byDept, 'activeEmployees')).toBe(active);
  });

  it('employees: a department manager sees exactly their team', async () => {
    const team = await fetchAll((page) => employeesApi.getEmployees({ page, pageSize: 100 }, { kind: 'team', userId: MANAGER.userId, role: MANAGER.role }));
    const directory = await reportsApi.getEmployeeReports('employees.directory', F, MANAGER);
    expect(directory.rows.map((r) => r.employeeNumber).sort()).toEqual(team.map((e) => e.employeeNumber).sort());
    expect(team.length).toBeLessThan((await reportsApi.getEmployeeReports('employees.directory', F, HR)).rows.length);
  });

  it('employees: turnover uses leavers ÷ average headcount', async () => {
    const r = await reportsApi.getEmployeeReports('employees.turnover', { ...F, from: '2025-12-01' }, HR);
    for (const row of r.rows) {
      expect(row.averageHeadcount).toBe(((row.opening as number) + (row.closing as number)) / 2);
      expect(row.turnoverRate).toBe(ratio(row.leavers as number, row.averageHeadcount as number));
      expect(row.closing).toBe((row.opening as number) + (row.hires as number) - (row.leavers as number));
    }
    expect(r.rows.some((row) => (row.leavers as number) > 0)).toBe(true);
  });

  it('attendance: department figures are the Attendance module’s, and Not started is never absent', async () => {
    const source = await attendanceApi.getAttendanceReports({ page: 1, pageSize: 100, filters: { type: 'department', from: F.from, to: F.to, departmentId: '' } }, ORG);
    const r = await reportsApi.getAttendanceReports('attendance.by-department', F, ADMIN);
    expect(r.rows.map((x) => x.attendanceRate)).toEqual(source.data.rows.map((x) => ('rate' in x ? x.rate : null)));
    expect(value(r, 'attendanceRate')).toBe(attendanceRate(source.totals));
    expect(value(r, 'absent')).toBe(source.totals.absent);
    expect(value(r, 'notStarted')).toBe(source.totals.scheduled);
    const overview = await reportsApi.getReportsOverview(F, ADMIN);
    expect(overview.kpis.find((k) => k.key === 'attendanceRate')!.value).toBe(attendanceRate(source.totals));
  });

  it('attendance: ranges are clamped to the module’s data window and say so', async () => {
    const r = await reportsApi.getAttendanceReports('attendance.by-department', { ...F, from: '2026-01-01' }, ADMIN);
    // Records exist from 1 August (current month + 3 before); a report covers at most 93 days, so it starts 16 August.
    expect(r.limitations.map((n) => n.key)).toEqual(['attendanceWindow', 'rangeClamped']);
    expect(value(r, 'from')).toBe('2026-08-16');
    expect(value(r, 'to')).toBe('2026-11-16');
  });

  it('leave: usage is the Leave module’s, today’s absences agree with its summary', async () => {
    const source = await leaveApi.getLeaveReports({ page: 1, pageSize: 100, filters: { type: 'by-type', from: F.from, to: F.to, departmentId: '', leaveTypeId: '' } }, ORG);
    const r = await reportsApi.getLeaveReports('leave.by-type', F, ADMIN);
    expect(r.rows.map((x) => x.approvedDays)).toEqual(source.data.rows.map((x) => ('approvedDays' in x ? x.approvedDays : null)));
    const onLeave = await reportsApi.getLeaveReports('leave.on-leave', F, ADMIN);
    expect(value(onLeave, 'onLeaveToday')).toBe((await leaveApi.getLeaveSummary(2026, ORG)).onLeaveToday);
    const pending = await reportsApi.getLeaveReports('leave.pending', F, ADMIN);
    expect(pending.columns.map((c) => c.key)).not.toContain('status');
    expect(Object.keys(pending.rows[0] ?? {})).toEqual(pending.columns.map((c) => c.key));
    expect(value(pending, 'pendingRequests')).toBe((await leaveApi.getLeaveRequests({ page: 1, pageSize: 1, filters: { status: 'pending' } }, ORG)).total);
  });

  it('recruitment: open positions and stages match the Recruitment summary', async () => {
    const summary = await recruitmentApi.getRecruitmentSummary(ORG);
    const open = await reportsApi.getRecruitmentReports('recruitment.open-positions', F, HR);
    expect(value(open, 'openPositions')).toBe(summary.openPositions);
    const stages = await reportsApi.getRecruitmentReports('recruitment.by-stage', { ...F, from: '2025-01-01' }, HR);
    expect(Object.fromEntries(stages.rows.map((x) => [x.stage, x.candidates]))).toEqual(summary.byStage);
    const conversion = await reportsApi.getRecruitmentReports('recruitment.conversion', F, HR);
    expect(conversion.rows.map((x) => x.candidates)).toEqual(summary.funnel.map((s) => s.count));
  });

  it('recruitment: offer acceptance and time to hire follow their formulas', async () => {
    const offers = await reportsApi.getRecruitmentReports('recruitment.offers', { ...F, from: '2025-01-01' }, HR);
    const n = (s: string) => offers.rows.find((x) => x.status === s)!.offers as number;
    expect(value(offers, 'offerAcceptanceRate')).toBe(ratio(n('accepted'), n('accepted') + n('rejected') + n('expired')));
    const hire = await reportsApi.getRecruitmentReports('recruitment.time-to-hire', { ...F, from: '2025-01-01' }, HR);
    for (const row of hire.rows) expect(row.daysToHire).toBeGreaterThanOrEqual(0);
  });

  it('performance: ratings are completed manager reviews, never comments', async () => {
    const r = await reportsApi.getPerformanceReports('performance.distribution', { ...F, from: '2025-01-01' }, HR);
    const reviews = await fetchAll((page) => performanceApi.getReviews({ page, pageSize: 100 }, ORG));
    const cycles = await fetchAll((page) => performanceApi.getReviewCycles({ page, pageSize: 100 }, ORG));
    const ids = new Set(cycles.filter((c) => c.status !== 'draft' && c.startDate <= F.to && c.endDate >= '2025-01-01').map((c) => c.id));
    const rated = reviews.filter((x) => ids.has(x.cycle.id) && x.state === 'completed' && x.overallRating !== null);
    expect(value(r, 'completedReviews')).toBe(rated.length);
    const history = await reportsApi.getPerformanceReports('performance.history', F, HR);
    expect(history.columns.map((c) => c.key)).not.toContain('comments');
  });

  it('payroll: totals are Payroll’s own, exact to the fils, final runs only', async () => {
    const source = await payrollApi.getPayrollReports({ page: 1, pageSize: 100, filters: { type: 'summary', fromMonth: '2026-09', toMonth: '2026-11', departmentId: '', locationId: '', employeeId: '' } }, ORG);
    const r = await reportsApi.getPayrollReports('payroll.summary', F, HR);
    expect(value(r, 'gross')).toBe(source.totals.gross);
    expect(value(r, 'net')).toBe(source.totals.net);
    expect(Number.isInteger(value(r, 'gross'))).toBe(true);
    expect(r.rows.every((x) => x.status === 'approved' || x.status === 'paid')).toBe(true);
    expect(r.currency).toBe('JOD');
    expect(r.basis.map((n) => n.key)).toContain('finalRunsOnly');
  });

  it('documents: compliance and counts match Documents; restricted documents are never listed', async () => {
    const list = await fetchAll((page) => documentsApi.getComplianceList({ page, pageSize: 100 }, { userId: ADMIN.userId, role: ADMIN.role }));
    const items = list.flatMap((e) => e.items);
    const r = await reportsApi.getDocumentReports('documents.compliance-by-department', F, ADMIN);
    expect(value(r, 'complianceRate')).toBe(ratio(items.filter((i) => i.status === 'verified').length, items.length));
    const docs = await fetchAll((page) => documentsApi.getDocuments({ page, pageSize: 100, filters: { ownerType: 'employee' } }, { userId: ADMIN.userId, role: ADMIN.role }));
    const byCategory = await reportsApi.getDocumentReports('documents.by-category', F, ADMIN);
    expect(value(byCategory, 'documents')).toBe(docs.length);
    const restricted = new Set(docs.filter((d) => d.confidentiality === 'highly-confidential').map((d) => d.reference));
    expect(restricted.size).toBeGreaterThan(0);
    for (const id of ['documents.expired', 'documents.expiring', 'documents.pending', 'documents.verified'] as const) {
      const rows = (await reportsApi.getDocumentReports(id, F, ADMIN)).rows;
      expect(rows.some((x) => restricted.has(String(x.reference)))).toBe(false);
    }
  });
});

describe('overview, insights and executive dashboard', () => {
  it('distinguishes restricted and unavailable figures from zero', async () => {
    const o = await reportsApi.getReportsOverview(F, MANAGER);
    const k = Object.fromEntries(o.kpis.map((x) => [x.key, x]));
    expect(k.payrollCost).toMatchObject({ status: 'restricted', value: null });
    expect(k.totalEmployees!.status).toBe('available');
    expect(o.charts.find((c) => c.key === 'payroll')!.status).toBe('restricted');
  });

  it('marks only the failing module when a source errors', async () => {
    const spy = vi.spyOn(payrollApi, 'getPayrollReports').mockRejectedValue(new ApiError('SERVER'));
    const o = await reportsApi.getReportsOverview(F, HR);
    expect(o.kpis.find((x) => x.key === 'payrollCost')!.status).toBe('error');
    expect(o.kpis.find((x) => x.key === 'totalEmployees')!.status).toBe('available');
    spy.mockRestore();
  });

  it('insights state the data is insufficient for one small department', async () => {
    const all = await reportsApi.getHRInsights(F, HR);
    expect(all.insufficient).toBe(false);
    expect(all.basis.map((n) => n.key)).toContain('correlationNotCausation');
    const one = await reportsApi.getHRInsights({ ...F, departmentId: 'dep-eng-mob' }, HR);
    expect(one.insufficient).toBe(true);
    expect(one.limitations[0]!.key).toBe('insufficientData');
  });

  it('the executive dashboard holds aggregates only', async () => {
    const d = await reportsApi.getExecutiveDashboard(F, HR);
    expect(d.kpis.map((k) => k.key)).toEqual(expect.arrayContaining(['totalEmployees', 'payrollCost', 'newHires', 'turnoverRate']));
    expect(d.departments.columns.map((c) => c.key)).not.toEqual(expect.arrayContaining(['employee']));
  });
});

describe('report builder', () => {
  const config = (over: Partial<BuilderConfig> = {}): BuilderConfig => ({ dataset: 'employees.directory', fields: ['employeeNumber', 'department', 'status'], groupBy: null, sortBy: 'employeeNumber', sortDirection: 'desc', filters: F, ...over });

  it('projects and sorts the fields of an existing report', async () => {
    const r = await reportsApi.getCustomReport(config(), HR);
    expect(r.columns.map((c) => c.key)).toEqual(['employeeNumber', 'department', 'status']);
    expect(r.rows[0]!.employeeNumber! > r.rows[1]!.employeeNumber!).toBe(true);
  });

  it('groups with counts that add up to the dataset', async () => {
    const r = await reportsApi.getCustomReport(config({ groupBy: 'status', sortBy: null }), HR);
    expect(r.columns.map((c) => c.key)).toEqual(['status', 'rows']);
    const directory = await reportsApi.getEmployeeReports('employees.directory', F, HR);
    expect(r.rows.reduce((s, x) => s + (x.rows as number), 0)).toBe(directory.rows.length);
  });

  it('refuses unknown fields and datasets outside the caller’s permissions', async () => {
    expect((await failure(reportsApi.getCustomReport(config({ fields: ['salary'] }), HR))).fieldErrors).toEqual({ fields: ['notAllowed'] });
    expect((await failure(reportsApi.getCustomReport(config({ dataset: 'payroll.by-employee', fields: ['employee'] }), MANAGER))).code).toBe('FORBIDDEN');
  });
});

describe('saved reports', () => {
  const input = { name: 'Monthly hires', kind: 'report' as const, reportId: 'employees.new-hires' as const, filters: F, builder: null };

  it('stores configurations only, per owner', async () => {
    const saved = await reportsApi.saveReportConfiguration(input, HR);
    expect(Object.keys(saved).sort()).toEqual(['builder', 'createdAt', 'filters', 'id', 'kind', 'name', 'reportId', 'updatedAt']);
    expect(await reportsApi.getSavedReports(HR)).toHaveLength(1);
    expect(await reportsApi.getSavedReports(ADMIN)).toHaveLength(0);
    expect((await failure(reportsApi.updateSavedReport(saved.id, { ...input, name: 'Mine now' }, ADMIN))).code).toBe('NOT_FOUND');
    expect((await failure(reportsApi.deleteSavedReport(saved.id, ADMIN))).code).toBe('NOT_FOUND');
    const renamed = await reportsApi.updateSavedReport(saved.id, { ...input, name: 'Hires by month' }, HR);
    expect(renamed.name).toBe('Hires by month');
    await reportsApi.deleteSavedReport(saved.id, HR);
    expect(await reportsApi.getSavedReports(HR)).toHaveLength(0);
  });

  it('validates names and refuses reports the caller cannot run', async () => {
    await reportsApi.saveReportConfiguration(input, HR);
    expect((await failure(reportsApi.saveReportConfiguration({ ...input, name: ' monthly HIRES ' }, HR))).fieldErrors).toEqual({ name: ['duplicate'] });
    expect((await failure(reportsApi.saveReportConfiguration({ ...input, name: '  ' }, HR))).fieldErrors).toEqual({ name: ['required'] });
    expect((await failure(reportsApi.saveReportConfiguration(input, PAYROLL))).code).toBe('FORBIDDEN');
  });
});

describe('CSV export', () => {
  it('exports every matching record with localized headings and exact money', async () => {
    const r = await reportsApi.getPayrollReports('payroll.monthly', F, HR);
    const file = await reportsApi.exportReport({ kind: 'report', reportId: 'payroll.monthly', filters: F }, 'ar', HR);
    expect(file.content.startsWith('﻿')).toBe(true);
    expect(file.rows).toBe(r.rows.length);
    const [header, first] = file.content.slice(1).split('\r\n');
    expect(header).toContain('"الإجمالي (JOD)"');
    expect(first).toMatch(/"\d+\.\d{3}"/);
    expect(file.fileName).toBe('payroll-monthly_2026-09-01_2026-11-16.csv');
  });

  it('exports all directory rows, not one page', async () => {
    const file = await reportsApi.exportReport({ kind: 'report', reportId: 'employees.directory', filters: F }, 'en', HR);
    const total = (await employeesApi.getEmployees({ page: 1, pageSize: 1 }, { kind: 'organization', role: 'hr-admin' })).total;
    expect(file.rows).toBe(total);
    expect(file.content.trimEnd().split('\r\n')).toHaveLength(total + 1);
    expect(file.content).toContain('"Employee number","Employee"');
  });
});
