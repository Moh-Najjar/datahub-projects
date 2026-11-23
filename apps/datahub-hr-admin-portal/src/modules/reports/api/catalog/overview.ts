import { isApiError } from '@/core/api/types';
import type { Localized } from '@datahub/shared-types';
import type { AttendanceReport } from '@/modules/attendance';
import { attendanceRate, average, complianceRate, countBy, groupBy, monthOf, monthsIn, periodTurnover, ratingDistribution, ratio, sum, turnoverByMonth } from '@/modules/reports/utils/calculations';
import type { Availability, ChartSpec, OverviewChart, OverviewChartKey, OverviewKpi, OverviewKpiKey, ReportData, ReportNote, ValueKind } from '@/modules/reports/types/reports';
import { attendanceRange, monthlyAttendance } from './attendance';
import { chart, col, data, item, note, sortByNumber, type LoadContext } from './common';
import { workforce } from './employees';

/*
 * Overview, HR insights and the executive dashboard: figures assembled from the same report loaders and source APIs
 * as the category reports, so they always agree with them. Each figure is loaded independently: a module that fails
 * or is outside the caller's permissions marks only its own figures ("unavailable" / "restricted"), never zero.
 */

/** Runs one section; a source error marks it unavailable instead of failing the whole page (aborts still abort). */
async function section<T>(allowed: boolean, load: () => Promise<T>): Promise<{ status: Availability; value: T | null }> {
  if (!allowed) return { status: 'restricted', value: null };
  try {
    return { status: 'available', value: await load() };
  } catch (error) {
    if (!isApiError(error)) throw error;
    return { status: error.code === 'FORBIDDEN' ? 'restricted' : 'error', value: null };
  }
}

const kpi = (key: OverviewKpiKey, kind: ValueKind, s: { status: Availability; value: number | null }, basis: ReportNote | null = null): OverviewKpi => ({
  key,
  kind,
  value: s.status === 'available' ? s.value : null,
  status: s.status === 'available' && s.value === null ? 'no-data' : s.status,
  basis,
});
const chartOf = (key: OverviewChartKey, s: { status: Availability; value: ChartSpec | null }): OverviewChart => ({ key, status: s.status === 'available' && !s.value ? 'no-data' : s.status, chart: s.value });

/** Shared loaders (each runs once per overview / dashboard). */
function loaders(ctx: LoadContext) {
  const a = ctx.access;
  const employees = section(a.scopes.employees !== null, async () => {
    const w = await workforce(ctx);
    const status = ctx.f.employeeStatus;
    const list = w.list.filter((e) => !status || e.status === status);
    return { ...w, list };
  });
  const attendance = section(a.scopes.attendance !== null, async () => {
    const range = attendanceRange(ctx);
    if (!range) return null;
    const totals: AttendanceReport['totals'] = (await ctx.src.attendanceReport('department', range.from, range.to, ctx.f.departmentId)).totals;
    return { rate: attendanceRate(totals), range };
  });
  const attendanceMonthly = section(a.scopes.attendance !== null, () => monthlyAttendance(ctx));
  const pendingLeave = section(a.scopes.leave !== null, async () => (await ctx.src.leaveRequests({ status: 'pending', departmentId: ctx.f.departmentId })).length);
  const leaveByType = section(a.scopes.leave !== null, () => ctx.src.leaveReport('by-type', ctx.f.from, ctx.f.to, ctx.f.departmentId) as Promise<Array<{ key: { name: Localized<string> }; approvedDays: number }>>);
  const recruitment = section(a.scopes.recruitment !== null, async () => {
    const [requisitions, summary] = await Promise.all([ctx.src.requisitions(ctx.f.departmentId), ctx.src.recruitmentSummary()]);
    return { requisitions, summary };
  });
  const performance = section(a.scopes.performance !== null, async () => {
    const [cycles, reviews] = await Promise.all([ctx.src.cycles(), ctx.src.reviews(ctx.f.departmentId)]);
    const ids = new Set(cycles.filter((c) => c.status !== 'draft' && c.startDate <= ctx.f.to && c.endDate >= ctx.f.from).map((c) => c.id));
    return reviews.filter((r) => ids.has(r.cycle.id) && r.state === 'completed' && r.overallRating !== null);
  });
  const payroll = section(a.scopes.payroll !== null, async () => {
    const report = await ctx.src.payrollReport({ type: 'monthly', fromMonth: monthOf(ctx.f.from), toMonth: monthOf(ctx.f.to), departmentId: ctx.f.departmentId, locationId: ctx.f.locationId, employeeId: '' });
    return report.rows.map((r) => ({ month: String(r.month), gross: Number(r.gross) }));
  });
  const compliance = section(a.scopes.documents !== null, () => ctx.src.compliance(ctx.f.departmentId));
  return { employees, attendance, attendanceMonthly, pendingLeave, leaveByType, recruitment, performance, payroll, compliance };
}

