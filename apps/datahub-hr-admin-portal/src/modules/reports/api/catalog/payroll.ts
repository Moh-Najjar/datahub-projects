import type { PayrollReportFilters } from '@/modules/payroll';
import { countBy, inRange, monthOf, monthsIn } from '@/modules/reports/utils/calculations';
import type { ReportColumn, ReportId, ReportRow, ValueKind } from '@/modules/reports/types/reports';
import { chart, col, data, item, label, note, type LoadContext, type ReportDefinition } from './common';

/*
 * Payroll reports — Payroll Management's own reports (approved and paid runs only, in JOD — currencies are never
 * mixed), passed through unchanged: every amount is the module's integer minor units, so totals match payroll to the
 * last fils. Only `hr.payroll.view` roles get them; the run-status report lists runs in every status (stated on it).
 */

type PayrollType = PayrollReportFilters['type'];
const KINDS: Record<string, ValueKind> = { money: 'money', number: 'number', localized: 'localized', month: 'month', date: 'date', code: 'code', text: 'text' };
const MONEY = ['basic', 'allowances', 'overtime', 'gross', 'deductions', 'net', 'amount'];

const payrollFilters = (ctx: LoadContext, type: PayrollType): PayrollReportFilters => ({ type, fromMonth: monthOf(ctx.f.from), toMonth: monthOf(ctx.f.to), departmentId: ctx.f.departmentId, locationId: ctx.f.locationId, employeeId: '' });

function mapColumns(columns: ReadonlyArray<{ key: string; kind: string }>): ReportColumn[] {
  return columns.map((c) => {
    if (c.kind === 'status') return c.key === 'status' ? col('status', 'enum', 'runStatus') : col(c.key, 'enum', 'payrollItemCategory');
    return col(c.key, KINDS[c.kind] ?? 'text');
  });
}

const BASIS = [note('finalRunsOnly'), note('singleCurrency', { currency: 'JOD' })];

function passThrough(id: ReportId, type: PayrollType, options: { keep?: string[]; chart?: 'monthly' | 'department' | 'items' } = {}): ReportDefinition {
  return {
    id,
    filters: ['dateRange', 'departmentId', 'locationId'],
    async load(ctx) {
      const report = await ctx.src.payrollReport(payrollFilters(ctx, type));
      let columns = mapColumns(report.columns);
      if (options.keep) columns = columns.filter((c) => options.keep!.includes(c.key));
      const all = label('payroll.allDepartments');
      const rows: ReportRow[] = report.rows.map((r) => (type === 'summary' && r.department === null ? { ...r, department: all } : r) as ReportRow);
      const moneyTotals = columns.filter((c) => MONEY.includes(c.key) && report.totals[c.key] !== undefined).map((c) => item(c.key, 'money', report.totals[c.key]!));
      let spec = null;
      if (options.chart === 'monthly') {
        const months = monthsIn(ctx.f.from, ctx.f.to);
        const byMonth = new Map<string, number>();
        for (const r of report.rows) byMonth.set(String(r.month), (byMonth.get(String(r.month)) ?? 0) + Number(r.gross ?? 0));
        spec = chart('bar', 'money', 'month', months, [{ key: 'gross', values: months.map((m) => (byMonth.has(m) ? byMonth.get(m)! : null)) }]);
      } else if (options.chart === 'department') spec = chart('hbar', 'money', 'localized', rows.map((r) => r.department ?? null), [{ key: 'gross', values: rows.map((r) => Number(r.gross ?? 0)) }]);
      else if (options.chart === 'items') spec = chart('hbar', 'money', 'localized', rows.slice(0, 10).map((r) => r.item ?? null), [{ key: 'amount', values: rows.slice(0, 10).map((r) => Number(r.amount ?? 0)) }]);
      return data({ columns, rows, summary: [item('rows', 'number', rows.length), ...moneyTotals], chart: spec, basis: BASIS, currency: 'JOD', limitations: rows.length ? [] : [note('noFinalPayroll')] });
    },
  };
}

export const payrollReports: ReportDefinition[] = [
  passThrough('payroll.summary', 'summary', { chart: 'monthly' }),
  passThrough('payroll.by-department', 'department', { chart: 'department' }),
  passThrough('payroll.by-employee', 'employee'),
  passThrough('payroll.gross', 'employee', { keep: ['employee', 'employeeNumber', 'department', 'periods', 'basic', 'allowances', 'overtime', 'gross'] }),
  passThrough('payroll.net', 'employee', { keep: ['employee', 'employeeNumber', 'department', 'periods', 'gross', 'deductions', 'net'] }),
  passThrough('payroll.allowances', 'allowances', { chart: 'items' }),
  passThrough('payroll.deductions', 'deductions', { chart: 'items' }),
  passThrough('payroll.monthly', 'monthly', { chart: 'monthly' }),
  passThrough('payroll.history', 'history'),
  {
    id: 'payroll.run-status',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const runs = (await ctx.src.payrollRuns(ctx.f.departmentId)).filter((r) => inRange(r.periodStart, `${monthOf(ctx.f.from)}-01`, ctx.f.to));
      const rows = runs
        .map((r) => ({ runNumber: r.number, month: monthOf(r.periodStart), department: r.department?.name ?? label('payroll.allDepartments'), status: r.status, employees: r.totals?.employees ?? null, gross: r.currency === 'JOD' ? (r.totals?.gross ?? null) : null, net: r.currency === 'JOD' ? (r.totals?.net ?? null) : null, paymentDate: r.paymentDate }))
        .sort((a, b) => b.month.localeCompare(a.month) || a.runNumber.localeCompare(b.runNumber));
      const counts = countBy(runs, (r) => r.status);
      const statuses = Object.keys(counts);
      return data({
        columns: [col('runNumber', 'code'), col('month', 'month'), col('department', 'localized'), col('status', 'enum', 'runStatus'), col('employees', 'number'), col('gross', 'money'), col('net', 'money'), col('paymentDate', 'date')],
        rows,
        summary: [item('runs', 'number', runs.length), item('finalRuns', 'number', (counts.approved ?? 0) + (counts.paid ?? 0)), item('pendingRuns', 'number', runs.length - (counts.approved ?? 0) - (counts.paid ?? 0) - (counts.cancelled ?? 0))],
        chart: chart('pie', 'number', 'enum', statuses, [{ key: 'runs', values: statuses.map((s) => counts[s]!) }], 'runStatus'),
        basis: [note('allRunStatuses'), note('singleCurrency', { currency: 'JOD' })],
        limitations: [note('unfinishedRunTotals')],
        currency: 'JOD',
      });
    },
  },
];

