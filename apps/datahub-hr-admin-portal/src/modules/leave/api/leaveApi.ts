import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/leave/mock/leaveMock';
import type {
  BalanceEvent,
  CalendarEntry,
  CsvExport,
  LeaveBalance,
  LeaveBalanceFilters,
  LeaveQuote,
  LeaveReport,
  LeaveReportFilters,
  LeaveRequest,
  LeaveRequestFilters,
  LeaveRequestInput,
  LeaveScope,
  LeaveSummary,
  LeaveType,
  LeaveTypeFilters,
  LeaveTypeInput,
  RecordStatus,
} from '@/modules/leave/types/leave';

/*
 * Leave API service — the ONLY entry point to leave data. Every call runs against the SIMULATED backend (`mock/`);
 * with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented before the
 * contract exists).
 *
 * `scope` (organization / team / own + role) exists only because the mock has no token: the real backend must derive
 * it from the signed-in user, refuse out-of-scope reads (`FORBIDDEN`) and enforce every leave rule itself.
 */

type Signal = AbortSignal | undefined;
export type CalendarFilters = mock.CalendarFilters;

export const leaveApi = {
  /* Leave types (configurable rules) */
  getLeaveTypes: (params: ListParams<LeaveTypeFilters>, scope: LeaveScope, signal?: Signal): Promise<Paginated<LeaveType>> => mockRequest(() => mock.listLeaveTypes(params, scope), { signal }),
  getLeaveTypeById: (id: string, scope: LeaveScope, signal?: Signal): Promise<LeaveType> => mockRequest(() => mock.getLeaveType(id, scope), { signal }),
  createLeaveType: (input: LeaveTypeInput, scope: LeaveScope): Promise<LeaveType> => mockRequest(() => mock.createLeaveType(input, scope)),
  updateLeaveType: (id: string, input: LeaveTypeInput, scope: LeaveScope): Promise<LeaveType> => mockRequest(() => mock.updateLeaveType(id, input, scope)),
  updateLeaveTypeStatus: (id: string, status: RecordStatus, scope: LeaveScope): Promise<LeaveType> => mockRequest(() => mock.updateLeaveTypeStatus(id, status, scope)),

  /* Balances (remaining = allocated − used − pending) */
  getLeaveBalances: (params: ListParams<LeaveBalanceFilters>, scope: LeaveScope, signal?: Signal): Promise<Paginated<LeaveBalance>> => mockRequest(() => mock.listBalances(params, scope), { signal }),
  /** `employeeId = 'me'` → the signed-in user's own balances. */
  getEmployeeLeaveBalances: (employeeId: string, year: number | undefined, scope: LeaveScope, signal?: Signal): Promise<LeaveBalance[]> =>
    mockRequest(() => mock.employeeBalances(employeeId, year, scope), { signal }),
  getLeaveBalanceHistory: (employeeId: string, leaveTypeId: string, year: number | undefined, scope: LeaveScope, signal?: Signal): Promise<BalanceEvent[]> =>
    mockRequest(() => mock.balanceHistory(employeeId, leaveTypeId, year, scope), { signal }),

  /* Requests and approvals */
  getLeaveRequests: (params: ListParams<LeaveRequestFilters>, scope: LeaveScope, signal?: Signal): Promise<Paginated<LeaveRequest>> => mockRequest(() => mock.listRequests(params, scope), { signal }),
  getLeaveRequestById: (id: string, scope: LeaveScope, signal?: Signal): Promise<LeaveRequest> => mockRequest(() => mock.getRequest(id, scope), { signal }),
  /** Days and resulting balance for a request being filled in (`exceptId` = the request being edited). */
  getLeaveQuote: (input: LeaveRequestInput, scope: LeaveScope, exceptId?: string, signal?: Signal): Promise<LeaveQuote> => mockRequest(() => mock.quote(input, scope, exceptId), { signal }),
  createLeaveRequest: (input: LeaveRequestInput, scope: LeaveScope): Promise<LeaveRequest> => mockRequest(() => mock.createRequest(input, scope)),
  updateLeaveRequest: (id: string, input: LeaveRequestInput, scope: LeaveScope): Promise<LeaveRequest> => mockRequest(() => mock.updateRequest(id, input, scope)),
  approveLeaveRequest: (id: string, scope: LeaveScope): Promise<LeaveRequest> => mockRequest(() => mock.approveRequest(id, scope)),
  rejectLeaveRequest: (id: string, reason: string, scope: LeaveScope): Promise<LeaveRequest> => mockRequest(() => mock.rejectRequest(id, reason, scope)),
  cancelLeaveRequest: (id: string, scope: LeaveScope): Promise<LeaveRequest> => mockRequest(() => mock.cancelRequest(id, scope)),

  /* Calendar, overview, reports */
  getLeaveCalendar: (month: string, filters: CalendarFilters, scope: LeaveScope, signal?: Signal): Promise<CalendarEntry[]> => mockRequest(() => mock.calendar(month, filters, scope), { signal }),
  getLeaveSummary: (year: number | undefined, scope: LeaveScope, signal?: Signal): Promise<LeaveSummary> => mockRequest(() => mock.summary(year, scope), { signal }),
  getLeaveReports: (params: ListParams<LeaveReportFilters>, scope: LeaveScope, signal?: Signal): Promise<LeaveReport> => mockRequest(() => mock.report(params, scope), { signal }),
  /** CSV of the whole filtered report, limited to the caller's scope. */
  exportLeaveReport: (filters: LeaveReportFilters, language: 'en' | 'ar', scope: LeaveScope): Promise<CsvExport> => mockRequest(() => mock.exportReport(filters, language, scope)),
};
