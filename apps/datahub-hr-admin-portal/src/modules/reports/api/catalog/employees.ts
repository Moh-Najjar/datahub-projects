import type { Localized } from '@datahub/shared-types';
import type { EmploymentHistoryEntry } from '@/modules/employees';
import { addDays, ageBand, AGE_BANDS, countBy, daysBetween, groupBy, inRange, monthsIn, periodTurnover, ratio, turnoverByMonth, yearsBetween, type WorkforceRecord } from '@/modules/reports/utils/calculations';
import type { ReportRow } from '@/modules/reports/types/reports';
import { chart, col, data, fullName, item, label, note, sortByNumber, type LoadContext, type ReportDefinition } from './common';

/*
 * Employee reports — from Employee Management's directory (the list endpoint, in the caller's scope), its profile
 * endpoint (probation, personal details) and its employment history (departure dates). Department, location and
 * employment type are the employees' CURRENT values (the directory keeps no assignment history).
 */

const ALL_FILTERS = ['departmentId', 'locationId', 'employmentType', 'employeeStatus'] as const;
const GROUP_FILTERS = ['departmentId', 'locationId', 'employmentType'] as const;

const directoryFilters = (ctx: LoadContext, withStatus: boolean) => ({
  departmentId: ctx.f.departmentId,
  locationId: ctx.f.locationId,
  employmentType: ctx.f.employmentType,
  status: withStatus ? ctx.f.employeeStatus : '',
});

/** Latest change to "inactive" in the employment history (the date the employee left). */
export function leftOnFrom(history: readonly EmploymentHistoryEntry[]): string | null {
  return (
    history
      .filter((h) => h.type === 'status-changed' && h.to?.en === 'inactive')
      .map((h) => h.date)
      .sort()
      .at(-1) ?? null
  );
}

/** Every employee in scope with hire and departure dates (history read only for inactive employees). */
export async function workforce(ctx: LoadContext) {
  const list = await ctx.src.employees(directoryFilters(ctx, false));
  const inactive = list.filter((e) => e.status === 'inactive');
  const histories = await Promise.all(inactive.map((e) => ctx.src.employmentHistory(e.id)));
  const leftOn = new Map(inactive.map((e, i) => [e.id, leftOnFrom(histories[i]!)]));
  const records: Array<WorkforceRecord & { id: string; department: { id: string; name: Localized<string> } }> = list.map((e) => ({
    id: e.id,
    hireDate: e.hireDate,
    // An inactive employee without a recorded departure is treated as having left on the hire date's next day
    // only if no history exists; that never happens in the source data, but it is reported as a limitation.
    leftOn: e.status === 'inactive' ? (leftOn.get(e.id) ?? null) : null,
    department: e.department,
  }));
  const unknownDepartures = list.filter((e) => e.status === 'inactive' && !leftOn.get(e.id)).length;
  return { list, records, unknownDepartures };
}

const directoryColumns = [col('employeeNumber', 'code'), col('employee', 'localized'), col('department', 'localized'), col('position', 'localized'), col('location', 'localized'), col('employmentType', 'enum', 'employmentType'), col('status', 'enum', 'employeeStatus'), col('hireDate', 'date')];

function directoryRow(e: Awaited<ReturnType<LoadContext['src']['employees']>>[number]): ReportRow {
  return { employeeNumber: e.employeeNumber, employee: fullName(e.name), department: e.department.name, position: e.position.name, location: e.location.name, employmentType: e.employmentType, status: e.status, hireDate: e.hireDate };
}

/** Group the directory by one attribute: active, inactive, total and share of active employees. */
async function grouped(ctx: LoadContext, key: 'department' | 'location' | 'employmentType' | 'status') {
  const list = await ctx.src.employees(directoryFilters(ctx, false));
  const activeTotal = list.filter((e) => e.status === 'active').length;
  const groups = groupBy(list, (e) => (key === 'department' || key === 'location' ? e[key].id : e[key]));
  const rows: ReportRow[] = [...groups.values()].map((members) => {
    const first = members[0]!;
    const active = members.filter((e) => e.status === 'active').length;
    return {
      group: key === 'department' || key === 'location' ? first[key].name : first[key],
      active,
      inactive: members.length - active,
      total: members.length,
      share: ratio(active, activeTotal),
    };
  });
  rows.sort(sortByNumber('active'));
  return { rows, total: list.length, activeTotal };
}

