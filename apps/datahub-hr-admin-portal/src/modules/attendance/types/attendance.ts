import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Attendance contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly these
 * shapes. Records reference existing employee ids (Employee Management) and keep a SNAPSHOT of the employee's
 * department / position and of the shift as they were on that day, so history stays correct after transfers,
 * deactivations or shift edits. Times are local wall-clock values: dates `YYYY-MM-DD`, date-times `YYYY-MM-DDTHH:mm`.
 */

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'on-leave', 'half-day', 'incomplete', 'scheduled'] as const;
/**
 * Computed by the backend from the scheduled shift, the date and the punches (never stored as a raw flag):
 * - `scheduled`  — the shift has not ended and there is no check-in yet (not "absent": the day is not over);
 * - `absent`     — the shift ended without a check-in; `on-leave` — approved leave for the day;
 * - `incomplete` — checked in but no check-out after the shift ended (+ allowance);
 * - `half-day`   — worked less than half the scheduled working time; `late` — checked in after start + grace.
 */
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export type RecordStatus = 'active' | 'inactive';

/* Shifts ---------------------------------------------------------------------------------------------- */

/** Days of the week a shift is worked: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export interface Shift {
  id: string;
  code: string;
  name: Localized<string>;
  /** `HH:mm`. When `endTime <= startTime` the shift ends on the next day (overnight). */
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** Check-ins up to this many minutes after the start are not late. */
  graceMinutes: number;
  workDays: Weekday[];
  status: RecordStatus;
  /** Derived: ends after midnight. */
  overnight: boolean;
  /** Derived: scheduled time minus the break. */
  workingMinutes: number;
  /** Derived: employees currently assigned. */
  assignedEmployees: number;
  createdAt: string;
}

export interface ShiftInput {
  code: string;
  name: Localized<string>;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  workDays: Weekday[];
}

export interface ShiftFilters {
  status: RecordStatus;
}

export type ShiftSortField = 'code' | 'name.en' | 'name.ar' | 'startTime' | 'status' | 'assignedEmployees';

/** The shift as it applied to one record (frozen when the record was created). */
export interface ShiftSnapshot {
  id: string;
  code: string;
  name: Localized<string>;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
}

/* Records --------------------------------------------------------------------------------------------- */

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  /** Snapshot taken when the record was created. */
  employee: { name: Localized<string>; employeeNumber: string; department: NamedRef; position: NamedRef };
  /** Attendance date = the date the shift starts (overnight shifts end the next day). */
  date: string;
  shift: ShiftSnapshot;
  scheduledStart: string;
  scheduledEnd: string;
  checkIn: string | null;
  checkOut: string | null;
  /** Approved leave for the day (from Leave Management; computed on every read). */
  onLeave: boolean;
  /** The approved leave request covering the day, if any. */
  leaveRequestId: string | null;
  note: string;
  /** Derived (see `AttendanceStatus`). */
  status: AttendanceStatus;
  /** Derived: worked time minus the break; `null` until checked out. */
  workedMinutes: number | null;
  /** Derived: minutes after the scheduled start when the check-in was later than the grace period, else 0. */
  lateMinutes: number;
}

export interface AttendanceFilters {
  /** One day (`YYYY-MM-DD`), or a range with `from` / `to`. */
  date: string;
  from: string;
  to: string;
  departmentId: string;
  employeeId: string;
  status: AttendanceStatus;
  shiftId: string;
}

export type AttendanceSortField = 'employee.name.en' | 'employee.name.ar' | 'employee.employeeNumber' | 'date' | 'checkIn' | 'workedMinutes' | 'lateMinutes' | 'status';

/** Manual record (e.g. work on a day without a scheduled shift). */
export interface AttendanceRecordInput {
  employeeId: string;
  date: string;
  shiftId: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string;
}

/** Correction of an existing record (leave is managed in Leave Management, not here). */
export interface AttendanceUpdateInput {
  checkIn: string | null;
  checkOut: string | null;
  note: string;
}

/** Simulated punch: `time` defaults to now. */
export interface PunchInput {
  recordId: string;
  time?: string;
}

/* Scope ----------------------------------------------------------------------------------------------- */

/**
 * Who is asking. `organization` (attendance:read), `team` (attendance:read:team — the departments the user
 * manages) or `own` (attendance:read:own — the user's employee record). The real backend derives all of it from the
 * signed-in user's token and never trusts these values; the mock receives them because it has no token.
 */
export interface AttendanceScope {
  kind: 'organization' | 'team' | 'own';
  userId: string;
  role: Role;
}

/* Overview -------------------------------------------------------------------------------------------- */

export type StatusCounts = Record<AttendanceStatus, number>;

export interface AttendanceSummary {
  date: string;
  /** Active employees in scope. */
  totalEmployees: number;
  /** Scheduled to work today (records for today). */
  scheduled: number;
  /** Checked in (present + late + half-day + incomplete). */
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  /** Checked in / (scheduled − on leave − not yet due); `null` when nobody is due yet. */
  attendanceRate: number | null;
  today: StatusCounts;
  /** Last 7 calendar days, oldest first. */
  trend: Array<{ date: string } & StatusCounts>;
  /** Today, per department (top-level department of each employee's snapshot). */
  byDepartment: Array<{ department: NamedRef; scheduled: number; present: number; late: number; absent: number; onLeave: number }>;
  /** Per month in the data window, oldest first: attendance rate and average worked hours. */
  monthly: Array<{ month: string; rate: number | null; averageMinutes: number | null; records: number }>;
}

/* History --------------------------------------------------------------------------------------------- */

export interface MonthTotals {
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  halfDay: number;
  incomplete: number;
  totalMinutes: number;
  /** Average worked minutes per day with a complete record; `null` if none. */
  averageMinutes: number | null;
}

export interface EmployeeAttendanceHistory {
  employee: { id: string; name: Localized<string>; employeeNumber: string; department: NamedRef; position: NamedRef; status: RecordStatus };
  /** `YYYY-MM`. */
  month: string;
  records: AttendanceRecord[];
  totals: MonthTotals;
  /** Months with data for the selector (`YYYY-MM`, newest first). */
  availableMonths: string[];
}

/* Reports --------------------------------------------------------------------------------------------- */

export const REPORT_TYPES = ['daily', 'monthly', 'department', 'late', 'absence'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportFilters {
  type: ReportType;
  from: string;
  to: string;
  departmentId: string;
}

export interface EmployeeReportRow extends MonthTotals {
  employeeId: string;
  name: Localized<string>;
  employeeNumber: string;
  department: NamedRef;
}

export interface DepartmentReportRow {
  department: NamedRef;
  employees: number;
  scheduled: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  rate: number | null;
  totalMinutes: number;
}

export type ReportRows =
  | { type: 'daily' | 'late' | 'absence'; rows: AttendanceRecord[] }
  | { type: 'monthly'; rows: EmployeeReportRow[] }
  | { type: 'department'; rows: DepartmentReportRow[] };

export interface AttendanceReport {
  filters: ReportFilters;
  /** Totals over ALL rows of the report (not just the page). */
  totals: StatusCounts & { records: number; totalMinutes: number };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: ReportRows;
}

export interface CsvExport {
  fileName: string;
  /** UTF-8 CSV text (with BOM so spreadsheet apps show Arabic correctly). */
  content: string;
  rows: number;
}
