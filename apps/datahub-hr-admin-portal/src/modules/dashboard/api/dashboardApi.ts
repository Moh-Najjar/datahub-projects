import { mockRequest } from '@/core/api/mock/mockRequest';
import * as mock from '@/modules/dashboard/mock/dashboardMock';
import type {
  AttendanceOverview,
  DashboardScope,
  DashboardSummary,
  DepartmentHeadcount,
  EmployeeGrowth,
  LeaveOverview,
  PendingActions,
  RecentActivity,
} from '@/modules/dashboard/types/dashboard';

/*
 * Dashboard API — MOCK implementation over fictional data (`mock/`). The only file that knows where
 * dashboard data comes from: to use the real backend, replace these bodies with HTTP calls returning the
 * same types; hooks and components stay unchanged. No backend endpoints are defined yet.
 *
 * Scope: the real backend must derive the scope (organisation vs the manager's department) and the figures a
 * user may see from the authenticated user. The `scope` argument only mirrors that for the mock; the UI also
 * hides widgets a role cannot use, but that is presentation, not protection.
 */
export const dashboardApi = {
  getSummary: (scope: DashboardScope, signal?: AbortSignal): Promise<DashboardSummary> => mockRequest(() => mock.summary(scope, new Date()), { signal }),

  getEmployeeGrowth: (scope: DashboardScope, signal?: AbortSignal): Promise<EmployeeGrowth> => mockRequest(() => mock.employeeGrowth(scope, new Date()), { signal }),

  getAttendanceOverview: (scope: DashboardScope, signal?: AbortSignal): Promise<AttendanceOverview> =>
    mockRequest(() => mock.attendanceOverview(scope, new Date()), { signal }),

  /** Organisation-wide only. */
  getDepartmentHeadcount: (signal?: AbortSignal): Promise<DepartmentHeadcount> => mockRequest(() => mock.departmentHeadcount(), { signal }),

  getLeaveOverview: (scope: DashboardScope, signal?: AbortSignal): Promise<LeaveOverview> => mockRequest(() => mock.leaveOverview(scope, new Date()), { signal }),

  getRecentActivity: (scope: DashboardScope, signal?: AbortSignal): Promise<RecentActivity> => mockRequest(() => mock.recentActivity(scope, new Date()), { signal }),

  getPendingActions: (scope: DashboardScope, signal?: AbortSignal): Promise<PendingActions> => mockRequest(() => mock.pendingActions(scope), { signal }),
};