const openPositions = (requisitions: ReadonlyArray<{ status: string; vacancies: number; counts: { hired: number } }>) => sum(requisitions.filter((q) => q.status === 'open').map((q) => Math.max(0, q.vacancies - q.counts.hired)));

/** KPIs shared by the overview and the executive dashboard. */
async function kpis(l: ReturnType<typeof loaders>): Promise<OverviewKpi[]> {
  const [employees, attendance, pendingLeave, recruitment, performance, payroll, compliance] = await Promise.all([l.employees, l.attendance, l.pendingLeave, l.recruitment, l.performance, l.payroll, l.compliance]);
  const latestPayroll = payroll.value?.filter((m) => m.gross > 0).at(-1) ?? null;
  return [
    kpi('totalEmployees', 'number', { status: employees.status, value: employees.value?.list.length ?? null }),
    kpi('activeEmployees', 'number', { status: employees.status, value: employees.value?.list.filter((e) => e.status === 'active').length ?? null }),
    kpi('attendanceRate', 'percent', { status: attendance.status, value: attendance.value?.rate ?? null }, attendance.value ? note('range', { from: attendance.value.range.from, to: attendance.value.range.to }) : null),
    kpi('pendingLeave', 'number', pendingLeave),
    kpi('openPositions', 'number', { status: recruitment.status, value: recruitment.value ? openPositions(recruitment.value.requisitions) : null }),
    kpi('averageRating', 'rating', { status: performance.status, value: performance.value ? average(performance.value.map((r) => r.overallRating!)) : null }, performance.value ? note('completedReviews', { n: performance.value.length }) : null),
    kpi('payrollCost', 'money', { status: payroll.status, value: latestPayroll?.gross ?? null }, latestPayroll ? note('payrollMonth', { month: latestPayroll.month }) : null),
    kpi('documentCompliance', 'percent', { status: compliance.status, value: compliance.value ? complianceRate(compliance.value.flatMap((e) => e.items)) : null }),
  ];
}

function headcountChart(ctx: LoadContext, employees: Awaited<ReturnType<typeof loaders>['employees']>) {
  return chartOf('headcount', {
    status: employees.status,
    value: employees.value ? (() => {
      const rows = turnoverByMonth(employees.value.records, monthsIn(ctx.f.from, ctx.f.to));
      return chart('line', 'number', 'month', rows.map((r) => r.month), [{ key: 'headcount', values: rows.map((r) => r.closing) }]);
    })() : null,
  });
}
function attendanceChart(monthly: Awaited<ReturnType<typeof loaders>['attendanceMonthly']>) {
  const rows = monthly.value?.rows ?? [];
  return chartOf('attendance', { status: monthly.status, value: rows.length ? chart('line', 'percent', 'month', rows.map((r) => r.month), [{ key: 'attendanceRate', values: rows.map((r) => attendanceRate(r.c)) }]) : null });
}
function payrollChart(ctx: LoadContext, payroll: Awaited<ReturnType<typeof loaders>['payroll']>) {
  const months = monthsIn(ctx.f.from, ctx.f.to);
  const byMonth = new Map((payroll.value ?? []).map((m) => [m.month, m.gross]));
  return chartOf('payroll', { status: payroll.status, value: payroll.value?.length ? chart('bar', 'money', 'month', months, [{ key: 'gross', values: months.map((m) => byMonth.get(m) ?? null) }]) : null });
}

