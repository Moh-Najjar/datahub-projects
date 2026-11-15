import type {
  AttendanceOverview,
  DashboardScope,
  DashboardSummary,
  DepartmentHeadcount,
  EmployeeGrowth,
  LeaveOverview,
  LeaveStatus,
  PendingActions,
  RecentActivity,
} from '@/modules/dashboard/types/dashboard';
import { ACTIVITY_SEED } from './activity';
import { DEMO_TEAM_DEPARTMENT_ID, DEPARTMENTS, headcountHistory, HISTORY_MONTHS, LEAVE_MONTHS, monthKey, type AttendanceCounts, type DepartmentData } from './dataset';

/*
 * SIMULATED dashboard endpoints: every response is computed from `dataset.ts`, so all figures agree.
 * Read only by `api/dashboardApi.ts`.
 */

const LAST = HISTORY_MONTHS - 1;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Departments in scope: all of them, or the demo manager's department. */
function inScope(scope: DashboardScope): readonly DepartmentData[] {
  return scope === 'organization' ? DEPARTMENTS : DEPARTMENTS.filter((d) => d.id === DEMO_TEAM_DEPARTMENT_ID);
}

function sumHistory(departments: readonly DepartmentData[]): number[] {
  const histories = departments.map(headcountHistory);
  return Array.from({ length: HISTORY_MONTHS }, (_, i) => sum(histories.map((h) => h[i]!)));
}

function sumAttendance(departments: readonly DepartmentData[], day: 'attendanceToday' | 'attendanceYesterday'): AttendanceCounts {
  return {
    late: sum(departments.map((d) => d[day].late)),
    absent: sum(departments.map((d) => d[day].absent)),
    onLeave: sum(departments.map((d) => d[day].onLeave)),
  };
}

/** Present (incl. late) ÷ expected (active − on leave), in %. */
export function attendanceRate(active: number, counts: AttendanceCounts): number {
  const expected = active - counts.onLeave;
  return expected > 0 ? round1(((expected - counts.absent) / expected) * 100) : 0;
}

export function summary(scope: DashboardScope, now: Date): DashboardSummary {
  const departments = inScope(scope);
  const history = sumHistory(departments);
  const active = sum(departments.map((d) => d.active));
  const inactive = sum(departments.map((d) => d.inactive));
  const today = sumAttendance(departments, 'attendanceToday');
  const yesterday = sumAttendance(departments, 'attendanceYesterday');
  return {
    scope,
    department: scope === 'team' ? departments[0]!.name : undefined,
    asOf: now.toISOString(),
    totalEmployees: { current: history[LAST]!, previous: history[LAST - 1]! },
    activeEmployees: { current: active, previous: history[LAST - 1]! - inactive },
    newHires: { current: sum(departments.map((d) => d.hires[LAST]!)), previous: sum(departments.map((d) => d.hires[LAST - 1]!)) },
    onLeaveToday: { current: today.onLeave, previous: yesterday.onLeave },
    attendanceRate: { current: attendanceRate(active, today), previous: attendanceRate(active, yesterday) },
    openPositions:
      scope === 'organization'
        ? { current: sum(departments.map((d) => d.openPositions)), previous: sum(departments.map((d) => d.openPositionsLastMonth)) }
        : undefined,
  };
}

export function employeeGrowth(scope: DashboardScope, now: Date): EmployeeGrowth {
  const history = sumHistory(inScope(scope));
  return {
    months: Array.from({ length: 12 }, (_, i) => ({
      month: monthKey(now, 11 - i),
      headcount: history[12 + i]!,
      previousYear: history[i]!,
    })),
  };
}

export function attendanceOverview(scope: DashboardScope, now: Date): AttendanceOverview {
  const departments = inScope(scope);
  const active = sum(departments.map((d) => d.active));
  const today = sumAttendance(departments, 'attendanceToday');
  return { date: now.toISOString(), present: active - today.onLeave - today.absent - today.late, ...today };
}

/** Organisation scope only (a team is a single department). Sorted by headcount, largest first. */
export function departmentHeadcount(): DepartmentHeadcount {
  return {
    departments: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, headcount: d.active + d.inactive })).sort((a, b) => b.headcount - a.headcount),
  };
}

export function leaveOverview(scope: DashboardScope, now: Date): LeaveOverview {
  const departments = inScope(scope);
  const statuses: LeaveStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];
  return {
    months: Array.from({ length: LEAVE_MONTHS }, (_, i) => {
      const counts = Object.fromEntries(statuses.map((s) => [s, sum(departments.map((d) => d.leave[i]![s]))])) as Record<LeaveStatus, number>;
      return { month: monthKey(now, LEAVE_MONTHS - 1 - i), ...counts };
    }),
  };
}

export function recentActivity(scope: DashboardScope, now: Date, limit = 8): RecentActivity {
  const ids = new Set(inScope(scope).map((d) => d.id));
  return {
    items: ACTIVITY_SEED.filter((a) => ids.has(a.departmentId))
      .sort((a, b) => a.minutesAgo - b.minutesAgo)
      .slice(0, limit)
      .map(({ id, type, actor, subject, minutesAgo }) => ({ id, type, actor, subject, occurredAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString() })),
  };
}

export function pendingActions(scope: DashboardScope): PendingActions {
  const departments = inScope(scope);
  const pendingLeave = sum(departments.flatMap((d) => d.leave.map((m) => m.pending)));
  const items: PendingActions['items'] = [
    { type: 'leave-approvals', count: pendingLeave },
    { type: 'probation-reviews', count: sum(departments.map((d) => d.probationReviewsDue)) },
    { type: 'documents-expiring', count: sum(departments.map((d) => d.documentsExpiring)) },
    { type: 'attendance-corrections', count: sum(departments.map((d) => d.attendanceCorrections)) },
  ];
  if (scope === 'organization') {
    items.push(
      { type: 'open-positions', count: sum(departments.map((d) => d.openPositions)) },
      // Joiners and leavers this month: changes the payroll team must reflect (no salary data involved).
      { type: 'payroll-changes', count: sum(departments.map((d) => d.hires[LAST]! + d.exits[LAST]!)) },
    );
  }
  return { items };
}
