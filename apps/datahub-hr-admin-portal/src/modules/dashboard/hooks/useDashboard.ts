import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/modules/dashboard/api/dashboardApi';
import type { DashboardScope } from '@/modules/dashboard/types/dashboard';

/** Query keys: `['dashboard', <resource>, <scope>]` — invalidate everything with `dashboardKeys.all`. */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (scope: DashboardScope) => [...dashboardKeys.all, 'summary', scope] as const,
  employeeGrowth: (scope: DashboardScope) => [...dashboardKeys.all, 'employee-growth', scope] as const,
  attendance: (scope: DashboardScope) => [...dashboardKeys.all, 'attendance', scope] as const,
  departments: () => [...dashboardKeys.all, 'departments'] as const,
  leave: (scope: DashboardScope) => [...dashboardKeys.all, 'leave', scope] as const,
  activity: (scope: DashboardScope) => [...dashboardKeys.all, 'activity', scope] as const,
  pendingActions: (scope: DashboardScope) => [...dashboardKeys.all, 'pending-actions', scope] as const,
};

/** Aggregates change slowly: treat them as fresh for a minute (no refetch on remount within that time). */
const AGGREGATE_STALE_TIME = 60_000;

/*
 * One hook per dashboard resource. `enabled` is false when the role may not see the widget, so its data is
 * never requested (the backend must still refuse such requests itself).
 */

export function useDashboardSummary(scope: DashboardScope, enabled = true) {
  return useQuery({ queryKey: dashboardKeys.summary(scope), queryFn: ({ signal }) => dashboardApi.getSummary(scope, signal), enabled, staleTime: AGGREGATE_STALE_TIME });
}

export function useEmployeeGrowth(scope: DashboardScope, enabled = true) {
  return useQuery({ queryKey: dashboardKeys.employeeGrowth(scope), queryFn: ({ signal }) => dashboardApi.getEmployeeGrowth(scope, signal), enabled, staleTime: AGGREGATE_STALE_TIME });
}

export function useAttendanceOverview(scope: DashboardScope, enabled = true) {
  return useQuery({ queryKey: dashboardKeys.attendance(scope), queryFn: ({ signal }) => dashboardApi.getAttendanceOverview(scope, signal), enabled, staleTime: AGGREGATE_STALE_TIME });
}

export function useDepartmentHeadcount(enabled = true) {
  return useQuery({ queryKey: dashboardKeys.departments(), queryFn: ({ signal }) => dashboardApi.getDepartmentHeadcount(signal), enabled, staleTime: AGGREGATE_STALE_TIME });
}

export function useLeaveOverview(scope: DashboardScope, enabled = true) {
  return useQuery({ queryKey: dashboardKeys.leave(scope), queryFn: ({ signal }) => dashboardApi.getLeaveOverview(scope, signal), enabled, staleTime: AGGREGATE_STALE_TIME });
}

/** Activity changes more often: default 30 s freshness. */
export function useRecentActivity(scope: DashboardScope, enabled = true) {
  return useQuery({ queryKey: dashboardKeys.activity(scope), queryFn: ({ signal }) => dashboardApi.getRecentActivity(scope, signal), enabled });
}

export function usePendingActions(scope: DashboardScope, enabled = true) {
  return useQuery({ queryKey: dashboardKeys.pendingActions(scope), queryFn: ({ signal }) => dashboardApi.getPendingActions(scope, signal), enabled });
}