export async function loadOverview(ctx: LoadContext): Promise<{ kpis: OverviewKpi[]; charts: OverviewChart[] }> {
  const l = loaders(ctx);
  const [figures, employees, monthly, leaveByType, recruitment, performance, payroll, compliance] = await Promise.all([kpis(l), l.employees, l.attendanceMonthly, l.leaveByType, l.recruitment, l.performance, l.payroll, l.compliance]);
  const dist = performance.value ? ratingDistribution(performance.value.map((r) => r.overallRating!)) : [];
  const statusCounts = compliance.value ? countBy(compliance.value.flatMap((e) => e.items), (i) => i.status) : {};
  const complianceStatuses = ['verified', 'pending-verification', 'uploaded', 'required', 'missing', 'expired'] as const;
  const leaveRows = leaveByType.value ?? [];
  return {
    kpis: figures,
    charts: [
      headcountChart(ctx, employees),
      attendanceChart(monthly),
      chartOf('leave', { status: leaveByType.status, value: leaveRows.some((r) => r.approvedDays > 0) ? chart('pie', 'number', 'localized', leaveRows.map((r) => r.key.name), [{ key: 'approvedDays', values: leaveRows.map((r) => r.approvedDays) }]) : null }),
      chartOf('recruitment', { status: recruitment.status, value: recruitment.value ? chart('bar', 'number', 'enum', recruitment.value.summary.funnel.map((s) => s.step), [{ key: 'candidates', values: recruitment.value.summary.funnel.map((s) => s.count) }], 'funnelStep') : null }),
      chartOf('performance', { status: performance.status, value: performance.value?.length ? chart('bar', 'number', 'number', dist.map((d) => d.value), [{ key: 'reviews', values: dist.map((d) => d.count) }]) : null }),
      payrollChart(ctx, payroll),
      chartOf('documents', { status: compliance.status, value: compliance.value?.length ? chart('pie', 'number', 'enum', [...complianceStatuses], [{ key: 'requirements', values: complianceStatuses.map((s) => statusCounts[s] ?? 0) }], 'complianceStatus') : null }),
    ],
  };
}

/* HR insights ------------------------------------------------------------------------------------------------------ */

/** Departments need at least this many active employees to be compared (smaller groups are not meaningful). */
export const MIN_GROUP = 5;
/** And at least this many comparable departments. */
export const MIN_DEPARTMENTS = 3;

