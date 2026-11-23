import type { AttendanceRecord, DepartmentReportRow, EmployeeReportRow } from '@/modules/attendance';
import { addDays, addMonths, attendanceRate, attendedDays, average, countBy, daysBetween, groupBy, monthEnd, monthOf, monthsIn, monthStart, ratio, type StatusCounts } from '@/modules/reports/utils/calculations';
import type { ReportNote, ReportRow } from '@/modules/reports/types/reports';
import { chart, col, data, item, note, sortByNumber, type LoadContext, type ReportDefinition } from './common';

/*
 * Attendance reports — from Attendance Management's report and record endpoints (statuses, worked time and the
 * attendance rate are the module's own). "Not started" days are never counted as absent; approved leave is "on leave"
 * (pending leave is not). The module keeps records for the current month and the three before, and one report covers
 * at most 93 days: longer or older ranges are clamped and the report says so.
 */

/** Attendance's data window: the current month and the three before it. */
export const attendanceWindowStart = (today: string) => monthStart(addMonths(monthOf(today), -3));
const MAX_DAYS = 93;
/** Record-level reports (late arrivals, absences, daily trends, shifts) list every record: at most 31 days. */
const RECORD_DAYS = 31;

export function attendanceRange(ctx: LoadContext, maxDays = MAX_DAYS): { from: string; to: string; notes: ReportNote[] } | null {
  const notes: ReportNote[] = [];
  let from = ctx.f.from;
  let to = ctx.f.to > ctx.today ? ctx.today : ctx.f.to;
  const windowStart = attendanceWindowStart(ctx.today);
  if (from < windowStart) {
    from = windowStart;
    notes.push(note('attendanceWindow', { from: windowStart }));
  }
  if (from > to) return null;
  if (daysBetween(from, to) >= maxDays) {
    from = addDays(to, -(maxDays - 1));
    notes.push(note('rangeClamped', { days: maxDays, from }));
  }
  return { from, to, notes };
}

const empty = (notes: ReportNote[]) => ({ rows: [] as ReportRow[], notes: [...notes, note('noAttendanceData')] });

const counts = (t: Partial<StatusCounts>): StatusCounts => ({ present: 0, late: 0, absent: 0, 'on-leave': 0, 'half-day': 0, incomplete: 0, scheduled: 0, ...t });
const countRecords = (list: readonly AttendanceRecord[]) => counts(countBy(list, (r) => r.status) as Partial<StatusCounts>);
const hours = (minutes: number | null) => (minutes === null ? null : minutes / 60);
const time = (dateTime: string | null) => (dateTime ? dateTime.slice(11, 16) : null);

const statusSummary = (c: StatusCounts) => [
  item('attended', 'number', attendedDays(c)),
  item('late', 'number', c.late),
  item('absent', 'number', c.absent),
  item('onLeave', 'number', c['on-leave']),
  item('halfDay', 'number', c['half-day']),
  item('incomplete', 'number', c.incomplete),
  item('notStarted', 'number', c.scheduled),
  item('attendanceRate', 'percent', attendanceRate(c)),
];
const BASIS = [note('attendanceRateFormula'), note('notStartedNotAbsent'), note('approvedLeaveOnly')];

const recordColumns = [col('date', 'date'), col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('shift', 'code'), col('checkIn', 'text'), col('checkOut', 'text'), col('workedHours', 'hours'), col('lateMinutes', 'number'), col('status', 'enum', 'attendanceStatus')];
const recordRow = (r: AttendanceRecord): ReportRow => ({
  date: r.date,
  employee: r.employee.name,
  employeeNumber: r.employee.employeeNumber,
  department: r.employee.department.name,
  shift: r.shift.code,
  checkIn: time(r.checkIn),
  checkOut: time(r.checkOut),
  workedHours: hours(r.workedMinutes),
  lateMinutes: r.lateMinutes,
  status: r.status,
});