function groupReport(id: ReportDefinition['id'], key: 'department' | 'location' | 'employmentType' | 'status'): ReportDefinition {
  const enumName = key === 'employmentType' ? 'employmentType' : key === 'status' ? 'employeeStatus' : undefined;
  return {
    id,
    filters: [...GROUP_FILTERS],
    async load(ctx) {
      const { rows, total, activeTotal } = await grouped(ctx, key);
      const groupCol = enumName ? col(key, 'enum', enumName) : col(key, 'localized');
      const renamed: ReportRow[] = rows.map(({ group, ...rest }) => ({ [key]: group ?? null, ...rest }));
      return data({
        columns: [groupCol, col('active', 'number'), col('inactive', 'number'), col('total', 'number'), col('share', 'percent')],
        rows: renamed,
        summary: [item('totalEmployees', 'number', total), item('activeEmployees', 'number', activeTotal), item('groups', 'number', rows.length)],
        chart: chart(
          key === 'status' || key === 'employmentType' ? 'pie' : 'hbar',
          'number',
          enumName ? 'enum' : 'localized',
          renamed.map((r) => r[key] ?? null),
          [{ key: key === 'status' ? 'employees' : 'active', values: renamed.map((r) => (key === 'status' ? (r.total as number) : (r.active as number))) }],
          enumName,
        ),
        basis: [note('currentAssignment'), note('shareOfActive')],
      });
    },
  };
}

