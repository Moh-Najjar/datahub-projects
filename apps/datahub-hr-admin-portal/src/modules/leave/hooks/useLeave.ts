import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { leaveApi, type CalendarFilters } from '@/modules/leave/api/leaveApi';
import type { LeaveBalanceFilters, LeaveReportFilters, LeaveRequestFilters, LeaveRequestInput, LeaveScope, LeaveTypeFilters, LeaveTypeInput, RecordStatus } from '@/modules/leave/types/leave';
import { useLeaveAccess } from './useLeaveAccess';

/**
 * Query keys: `['leave', <resource>, scope, …]` — the scope (kind, user, role) is part of every read key, so team or
 * own-only data is never served from an organization-wide cache entry.
 */
export const leaveKeys = {
  all: ['leave'] as const,
  types: () => [...leaveKeys.all, 'types'] as const,
  typeList: (scope: LeaveScope, params: ListParams<LeaveTypeFilters>) => [...leaveKeys.types(), 'list', scope, params] as const,
  type: (scope: LeaveScope, id: string) => [...leaveKeys.types(), 'detail', scope, id] as const,
  requests: () => [...leaveKeys.all, 'requests'] as const,
  requestList: (scope: LeaveScope, params: ListParams<LeaveRequestFilters>) => [...leaveKeys.requests(), 'list', scope, params] as const,
  request: (scope: LeaveScope, id: string) => [...leaveKeys.requests(), 'detail', scope, id] as const,
  quote: (scope: LeaveScope, input: LeaveRequestInput, exceptId: string | undefined) => [...leaveKeys.requests(), 'quote', scope, input, exceptId ?? null] as const,
  balances: () => [...leaveKeys.all, 'balances'] as const,
  balanceList: (scope: LeaveScope, params: ListParams<LeaveBalanceFilters>) => [...leaveKeys.balances(), 'list', scope, params] as const,
  employeeBalances: (scope: LeaveScope, employeeId: string, year: number | undefined) => [...leaveKeys.balances(), 'employee', scope, employeeId, year ?? 'current'] as const,
  balanceHistory: (scope: LeaveScope, employeeId: string, leaveTypeId: string, year: number | undefined) => [...leaveKeys.balances(), 'history', scope, employeeId, leaveTypeId, year ?? 'current'] as const,
  calendar: (scope: LeaveScope, month: string, filters: CalendarFilters) => [...leaveKeys.all, 'calendar', scope, month, filters] as const,
  summary: (scope: LeaveScope, year: number | undefined) => [...leaveKeys.all, 'summary', scope, year ?? 'current'] as const,
  reports: (scope: LeaveScope, params: ListParams<LeaveReportFilters>) => [...leaveKeys.all, 'reports', scope, params] as const,
};

/**
 * Attendance derives "On leave" from approved leave, so request decisions and cancellations must refresh its cache too.
 * The key root is the Attendance module's documented `['attendance']` prefix — referenced by value (not imported) so
 * Leave does not depend on the Attendance module (which itself depends on Employees, which embeds Leave).
 */
const ATTENDANCE_ROOT = ['attendance'] as const;

/* Queries ------------------------------------------------------------------------------------------- */

export function useLeaveTypes(params: ListParams<LeaveTypeFilters>, enabled = true) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.typeList(scope, params), queryFn: ({ signal }) => leaveApi.getLeaveTypes(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useLeaveType(id: string) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.type(scope, id), queryFn: ({ signal }) => leaveApi.getLeaveTypeById(id, scope, signal) });
}

export function useLeaveRequests(params: ListParams<LeaveRequestFilters>, enabled = true) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.requestList(scope, params), queryFn: ({ signal }) => leaveApi.getLeaveRequests(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useLeaveRequest(id: string) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.request(scope, id), queryFn: ({ signal }) => leaveApi.getLeaveRequestById(id, scope, signal) });
}

