/*
 * Public API of Leave Management for other modules. Employee Management embeds the profile's Leave tab.
 * Leave itself never imports Employee Management or Attendance (it links to them through the navigation map), so the
 * module graph stays acyclic: employees → leave → organization.
 */
export { EmployeeLeaveTab } from './components/EmployeeLeaveTab';
export { leaveKeys } from './hooks/useLeave';
export { leavePaths } from './paths';
/** For Reports & Analytics: the module's own API service and contracts (balances are computed by Leave only). */
export { leaveApi } from './api/leaveApi';
export type { LeaveBalance, LeaveReport, LeaveRequest, LeaveScope, LeaveSummary, LeaveType } from './types/leave';
