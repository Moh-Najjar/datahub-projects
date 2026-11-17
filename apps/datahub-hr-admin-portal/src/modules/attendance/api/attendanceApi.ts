import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/attendance/mock/attendanceMock';
import type {
  AttendanceFilters,
  AttendanceRecord,
  AttendanceRecordInput,
  AttendanceReport,
  AttendanceScope,
  AttendanceSummary,
  AttendanceUpdateInput,
  CsvExport,
  EmployeeAttendanceHistory,
  PunchInput,
  RecordStatus,
  ReportFilters,
  Shift,
  ShiftFilters,
  ShiftInput,
} from '@/modules/attendance/types/attendance';

/*
 * Attendance API service — the ONLY entry point to attendance data. Every call runs against the SIMULATED backend
 * (`mock/`); with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented
 * before the contract exists).
 *
 * `scope` (organization / team / own + role) exists only because the mock has no token: the real backend must
 * derive it from the signed-in user, refuse out-of-scope reads (`FORBIDDEN`) and require `attendance:write` for
 * every write. Check-in/check-out are SIMULATED operations — nothing records real-world presence.
 */

type Signal = AbortSignal | undefined;

export const attendanceApi = {
  getAttendanceSummary: (scope: AttendanceScope, signal?: Signal): Promise<AttendanceSummary> => mockRequest(() => mock.summary(scope), { signal }),

  getAttendanceRecords: (params: ListParams<AttendanceFilters>, scope: AttendanceScope, signal?: Signal): Promise<Paginated<AttendanceRecord>> =>
    mockRequest(() => mock.listRecords(params, scope), { signal }),
  getAttendanceById: (id: string, scope: AttendanceScope, signal?: Signal): Promise<AttendanceRecord> => mockRequest(() => mock.getRecord(id, scope), { signal }),
  getEmployeeAttendanceHistory: (employeeId: string, month: string | undefined, scope: AttendanceScope, signal?: Signal): Promise<EmployeeAttendanceHistory> =>
    mockRequest(() => mock.employeeHistory(employeeId, month, scope), { signal }),
  createAttendanceRecord: (input: AttendanceRecordInput, scope: AttendanceScope): Promise<AttendanceRecord> => mockRequest(() => mock.createRecord(input, scope)),
  updateAttendanceRecord: (id: string, input: AttendanceUpdateInput, scope: AttendanceScope): Promise<AttendanceRecord> => mockRequest(() => mock.updateRecord(id, input, scope)),
  checkIn: (input: PunchInput, scope: AttendanceScope): Promise<AttendanceRecord> => mockRequest(() => mock.checkIn(input, scope)),
  checkOut: (input: PunchInput, scope: AttendanceScope): Promise<AttendanceRecord> => mockRequest(() => mock.checkOut(input, scope)),

  getShifts: (params: ListParams<ShiftFilters>, scope: AttendanceScope, signal?: Signal): Promise<Paginated<Shift>> => mockRequest(() => mock.listShifts(params, scope), { signal }),
  getShiftById: (id: string, scope: AttendanceScope, signal?: Signal): Promise<Shift> => mockRequest(() => mock.getShift(id, scope), { signal }),
  /** Employees currently assigned to a shift (within the caller's scope). */
  getShiftMembers: (id: string, scope: AttendanceScope, signal?: Signal): Promise<mock.ShiftMember[]> => mockRequest(() => mock.shiftMembers(id, scope), { signal }),
  createShift: (input: ShiftInput, scope: AttendanceScope): Promise<Shift> => mockRequest(() => mock.createShift(input, scope)),
  updateShift: (id: string, input: ShiftInput, scope: AttendanceScope): Promise<Shift> => mockRequest(() => mock.updateShift(id, input, scope)),
  updateShiftStatus: (id: string, status: RecordStatus, scope: AttendanceScope): Promise<Shift> => mockRequest(() => mock.updateShiftStatus(id, status, scope)),
  /** Assign employees to a shift from today (or `from`); earlier records keep their shift. */
  assignShift: (input: { shiftId: string; employeeIds: string[]; from?: string }, scope: AttendanceScope): Promise<{ assigned: number }> =>
    mockRequest(() => mock.assignShift(input, scope)),

  getAttendanceReports: (params: ListParams<ReportFilters>, scope: AttendanceScope, signal?: Signal): Promise<AttendanceReport> => mockRequest(() => mock.report(params, scope), { signal }),
  /** CSV of the whole filtered report, limited to the caller's scope. */
  exportAttendanceReport: (filters: ReportFilters, language: 'en' | 'ar', scope: AttendanceScope): Promise<CsvExport> => mockRequest(() => mock.exportReport(filters, language, scope)),
};

export type { ShiftMember } from '@/modules/attendance/mock/attendanceMock';
