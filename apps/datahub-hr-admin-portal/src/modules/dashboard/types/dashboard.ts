import type { Localized } from '@datahub/shared-types';

/*
 * Dashboard API contracts — drafts of the future backend responses. Each endpoint returns one concern;
 * numbers are never duplicated across responses (the UI derives percentages and trends).
 */

/** Whole organisation, or the signed-in manager's own department. */
export type DashboardScope = 'organization' | 'team';

/** A metric with its value for the previous comparable period (`null` when there is none). */
export interface Kpi {
  current: number;
  previous: number | null;
}

export interface DashboardSummary {
  scope: DashboardScope;
  /** Present for `team` scope. */
  department?: Localized<string>;
  asOf: string;
  /** Employees on record (active + inactive). Previous = end of last month. */
  totalEmployees: Kpi;
  /** Employees currently working (not inactive). Previous = end of last month. */
  activeEmployees: Kpi;
  /** Hires this month to date. Previous = last month. */
  newHires: Kpi;
  /** Active employees on approved leave today. Previous = yesterday. */
  onLeaveToday: Kpi;
  /** Present (incl. late) ÷ expected (active − on leave), in %. Previous = yesterday. */
  attendanceRate: Kpi;
  /** Organisation scope only. Previous = end of last month. */
  openPositions?: Kpi;
}

/** Month as `YYYY-MM`. */
export type MonthKey = string;

export interface EmployeeGrowth {
  /** Last 12 months, oldest first: end-of-month headcount, and the same month one year earlier. */
  months: Array<{ month: MonthKey; headcount: number; previousYear: number }>;
}

/** Today's attendance of active employees; the four groups add up to the active headcount. */
export interface AttendanceOverview {
  date: string;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
}

export interface DepartmentHeadcount {
  departments: Array<{ id: string; name: Localized<string>; headcount: number }>;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveOverview {
  /** Leave requests submitted per month (last 6 months, oldest first) by current status. */
  months: Array<{ month: MonthKey } & Record<LeaveStatus, number>>;
}

export type ActivityType =
  | 'employee-added'
  | 'employee-updated'
  | 'leave-submitted'
  | 'leave-approved'
  | 'attendance-updated'
  | 'position-created'
  | 'user-role-changed';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  /** Who performed the action (fictional). */
  actor: Localized<string>;
  /** Employee or position the event is about (fictional). */
  subject: Localized<string>;
  occurredAt: string;
}

export interface RecentActivity {
  items: ActivityItem[];
}

export type PendingActionType = 'leave-approvals' | 'probation-reviews' | 'documents-expiring' | 'attendance-corrections' | 'open-positions' | 'payroll-changes';

export interface PendingActions {
  items: Array<{ type: PendingActionType; count: number }>;
}
