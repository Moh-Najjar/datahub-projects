/*
 * Public API of Leave Management for other modules. Employee Management embeds the profile's Leave tab.
 * Leave itself never imports Employee Management or Attendance (it links to them through the navigation map), so the
 * module graph stays acyclic: employees → leave → organization.
 */
export { EmployeeLeaveTab } from './components/EmployeeLeaveTab';
export { leaveKeys } from './hooks/useLeave';
export { leavePaths } from './paths';
