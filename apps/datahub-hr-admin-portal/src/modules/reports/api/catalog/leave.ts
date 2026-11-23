import type { LeaveBalance, LeaveRequest } from '@/modules/leave';
import { daysBetween, groupBy, monthsIn, ratio, sum } from '@/modules/reports/utils/calculations';
import type { ReportRow } from '@/modules/reports/types/reports';
import { chart, col, data, item, note, sortByNumber, type LoadContext, type ReportDefinition } from './common';

/*
 * Leave reports — from Leave Management's report and request endpoints. Days are the module's working days of each
 * request (whole requests overlapping the range). Balances are the module's (remaining = allocated − used − pending);
 * nothing is recalculated. Pending requests are never counted as approved leave. Requests' reasons and documents are
 * never part of a report.
 */

interface UsageRow {
  key: { id: string; name: { en: string; ar: string } };
  requests: number;
  approvedDays: number;
  pendingDays: number;
  employees: number;
}

const requestsOf = (ctx: LoadContext) => ctx.src.leaveReport('requests', ctx.f.from, ctx.f.to, ctx.f.departmentId) as Promise<LeaveRequest[]>;
/** Balances are per calendar year: the year of the range's end. */
const balanceYear = (ctx: LoadContext) => Number(ctx.f.to.slice(0, 4));
const balancesOf = (ctx: LoadContext) => ctx.src.leaveReport('balances', `${balanceYear(ctx)}-01-01`, `${balanceYear(ctx)}-12-31`, ctx.f.departmentId) as Promise<LeaveBalance[]>;

const requestColumns = [col('requestNumber', 'code'), col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('leaveType', 'localized'), col('paid', 'enum', 'paidType'), col('startDate', 'date'), col('endDate', 'date'), col('days', 'number'), col('status', 'enum', 'leaveStatus')];
const requestRow = (r: LeaveRequest): ReportRow => ({
  requestNumber: r.number,
  employee: r.employee.name,
  employeeNumber: r.employee.employeeNumber,
  department: r.employee.department.name,
  leaveType: r.leaveType.name,
  paid: r.leaveType.paid ? 'paid' : 'unpaid',
  startDate: r.startDate,
  endDate: r.endDate,
  days: r.days,
  status: r.status,
});
const daysOf = (list: readonly LeaveRequest[], status: LeaveRequest['status']) => sum(list.filter((r) => r.status === status).map((r) => r.days));
const BASIS = [note('leaveOverlap'), note('pendingNotApproved')];

function usageReport(id: 'leave.by-type' | 'leave.by-department', type: 'by-type' | 'by-department'): ReportDefinition {
  const key = type === 'by-type' ? 'leaveType' : 'department';
  return {
    id,
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const rows = (await ctx.src.leaveReport(type, ctx.f.from, ctx.f.to, ctx.f.departmentId)) as UsageRow[];
      const out = rows.map((r) => ({ [key]: r.key.name, requests: r.requests, approvedDays: r.approvedDays, pendingDays: r.pendingDays, employees: r.employees }));
      return data({
        columns: [col(key, 'localized'), col('requests', 'number'), col('approvedDays', 'number'), col('pendingDays', 'number'), col('employees', 'number')],
        rows: out,
        summary: [item('requests', 'number', sum(rows.map((r) => r.requests))), item('approvedDays', 'number', sum(rows.map((r) => r.approvedDays))), item('pendingDays', 'number', sum(rows.map((r) => r.pendingDays)))],
        chart: chart(type === 'by-type' ? 'pie' : 'hbar', 'number', 'localized', out.map((r) => r[key] ?? null), [{ key: 'approvedDays', values: rows.map((r) => r.approvedDays) }]),
        basis: BASIS,
      });
    },
  };
}

