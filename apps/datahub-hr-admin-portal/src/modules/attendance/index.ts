/*
 * Public API of Attendance Management for other modules (pure re-exports). Reports & Analytics reads attendance through
 * the same API service the module uses (no second data source, no duplicated rules).
 */
export { attendanceApi } from './api/attendanceApi';
export type { AttendanceRecord, AttendanceReport, AttendanceScope, AttendanceStatus, AttendanceSummary, DepartmentReportRow, EmployeeReportRow, ReportFilters as AttendanceReportFilters, Shift } from './types/attendance';