/** Live preview while the form is filled in (disabled until the dates and the type are valid). */
export function useLeaveQuote(input: LeaveRequestInput, enabled: boolean, exceptId?: string) {
  const { scope } = useLeaveAccess();
  return useQuery({
    queryKey: leaveKeys.quote(scope, input, exceptId),
    queryFn: ({ signal }) => leaveApi.getLeaveQuote(input, scope, exceptId, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useLeaveBalances(params: ListParams<LeaveBalanceFilters>, enabled = true) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.balanceList(scope, params), queryFn: ({ signal }) => leaveApi.getLeaveBalances(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

export function useEmployeeLeaveBalances(employeeId: string, year?: number, enabled = true) {
  const { scope } = useLeaveAccess();
  return useQuery({
    queryKey: leaveKeys.employeeBalances(scope, employeeId, year),
    queryFn: ({ signal }) => leaveApi.getEmployeeLeaveBalances(employeeId, year, scope, signal),
    enabled: enabled && Boolean(employeeId),
    placeholderData: keepPreviousData,
  });
}

export function useLeaveBalanceHistory(employeeId: string, leaveTypeId: string, year?: number) {
  const { scope } = useLeaveAccess();
  return useQuery({
    queryKey: leaveKeys.balanceHistory(scope, employeeId, leaveTypeId, year),
    queryFn: ({ signal }) => leaveApi.getLeaveBalanceHistory(employeeId, leaveTypeId, year, scope, signal),
    enabled: Boolean(employeeId && leaveTypeId),
  });
}

export function useLeaveCalendar(month: string, filters: CalendarFilters) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.calendar(scope, month, filters), queryFn: ({ signal }) => leaveApi.getLeaveCalendar(month, filters, scope, signal), placeholderData: keepPreviousData });
}

export function useLeaveSummary(year?: number, enabled = true) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.summary(scope, year), queryFn: ({ signal }) => leaveApi.getLeaveSummary(year, scope, signal), enabled, staleTime: 60_000 });
}

export function useLeaveReport(params: ListParams<LeaveReportFilters>, enabled = true) {
  const { scope } = useLeaveAccess();
  return useQuery({ queryKey: leaveKeys.reports(scope, params), queryFn: ({ signal }) => leaveApi.getLeaveReports(params, scope, signal), placeholderData: keepPreviousData, enabled });
}

/* Mutations ----------------------------------------------------------------------------------------- */

/** Leave type changes alter allocations: refresh the whole leave module (attendance is unaffected). */
function useInvalidateLeave(alsoAttendance: boolean) {
  const client = useQueryClient();
  return () =>
    Promise.all([client.invalidateQueries({ queryKey: leaveKeys.all }), alsoAttendance ? client.invalidateQueries({ queryKey: ATTENDANCE_ROOT }) : undefined]);
}

export function useCreateLeaveType() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(false);
  return useMutation({ mutationFn: (input: LeaveTypeInput) => leaveApi.createLeaveType(input, scope), onSuccess: invalidate });
}

export function useUpdateLeaveType() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(false);
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: LeaveTypeInput }) => leaveApi.updateLeaveType(id, input, scope), onSuccess: invalidate });
}

export function useUpdateLeaveTypeStatus() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(false);
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: RecordStatus }) => leaveApi.updateLeaveTypeStatus(id, status, scope), onSuccess: invalidate });
}

/** Requests types without approval are approved at once → attendance may change as well. */
export function useCreateLeaveRequest() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(true);
  return useMutation({ mutationFn: (input: LeaveRequestInput) => leaveApi.createLeaveRequest(input, scope), onSuccess: invalidate });
}

export function useUpdateLeaveRequest() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(true);
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: LeaveRequestInput }) => leaveApi.updateLeaveRequest(id, input, scope), onSuccess: invalidate });
}

export function useApproveLeaveRequest() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(true);
  return useMutation({ mutationFn: (id: string) => leaveApi.approveLeaveRequest(id, scope), onSuccess: invalidate });
}

export function useRejectLeaveRequest() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(true);
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => leaveApi.rejectLeaveRequest(id, reason, scope), onSuccess: invalidate });
}

export function useCancelLeaveRequest() {
  const { scope } = useLeaveAccess();
  const invalidate = useInvalidateLeave(true);
  return useMutation({ mutationFn: (id: string) => leaveApi.cancelLeaveRequest(id, scope), onSuccess: invalidate });
}

/** CSV export is a one-off request (not cached). */
export function useExportLeaveReport() {
  const { scope } = useLeaveAccess();
  return useMutation({ mutationFn: ({ filters, language }: { filters: LeaveReportFilters; language: 'en' | 'ar' }) => leaveApi.exportLeaveReport(filters, language, scope) });
}