export const leaveReports: ReportDefinition[] = [
  {
    id: 'leave.requests',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const list = await requestsOf(ctx);
      const statuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
      return data({
        columns: requestColumns,
        rows: list.map(requestRow),
        summary: [item('requests', 'number', list.length), item('approvedDays', 'number', daysOf(list, 'approved')), item('pendingDays', 'number', daysOf(list, 'pending'))],
        chart: chart('pie', 'number', 'enum', [...statuses], [{ key: 'requests', values: statuses.map((s) => list.filter((r) => r.status === s).length) }], 'leaveStatus'),
        basis: [...BASIS, note('noReasons')],
      });
    },
  },
  usageReport('leave.by-type', 'by-type'),
  usageReport('leave.by-department', 'by-department'),
  {
    id: 'leave.by-employee',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const list = await requestsOf(ctx);
      const rows = [...groupBy(list, (r) => r.employeeId).values()].map((g) => ({
        employee: g[0]!.employee.name,
        employeeNumber: g[0]!.employee.employeeNumber,
        department: g[0]!.employee.department.name,
        requests: g.length,
        approvedDays: daysOf(g, 'approved'),
        pendingDays: daysOf(g, 'pending'),
        rejected: g.filter((r) => r.status === 'rejected').length,
      }));
      rows.sort(sortByNumber('approvedDays'));
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('requests', 'number'), col('approvedDays', 'number'), col('pendingDays', 'number'), col('rejected', 'number')],
        rows,
        summary: [item('employees', 'number', rows.length), item('approvedDays', 'number', daysOf(list, 'approved'))],
        basis: BASIS,
      });
    },
  },
  {
    id: 'leave.balances',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const list = await balancesOf(ctx);
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('leaveType', 'localized'), col('allocated', 'number'), col('used', 'number'), col('pending', 'number'), col('remaining', 'number')],
        rows: list.map((b) => ({ employee: b.employee.name, employeeNumber: b.employee.employeeNumber, department: b.employee.department.name, leaveType: b.leaveType.name, allocated: b.allocated, used: b.used, pending: b.pending, remaining: b.remaining })),
        summary: [item('year', 'text', String(balanceYear(ctx))), item('used', 'number', sum(list.map((b) => b.used))), item('pending', 'number', sum(list.map((b) => b.pending)))],
        basis: [note('balanceFormula'), note('balanceYear', { year: balanceYear(ctx) })],
        limitations: [note('noAllocationBlank')],
      });
    },
  },
  {
    id: 'leave.utilization',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const list = (await balancesOf(ctx)).filter((b) => b.allocated !== null);
      const rows = [...groupBy(list, (b) => b.leaveType.id).values()].map((g) => {
        const allocated = sum(g.map((b) => b.allocated!));
        const used = sum(g.map((b) => b.used));
        return { leaveType: g[0]!.leaveType.name, employees: g.length, allocated, used, pending: sum(g.map((b) => b.pending)), remaining: sum(g.map((b) => b.remaining ?? 0)), utilization: ratio(used, allocated) };
      });
      rows.sort(sortByNumber('allocated'));
      return data({
        columns: [col('leaveType', 'localized'), col('employees', 'number'), col('allocated', 'number'), col('used', 'number'), col('pending', 'number'), col('remaining', 'number'), col('utilization', 'percent')],
        rows,
        summary: [item('year', 'text', String(balanceYear(ctx))), item('utilization', 'percent', ratio(sum(rows.map((r) => r.used)), sum(rows.map((r) => r.allocated))))],
        chart: chart('hbar', 'percent', 'localized', rows.map((r) => r.leaveType), [{ key: 'utilization', values: rows.map((r) => r.utilization) }]),
        basis: [note('utilizationFormula'), note('balanceYear', { year: balanceYear(ctx) })],
        limitations: [note('unlimitedTypesExcluded')],
      });
    },
  },
  {
    id: 'leave.pending',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.leaveRequests({ status: 'pending', departmentId: ctx.f.departmentId });
      const rows = list
        .map((r) => ({ ...requestRow(r), submittedAt: r.submittedAt, waitingDays: r.submittedAt ? Math.max(0, daysBetween(r.submittedAt, ctx.today)) : null }))
        .sort((a, b) => ((b.waitingDays as number) ?? 0) - ((a.waitingDays as number) ?? 0));
      return data({
        columns: [...requestColumns.filter((c) => c.key !== 'status'), col('submittedAt', 'date'), col('waitingDays', 'number')],
        rows,
        summary: [item('pendingRequests', 'number', list.length), item('pendingDays', 'number', sum(list.map((r) => r.days)))],
        basis: [note('currentState'), note('pendingNotApproved')],
      });
    },
  },
  {
    id: 'leave.on-leave',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.leaveRequests({ status: 'approved', from: ctx.today, to: ctx.today, departmentId: ctx.f.departmentId });
      return data({
        columns: requestColumns.filter((c) => c.key !== 'status'),
        rows: list.map(requestRow),
        summary: [item('onLeaveToday', 'number', new Set(list.map((r) => r.employeeId)).size)],
        basis: [note('approvedCoveringToday', { day: ctx.today })],
      });
    },
  },
  {
    id: 'leave.monthly',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const list = (await requestsOf(ctx)).filter((r) => r.status !== 'draft');
      const months = monthsIn(ctx.f.from, ctx.f.to);
      const byMonth = groupBy(list, (r) => r.startDate.slice(0, 7));
      const rows = months.map((month) => {
        const g = byMonth.get(month) ?? [];
        return { month, pending: g.filter((r) => r.status === 'pending').length, approved: g.filter((r) => r.status === 'approved').length, rejected: g.filter((r) => r.status === 'rejected').length, cancelled: g.filter((r) => r.status === 'cancelled').length, approvedDays: daysOf(g, 'approved') };
      });
      return data({
        columns: [col('month', 'month'), col('pending', 'number'), col('approved', 'number'), col('rejected', 'number'), col('cancelled', 'number'), col('approvedDays', 'number')],
        rows,
        summary: [item('requests', 'number', list.length), item('approvedDays', 'number', daysOf(list, 'approved'))],
        chart: chart('stacked', 'number', 'month', months, (['approved', 'pending', 'rejected', 'cancelled'] as const).map((k) => ({ key: k, values: rows.map((r) => r[k]) }))),
        basis: [note('monthByStart'), note('draftsExcluded'), note('pendingNotApproved')],
        limitations: [note('startedBeforeRange')],
      });
    },
  },
  {
    id: 'leave.paid-unpaid',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const list = await requestsOf(ctx);
      const rows = (['paid', 'unpaid'] as const).map((kind) => {
        const g = list.filter((r) => r.leaveType.paid === (kind === 'paid'));
        return { paid: kind, approvedRequests: g.filter((r) => r.status === 'approved').length, approvedDays: daysOf(g, 'approved'), pendingDays: daysOf(g, 'pending'), employees: new Set(g.filter((r) => r.status === 'approved').map((r) => r.employeeId)).size };
      });
      return data({
        columns: [col('paid', 'enum', 'paidType'), col('approvedRequests', 'number'), col('approvedDays', 'number'), col('pendingDays', 'number'), col('employees', 'number')],
        rows,
        summary: [item('paidDays', 'number', rows[0]!.approvedDays), item('unpaidDays', 'number', rows[1]!.approvedDays)],
        chart: chart('pie', 'number', 'enum', ['paid', 'unpaid'], [{ key: 'approvedDays', values: rows.map((r) => r.approvedDays) }], 'paidType'),
        basis: BASIS,
      });
    },
  },
];