export async function loadDepartmentComparison(ctx: LoadContext): Promise<ReportData> {
  const l = loaders(ctx);
  const range = attendanceRange(ctx);
  const [employees, attendanceRows, leaveRows, recruitment, performance, compliance] = await Promise.all([
    l.employees,
    section(ctx.access.scopes.attendance !== null && !!range, async () => (await ctx.src.attendanceReport('department', range!.from, range!.to, ctx.f.departmentId)).rows as Array<{ department: { id: string }; rate: number | null; present: number; absent: number; late: number; scheduled: number; onLeave: number }>),
    section(ctx.access.scopes.leave !== null, () => ctx.src.leaveReport('by-department', ctx.f.from, ctx.f.to, ctx.f.departmentId) as Promise<Array<{ key: { id: string }; approvedDays: number }>>),
    l.recruitment,
    l.performance,
    l.compliance,
  ]);
  const people = (employees.value?.list ?? []).filter((e) => e.status === 'active');
  const departments = [...groupBy(people, (e) => e.department.id).values()].filter((g) => g.length >= MIN_GROUP);
  const turnover = employees.value ? groupBy(employees.value.records, (r) => r.department.id) : new Map();
  const att = new Map((attendanceRows.value ?? []).map((r) => [r.department.id, r]));
  const leave = new Map((leaveRows.value ?? []).map((r) => [r.key.id, r.approvedDays]));
  const reqs = groupBy(recruitment.value?.requisitions ?? [], (q) => q.department.id);
  const ratings = groupBy(performance.value ?? [], (r) => r.employee.department.id);
  const docs = groupBy(compliance.value ?? [], (e) => e.employee.department.id);
  const rows = departments.map((g) => {
    const id = g[0]!.department.id;
    const a = att.get(id);
    const r = ratings.get(id) ?? [];
    return {
      department: g[0]!.department.name,
      activeEmployees: g.length,
      turnoverRate: turnover.has(id) ? periodTurnover(turnover.get(id)!, ctx.f.from, ctx.f.to).rate : null,
      attendanceRate: a ? a.rate : null,
      lateRate: a ? ratio(a.late, a.present) : null,
      leaveDaysPerEmployee: leaveRows.status === 'available' ? (leave.get(id) ?? 0) / g.length : null,
      averageRating: r.length >= 3 ? average(r.map((x) => x.overallRating!)) : null,
      openPositions: recruitment.status === 'available' ? openPositions(reqs.get(id) ?? []) : null,
      complianceRate: docs.has(id) ? complianceRate(docs.get(id)!.flatMap((e) => e.items)) : null,
    };
  });
  rows.sort(sortByNumber('activeEmployees'));
  const comparable = rows.filter((r) => r.attendanceRate !== null);
  const insufficient = comparable.length < MIN_DEPARTMENTS;
  const limitations: ReportNote[] = [note('insightGroupSize', { n: MIN_GROUP }), note('ratingsMinimum', { n: 3 })];
  if (insufficient) limitations.unshift(note('insufficientData', { n: MIN_DEPARTMENTS }));
  for (const [key, s] of [['attendance', attendanceRows.status], ['leave', leaveRows.status], ['recruitment', recruitment.status], ['performance', performance.status], ['documents', compliance.status]] as const) if (s !== 'available') limitations.push(note(`source.${s}`, { module: key }));
  // Department rows' `present` already counts every attended day (present, late, half day, incomplete).
  const attended = sum([...att.values()].map((x) => x.present));
  const orgAttendance = ratio(attended, attended + sum([...att.values()].map((x) => x.absent)));
  return data({
    columns: [col('department', 'localized'), col('activeEmployees', 'number'), col('turnoverRate', 'percent'), col('attendanceRate', 'percent'), col('lateRate', 'percent'), col('leaveDaysPerEmployee', 'decimal'), col('averageRating', 'rating'), col('openPositions', 'number'), col('complianceRate', 'percent')],
    rows,
    summary: [item('departments', 'number', rows.length), item('attendanceRate', 'percent', orgAttendance), item('averageRating', 'rating', performance.value?.length ? average(performance.value.map((r) => r.overallRating!)) : null), item('complianceRate', 'percent', compliance.value ? complianceRate(compliance.value.flatMap((e) => e.items)) : null)],
    chart: insufficient ? null : chart('hbar', 'percent', 'localized', comparable.map((r) => r.department), [{ key: 'attendanceRate', values: comparable.map((r) => r.attendanceRate) }, { key: 'complianceRate', values: comparable.map((r) => r.complianceRate) }]),
    basis: [note('correlationNotCausation'), note('currentAssignment'), ...(range ? [note('attendanceRange', { from: range.from, to: range.to })] : [])],
    limitations,
    insufficient,
  });
}

/* Executive dashboard ---------------------------------------------------------------------------------------------- */

export async function loadExecutive(ctx: LoadContext) {
  const l = loaders(ctx);
  const [figures, employees, monthly, payroll, departments] = await Promise.all([kpis(l), l.employees, l.attendanceMonthly, l.payroll, loadDepartmentComparison(ctx)]);
  const period = employees.value ? periodTurnover(employees.value.records, ctx.f.from, ctx.f.to) : null;
  const extra: OverviewKpi[] = [
    kpi('newHires', 'number', { status: employees.status, value: period?.hires ?? null }),
    kpi('turnoverRate', 'percent', { status: employees.status, value: period?.rate ?? null }),
  ];
  // Department-level aggregates only: no individual salary, medical, identity or private performance data.
  return { kpis: [...figures, ...extra], charts: [headcountChart(ctx, employees), attendanceChart(monthly), payrollChart(ctx, payroll)], departments };
}