export const employeeReports: ReportDefinition[] = [
  {
    id: 'employees.directory',
    filters: [...ALL_FILTERS],
    async load(ctx) {
      const list = await ctx.src.employees(directoryFilters(ctx, true));
      const active = list.filter((e) => e.status === 'active').length;
      return data({
        columns: directoryColumns,
        rows: list.map(directoryRow),
        summary: [item('totalEmployees', 'number', list.length), item('activeEmployees', 'number', active), item('inactiveEmployees', 'number', list.length - active)],
        basis: [note('currentAssignment')],
      });
    },
  },
  groupReport('employees.by-department', 'department'),
  groupReport('employees.by-location', 'location'),
  groupReport('employees.by-type', 'employmentType'),
  groupReport('employees.by-status', 'status'),
  {
    id: 'employees.new-hires',
    filters: ['dateRange', ...ALL_FILTERS],
    async load(ctx) {
      const list = (await ctx.src.employees(directoryFilters(ctx, true))).filter((e) => inRange(e.hireDate, ctx.f.from, ctx.f.to));
      list.sort((a, b) => b.hireDate.localeCompare(a.hireDate));
      const months = monthsIn(ctx.f.from, ctx.f.to);
      const perMonth = countBy(list, (e) => e.hireDate.slice(0, 7));
      return data({
        columns: directoryColumns,
        rows: list.map(directoryRow),
        summary: [item('newHires', 'number', list.length), item('stillActive', 'number', list.filter((e) => e.status === 'active').length)],
        chart: chart('bar', 'number', 'month', months, [{ key: 'newHires', values: months.map((m) => perMonth[m] ?? 0) }]),
        basis: [note('hireDateInRange'), note('currentAssignment')],
      });
    },
  },
  {
    id: 'employees.turnover',
    filters: ['dateRange', ...GROUP_FILTERS],
    async load(ctx) {
      const { records, unknownDepartures } = await workforce(ctx);
      const rows = turnoverByMonth(records, monthsIn(ctx.f.from, ctx.f.to));
      const period = periodTurnover(records, ctx.f.from, ctx.f.to);
      return data({
        columns: [col('month', 'month'), col('opening', 'number'), col('hires', 'number'), col('leavers', 'number'), col('closing', 'number'), col('averageHeadcount', 'decimal'), col('turnoverRate', 'percent')],
        rows: rows.map((r) => ({ ...r })),
        summary: [item('leavers', 'number', period.leavers), item('newHires', 'number', period.hires), item('averageHeadcount', 'decimal', period.averageHeadcount), item('turnoverRate', 'percent', period.rate)],
        chart: chart('line', 'percent', 'month', rows.map((r) => r.month), [{ key: 'turnoverRate', values: rows.map((r) => r.turnoverRate) }]),
        basis: [note('turnoverFormula'), note('departureDate')],
        limitations: [note('turnoverNoReasons'), note('currentAssignment'), ...(unknownDepartures ? [note('unknownDepartures', { n: unknownDepartures })] : [])],
      });
    },
  },
  {
    id: 'employees.headcount-trend',
    filters: ['dateRange', ...GROUP_FILTERS],
    async load(ctx) {
      const { records } = await workforce(ctx);
      const rows = turnoverByMonth(records, monthsIn(ctx.f.from, ctx.f.to));
      return data({
        columns: [col('month', 'month'), col('headcount', 'number'), col('hires', 'number'), col('leavers', 'number'), col('netChange', 'number')],
        rows: rows.map((r) => ({ month: r.month, headcount: r.closing, hires: r.hires, leavers: r.leavers, netChange: r.closing - r.opening })),
        summary: [item('headcountStart', 'number', rows[0]?.opening ?? null), item('headcountEnd', 'number', rows.at(-1)?.closing ?? null)],
        chart: chart('line', 'number', 'month', rows.map((r) => r.month), [{ key: 'headcount', values: rows.map((r) => r.closing) }]),
        basis: [note('headcountMonthEnd'), note('departureDate')],
        limitations: [note('currentAssignment')],
      });
    },
  },
  {
    id: 'employees.probation',
    filters: [...GROUP_FILTERS],
    async load(ctx) {
      // Probation ends within a year of hiring (Employee Management rule): only recent hires can be on probation.
      const since = addDays(ctx.today, -400);
      const recent = (await ctx.src.employees({ ...directoryFilters(ctx, false), status: 'active' })).filter((e) => e.hireDate >= since);
      const details = await Promise.all(recent.map((e) => ctx.src.employee(e.id)));
      const rows: ReportRow[] = details
        .filter((e) => e.probationEndDate)
        .map((e) => {
          const remaining = daysBetween(ctx.today, e.probationEndDate!);
          return {
            employeeNumber: e.employeeNumber,
            employee: fullName(e.name),
            department: e.department.name,
            hireDate: e.hireDate,
            probationEndDate: e.probationEndDate,
            daysRemaining: remaining >= 0 ? remaining : null,
            status: remaining >= 0 ? 'in-probation' : 'completed',
          };
        })
        .sort((a, b) => String(a.probationEndDate).localeCompare(String(b.probationEndDate)));
      const inProbation = rows.filter((r) => r.status === 'in-probation');
      return data({
        columns: [col('employeeNumber', 'code'), col('employee', 'localized'), col('department', 'localized'), col('hireDate', 'date'), col('probationEndDate', 'date'), col('daysRemaining', 'number'), col('status', 'enum', 'probationStatus')],
        rows,
        summary: [item('inProbation', 'number', inProbation.length), item('endingIn30Days', 'number', inProbation.filter((r) => (r.daysRemaining as number) <= 30).length), item('completedProbation', 'number', rows.length - inProbation.length)],
        chart: chart('pie', 'number', 'enum', ['in-probation', 'completed'], [{ key: 'employees', values: [inProbation.length, rows.length - inProbation.length] }], 'probationStatus'),
        basis: [note('probationRecentHires')],
      });
    },
  },
  {
    id: 'employees.demographics',
    filters: [...GROUP_FILTERS],
    requires: (a) => a.personal,
    async load(ctx) {
      const active = await ctx.src.employees({ ...directoryFilters(ctx, false), status: 'active' });
      const details = await Promise.all(active.map((e) => ctx.src.employee(e.id)));
      const personal = details.map((e) => e.personal).filter((p) => p !== null);
      const hidden = details.length - personal.length;
      const total = personal.length;
      const rows: ReportRow[] = [];
      const gender = countBy(personal, (p) => p.gender);
      for (const g of ['female', 'male']) rows.push({ dimension: 'gender', group: label(`enums.gender.${g}`), employees: gender[g] ?? 0, share: ratio(gender[g] ?? 0, total) });
      const ages = countBy(personal, (p) => ageBand(yearsBetween(p.dateOfBirth, ctx.today)));
      for (const band of AGE_BANDS) rows.push({ dimension: 'age', group: label(`enums.ageBand.${band}`), employees: ages[band] ?? 0, share: ratio(ages[band] ?? 0, total) });
      const nationalities = Object.entries(countBy(personal, (p) => p.nationality)).sort((a, b) => b[1] - a[1]);
      const names = { en: new Intl.DisplayNames(['en'], { type: 'region' }), ar: new Intl.DisplayNames(['ar'], { type: 'region' }) };
      for (const [code, n] of nationalities) rows.push({ dimension: 'nationality', group: { en: names.en.of(code) ?? code, ar: names.ar.of(code) ?? code }, employees: n, share: ratio(n, total) });
      return data({
        columns: [col('dimension', 'enum', 'demographic'), col('group', 'localized'), col('employees', 'number'), col('share', 'percent')],
        rows,
        summary: [item('activeEmployees', 'number', total)],
        chart: chart('bar', 'number', 'enum', AGE_BANDS.slice(), [{ key: 'employees', values: AGE_BANDS.map((b) => ages[b] ?? 0) }], 'ageBand'),
        basis: [note('aggregateOnly'), note('ageToday')],
        limitations: hidden ? [note('personalHidden', { n: hidden })] : [],
      });
    },
  },
];