/** Status counts per month of the range (one department report per month, so every figure is the module's). */
export async function monthlyAttendance(ctx: LoadContext) {
  const range = attendanceRange(ctx, 400);
  if (!range) return { rows: [] as Array<{ month: string; c: StatusCounts; records: number }>, notes: [note('noAttendanceData')] };
  const months = monthsIn(range.from, range.to);
  const totals = await Promise.all(
    months.map((m) => {
      const from = monthStart(m) < range.from ? range.from : monthStart(m);
      const to = monthEnd(m) > range.to ? range.to : monthEnd(m);
      return ctx.src.attendanceReport('department', from, to, ctx.f.departmentId).then((r) => r.totals);
    }),
  );
  return { rows: months.map((month, i) => ({ month, c: counts(totals[i]!), records: totals[i]!.records })), notes: range.notes };
}

export const attendanceReports: ReportDefinition[] = [
  {
    id: 'attendance.daily',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const day = ctx.f.to > ctx.today ? ctx.today : ctx.f.to;
      if (day < attendanceWindowStart(ctx.today)) return data({ columns: recordColumns, rows: [], limitations: empty([note('attendanceWindow', { from: attendanceWindowStart(ctx.today) })]).notes });
      const { rows } = await ctx.src.attendanceReport('daily', day, day, ctx.f.departmentId);
      const list = rows as AttendanceRecord[];
      const c = countRecords(list);
      const statuses = ['present', 'late', 'half-day', 'incomplete', 'absent', 'on-leave', 'scheduled'] as const;
      return data({
        columns: recordColumns,
        rows: list.map(recordRow),
        summary: [item('day', 'date', day), item('scheduled', 'number', list.length), ...statusSummary(c)],
        chart: chart('pie', 'number', 'enum', [...statuses], [{ key: 'employees', values: statuses.map((s) => c[s]) }], 'attendanceStatus'),
        basis: [note('dailyLastDay', { day }), ...BASIS],
      });
    },
  },
  {
    id: 'attendance.monthly',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { rows, notes } = await monthlyAttendance(ctx);
      const all = rows.reduce((acc, r) => counts(Object.fromEntries(Object.keys(acc).map((k) => [k, acc[k as keyof StatusCounts] + r.c[k as keyof StatusCounts]])) as Partial<StatusCounts>), counts({}));
      return data({
        columns: [col('month', 'month'), col('scheduled', 'number'), col('attended', 'number'), col('late', 'number'), col('absent', 'number'), col('onLeave', 'number'), col('halfDay', 'number'), col('incomplete', 'number'), col('notStarted', 'number'), col('attendanceRate', 'percent')],
        rows: rows.map((r) => ({ month: r.month, scheduled: r.records, attended: attendedDays(r.c), late: r.c.late, absent: r.c.absent, onLeave: r.c['on-leave'], halfDay: r.c['half-day'], incomplete: r.c.incomplete, notStarted: r.c.scheduled, attendanceRate: attendanceRate(r.c) })),
        summary: statusSummary(all),
        chart: chart('line', 'percent', 'month', rows.map((r) => r.month), [{ key: 'attendanceRate', values: rows.map((r) => attendanceRate(r.c)) }]),
        basis: BASIS,
        limitations: notes,
      });
    },
  },
  {
    id: 'attendance.by-department',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx);
      if (!range) return data({ columns: [], rows: [], limitations: [note('noAttendanceData')] });
      const { rows, totals } = await ctx.src.attendanceReport('department', range.from, range.to, ctx.f.departmentId);
      const list = rows as DepartmentReportRow[];
      const out = list.map((r) => ({ department: r.department.name, employees: r.employees, scheduled: r.scheduled, attended: r.present, late: r.late, absent: r.absent, onLeave: r.onLeave, attendanceRate: r.rate, workedHours: hours(r.totalMinutes) }));
      return data({
        columns: [col('department', 'localized'), col('employees', 'number'), col('scheduled', 'number'), col('attended', 'number'), col('late', 'number'), col('absent', 'number'), col('onLeave', 'number'), col('attendanceRate', 'percent'), col('workedHours', 'hours')],
        rows: out,
        summary: [item('from', 'date', range.from), item('to', 'date', range.to), ...statusSummary(counts(totals))],
        chart: chart('hbar', 'percent', 'localized', out.map((r) => r.department), [{ key: 'attendanceRate', values: out.map((r) => r.attendanceRate) }]),
        basis: [...BASIS, note('snapshotDepartment')],
        limitations: range.notes,
      });
    },
  },
  {
    id: 'attendance.by-employee',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx);
      if (!range) return data({ columns: [], rows: [], limitations: [note('noAttendanceData')] });
      const { rows } = await ctx.src.attendanceReport('monthly', range.from, range.to, ctx.f.departmentId);
      const list = rows as EmployeeReportRow[];
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('workingDays', 'number'), col('attended', 'number'), col('late', 'number'), col('absent', 'number'), col('onLeave', 'number'), col('halfDay', 'number'), col('incomplete', 'number'), col('workedHours', 'hours'), col('averageHours', 'hours'), col('attendanceRate', 'percent')],
        rows: list.map((r) => ({
          employee: r.name,
          employeeNumber: r.employeeNumber,
          department: r.department.name,
          workingDays: r.workingDays,
          attended: r.present,
          late: r.late,
          absent: r.absent,
          onLeave: r.onLeave,
          halfDay: r.halfDay,
          incomplete: r.incomplete,
          workedHours: hours(r.totalMinutes),
          averageHours: hours(r.averageMinutes),
          attendanceRate: ratio(r.present, r.present + r.absent),
        })),
        summary: [item('from', 'date', range.from), item('to', 'date', range.to), item('employees', 'number', list.length)],
        basis: [...BASIS, note('workingDaysDefinition')],
        limitations: range.notes,
      });
    },
  },
  {
    id: 'attendance.late',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx, RECORD_DAYS);
      if (!range) return data({ columns: recordColumns, rows: [], limitations: [note('noAttendanceData')] });
      const list = (await ctx.src.attendanceReport('late', range.from, range.to, ctx.f.departmentId)).rows as AttendanceRecord[];
      const byDept = [...groupBy(list, (r) => r.employee.department.id).values()].map((g) => ({ department: g[0]!.employee.department.name, late: g.length })).sort((a, b) => b.late - a.late);
      return data({
        columns: recordColumns,
        rows: list.map(recordRow),
        summary: [item('lateArrivals', 'number', list.length), item('employeesAffected', 'number', new Set(list.map((r) => r.employeeId)).size), item('averageLateMinutes', 'decimal', average(list.map((r) => r.lateMinutes)))],
        chart: chart('hbar', 'number', 'localized', byDept.map((d) => d.department), [{ key: 'lateArrivals', values: byDept.map((d) => d.late) }]),
        basis: [note('lateDefinition')],
        limitations: range.notes,
      });
    },
  },
  {
    id: 'attendance.absence',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx, RECORD_DAYS);
      if (!range) return data({ columns: recordColumns, rows: [], limitations: [note('noAttendanceData')] });
      const list = (await ctx.src.attendanceReport('absence', range.from, range.to, ctx.f.departmentId)).rows as AttendanceRecord[];
      const byDept = [...groupBy(list, (r) => r.employee.department.id).values()].map((g) => ({ department: g[0]!.employee.department.name, absent: g.length })).sort((a, b) => b.absent - a.absent);
      return data({
        columns: recordColumns.filter((c) => c.key !== 'checkIn' && c.key !== 'checkOut' && c.key !== 'workedHours' && c.key !== 'lateMinutes'),
        rows: list.map(recordRow),
        summary: [item('absences', 'number', list.length), item('employeesAffected', 'number', new Set(list.map((r) => r.employeeId)).size)],
        chart: chart('hbar', 'number', 'localized', byDept.map((d) => d.department), [{ key: 'absences', values: byDept.map((d) => d.absent) }]),
        basis: [note('absenceDefinition'), note('notStartedNotAbsent'), note('approvedLeaveOnly')],
        limitations: range.notes,
      });
    },
  },
  {
    id: 'attendance.working-hours',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx);
      if (!range) return data({ columns: [], rows: [], limitations: [note('noAttendanceData')] });
      const list = (await ctx.src.attendanceReport('department', range.from, range.to, ctx.f.departmentId)).rows as DepartmentReportRow[];
      const out = list.map((r) => ({ department: r.department.name, employees: r.employees, attended: r.present, workedHours: hours(r.totalMinutes), hoursPerEmployee: r.employees ? r.totalMinutes / 60 / r.employees : null, hoursPerDay: r.present ? r.totalMinutes / 60 / r.present : null }));
      out.sort(sortByNumber('workedHours'));
      const total = list.reduce((s, r) => s + r.totalMinutes, 0);
      return data({
        columns: [col('department', 'localized'), col('employees', 'number'), col('attended', 'number'), col('workedHours', 'hours'), col('hoursPerEmployee', 'hours'), col('hoursPerDay', 'hours')],
        rows: out,
        summary: [item('workedHours', 'hours', total / 60), item('hoursPerDay', 'hours', ratio(total / 60, list.reduce((s, r) => s + r.present, 0)))],
        chart: chart('hbar', 'hours', 'localized', out.map((r) => r.department), [{ key: 'hoursPerDay', values: out.map((r) => r.hoursPerDay) }]),
        basis: [note('workedTimeDefinition')],
        limitations: [...range.notes, note('openDaysNoHours')],
      });
    },
  },
  {
    id: 'attendance.trends',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx, RECORD_DAYS);
      if (!range) return data({ columns: [], rows: [], limitations: [note('noAttendanceData')] });
      const records = await ctx.src.attendanceRecords(range.from, range.to, ctx.f.departmentId);
      const days = [...groupBy(records, (r) => r.date).entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const rows = days.map(([date, list]) => {
        const c = countRecords(list);
        return { date, scheduled: list.length, attended: attendedDays(c), late: c.late, absent: c.absent, onLeave: c['on-leave'], notStarted: c.scheduled, attendanceRate: attendanceRate(c) };
      });
      return data({
        columns: [col('date', 'date'), col('scheduled', 'number'), col('attended', 'number'), col('late', 'number'), col('absent', 'number'), col('onLeave', 'number'), col('notStarted', 'number'), col('attendanceRate', 'percent')],
        rows,
        summary: [item('days', 'number', rows.length), ...statusSummary(countRecords(records))],
        chart: chart('line', 'percent', 'date', rows.map((r) => r.date), [{ key: 'attendanceRate', values: rows.map((r) => r.attendanceRate) }]),
        basis: BASIS,
        limitations: range.notes,
      });
    },
  },
  {
    id: 'attendance.shifts',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const range = attendanceRange(ctx, RECORD_DAYS);
      if (!range) return data({ columns: [], rows: [], limitations: [note('noAttendanceData')] });
      const records = await ctx.src.attendanceRecords(range.from, range.to, ctx.f.departmentId);
      const rows = [...groupBy(records, (r) => r.shift.id).values()].map((list) => {
        const c = countRecords(list);
        const late = list.filter((r) => r.lateMinutes > 0);
        return { shift: list[0]!.shift.code, shiftName: list[0]!.shift.name, employees: new Set(list.map((r) => r.employeeId)).size, scheduled: list.length, attended: attendedDays(c), late: c.late, absent: c.absent, onLeave: c['on-leave'], attendanceRate: attendanceRate(c), averageLateMinutes: average(late.map((r) => r.lateMinutes)) };
      });
      rows.sort(sortByNumber('scheduled'));
      return data({
        columns: [col('shift', 'code'), col('shiftName', 'localized'), col('employees', 'number'), col('scheduled', 'number'), col('attended', 'number'), col('late', 'number'), col('absent', 'number'), col('onLeave', 'number'), col('attendanceRate', 'percent'), col('averageLateMinutes', 'decimal')],
        rows,
        summary: [item('shifts', 'number', rows.length), ...statusSummary(countRecords(records)).slice(-1)],
        chart: chart('bar', 'percent', 'code', rows.map((r) => r.shift), [{ key: 'attendanceRate', values: rows.map((r) => r.attendanceRate) }]),
        basis: [...BASIS, note('shiftSnapshot')],
        limitations: range.notes,
      });
    },
  },
];
