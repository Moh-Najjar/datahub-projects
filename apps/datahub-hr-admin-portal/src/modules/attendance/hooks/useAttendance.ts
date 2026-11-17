import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { attendanceApi } from '@/modules/attendance/api/attendanceApi';
import type {
  AttendanceFilters,
  AttendanceRecordInput,
  AttendanceScope,
  AttendanceUpdateInput,
  PunchInput,
  RecordStatus,
  ReportFilters,
  ShiftFilters,
  ShiftInput,
} from '@/modules/attendance/types/attendance';
import { useAttendanceAccess } from './useAttendanceAccess';

/**
 * Query keys: `['attendance', <resource>, scope, …]` — the scope (kind, user, role) is part of every read key, so
 * team-scoped or own-only data is never served from an organization-wide cache entry.
 */
export const attendanceKeys = {
  all: ['attendance'] as const,
  summary: (scope: AttendanceScope) => [...attendanceKeys.all, 'summary', scope] as const,
  records: () => [...attendanceKeys.all, 'records'] as const,
  recordList: (scope: AttendanceScope, params: ListParams<AttendanceFilters>) => [...attendanceKeys.records(), 'list', scope, params] as const,
  record: (scope: AttendanceScope, id: string) => [...attendanceKeys.records(), 'detail', scope, id] as const,
  history: (scope: AttendanceScope, employeeId: string, month: string | undefined) => [...attendanceKeys.all, 'history', scope, employeeId, month ?? 'latest'] as const,
  shifts: () => [...attendanceKeys.all, 'shifts'] as const,
  shiftList: (scope: AttendanceScope, params: ListParams<ShiftFilters>) => [...attendanceKeys.shifts(), 'list', scope, params] as const,
  shift: (scope: AttendanceScope, id: string) => [...attendanceKeys.shifts(), 'detail', scope, id] as const,
  shiftMembers: (scope: AttendanceScope, id: string) => [...attendanceKeys.shifts(), 'members', scope, id] as const,
  reports: (scope: AttendanceScope, params: ListParams<ReportFilters>) => [...attendanceKeys.all, 'reports', scope, params] as const,
};

/* Queries ------------------------------------------------------------------------------------------- */

export function useAttendanceSummary(enabled = true) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.summary(scope), queryFn: ({ signal }) => attendanceApi.getAttendanceSummary(scope, signal), enabled });
}

export function useAttendanceRecords(params: ListParams<AttendanceFilters>) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.recordList(scope, params), queryFn: ({ signal }) => attendanceApi.getAttendanceRecords(params, scope, signal), placeholderData: keepPreviousData });
}

export function useAttendanceRecord(id: string) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.record(scope, id), queryFn: ({ signal }) => attendanceApi.getAttendanceById(id, scope, signal) });
}

export function useAttendanceHistory(employeeId: string, month: string | undefined) {
  const { scope } = useAttendanceAccess();
  return useQuery({
    queryKey: attendanceKeys.history(scope, employeeId, month),
    queryFn: ({ signal }) => attendanceApi.getEmployeeAttendanceHistory(employeeId, month, scope, signal),
    enabled: Boolean(employeeId),
    placeholderData: keepPreviousData,
  });
}

export function useShifts(params: ListParams<ShiftFilters>, enabled = true) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.shiftList(scope, params), queryFn: ({ signal }) => attendanceApi.getShifts(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useShift(id: string) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.shift(scope, id), queryFn: ({ signal }) => attendanceApi.getShiftById(id, scope, signal) });
}

export function useShiftMembers(id: string) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.shiftMembers(scope, id), queryFn: ({ signal }) => attendanceApi.getShiftMembers(id, scope, signal) });
}

export function useAttendanceReport(params: ListParams<ReportFilters>) {
  const { scope } = useAttendanceAccess();
  return useQuery({ queryKey: attendanceKeys.reports(scope, params), queryFn: ({ signal }) => attendanceApi.getAttendanceReports(params, scope, signal), placeholderData: keepPreviousData });
}

/* Mutations ----------------------------------------------------------------------------------------- */

/** Any attendance write can change records, totals, history and reports: refresh the whole module. */
function useInvalidateAttendance() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: attendanceKeys.all });
}

export function useCheckIn() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (input: PunchInput) => attendanceApi.checkIn(input, scope), onSuccess: invalidate });
}

export function useCheckOut() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (input: PunchInput) => attendanceApi.checkOut(input, scope), onSuccess: invalidate });
}

export function useUpdateAttendanceRecord() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: AttendanceUpdateInput }) => attendanceApi.updateAttendanceRecord(id, input, scope), onSuccess: invalidate });
}

export function useCreateAttendanceRecord() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (input: AttendanceRecordInput) => attendanceApi.createAttendanceRecord(input, scope), onSuccess: invalidate });
}

export function useCreateShift() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (input: ShiftInput) => attendanceApi.createShift(input, scope), onSuccess: invalidate });
}

export function useUpdateShift() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: ShiftInput }) => attendanceApi.updateShift(id, input, scope), onSuccess: invalidate });
}

export function useUpdateShiftStatus() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: RecordStatus }) => attendanceApi.updateShiftStatus(id, status, scope), onSuccess: invalidate });
}

export function useAssignShift() {
  const { scope } = useAttendanceAccess();
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (input: { shiftId: string; employeeIds: string[] }) => attendanceApi.assignShift(input, scope), onSuccess: invalidate });
}

/** CSV export is a one-off request (not cached). */
export function useExportAttendanceReport() {
  const { scope } = useAttendanceAccess();
  return useMutation({ mutationFn: ({ filters, language }: { filters: ReportFilters; language: 'en' | 'ar' }) => attendanceApi.exportAttendanceReport(filters, language, scope) });
}
