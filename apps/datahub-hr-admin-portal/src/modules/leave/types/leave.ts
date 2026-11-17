import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Leave contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly these shapes.
 * Requests reference existing employee ids (Employee Management) and keep a snapshot of the employee's name, number and
 * department at submission. Dates are local `YYYY-MM-DD`; timestamps ISO.
 */

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export type RecordStatus = 'active' | 'inactive';
export type Eligibility = 'all' | 'female' | 'male';

/* Leave types and allocation rules ------------------------------------------------------------------- */

export interface LeaveType {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  paid: boolean;
  /** Days per calendar year; `null` = no annual allocation (no balance limit, e.g. unpaid leave). */
  annualAllocation: number | null;
  /** Extra days per year once the employee has at least `seniorityYears` of service (0 = no seniority rule). */
  seniorityYears: number;
  seniorityExtraDays: number;
  /** Employees hired during the year receive a pro-rated allocation (by remaining months). */
  prorateFirstYear: boolean;
  /** `null` = no limit on one request. */
  maxConsecutiveDays: number | null;
  requiresApproval: boolean;
  requiresDocument: boolean;
  /** Who may take this leave (the backend checks it; the employee's gender is not shown to approvers). */
  eligibility: Eligibility;
  /** Public holidays inside a request are not counted as leave days (otherwise they are). */
  excludesPublicHolidays: boolean;
  status: RecordStatus;
  createdAt: string;
}

export type LeaveTypeInput = Omit<LeaveType, 'id' | 'status' | 'createdAt'>;

export interface LeaveTypeFilters {
  status: RecordStatus;
  paid: 'paid' | 'unpaid';
}

export type LeaveTypeSortField = 'code' | 'name.en' | 'name.ar' | 'annualAllocation' | 'status';

/* Requests --------------------------------------------------------------------------------------------- */

export const LEAVE_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface LeaveDocument {
  /** File metadata only — the file itself is NOT stored anywhere in this demo. */
  fileName: string;
  sizeBytes: number;
}

export type LeaveAction = 'created' | 'submitted' | 'updated' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveHistoryEntry {
  at: string;
  action: LeaveAction;
  by: Localized<string>;
  note: string;
}

export interface LeaveRequest {
  id: string;
  /** e.g. LR-2026-0042 */
  number: string;
  employeeId: string;
  /** Snapshot at creation. */
  employee: { name: Localized<string>; employeeNumber: string; department: NamedRef };
  leaveType: NamedRef & { code: string; paid: boolean };
  startDate: string;
  endDate: string;
  /** Working days (per the employee's shift schedule) minus excluded public holidays. */
  days: number;
  /** Only returned to the requester and to approvers (may contain medical details). */
  reason: string | null;
  document: LeaveDocument | null;
  status: LeaveStatus;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: Localized<string> | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  history: LeaveHistoryEntry[];
  /** What the caller may do with it now (computed by the backend from the rules and the caller's permissions). */
  can: { edit: boolean; cancel: boolean; approve: boolean };
}

export interface LeaveRequestFilters {
  employeeId: string;
  departmentId: string;
  leaveTypeId: string;
  status: LeaveStatus;
  /** Requests overlapping [from, to]. */
  from: string;
  to: string;
  /** Only requests the caller may approve now. */
  awaitingMe: 'true';
}

export type LeaveRequestSortField = 'number' | 'employee.name.en' | 'employee.name.ar' | 'startDate' | 'days' | 'submittedAt' | 'status';

export interface LeaveRequestInput {
  /** Must be the caller's own employee record (no on-behalf permission exists in the matrix). */
  employeeId?: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  document: LeaveDocument | null;
  /** `false` keeps a draft; `true` submits (pending, or approved directly if the type needs no approval). */
  submit: boolean;
}

/** Preview of a request before submitting: working days and the resulting balance. */
export interface LeaveQuote {
  days: number;
  /** Dates counted (working days of the employee's schedule, minus excluded holidays). */
  countedDates: string[];
  excludedHolidays: Array<{ date: string; name: Localized<string> }>;
  balance: LeaveBalance | null;
  /** Remaining after this request (null = no limit). */
  remainingAfter: number | null;
}

/* Balances --------------------------------------------------------------------------------------------- */

export interface LeaveBalance {
  employeeId: string;
  employee: { name: Localized<string>; employeeNumber: string; department: NamedRef };
  leaveType: NamedRef & { code: string; paid: boolean };
  year: number;
  /** `null` = no annual allocation (no limit). */
  allocated: number | null;
  used: number;
  /** Reserved by pending requests (not deducted from "used"). */
  pending: number;
  /** allocated − used − pending (`null` when there is no allocation). */
  remaining: number | null;
}

export interface LeaveBalanceFilters {
  departmentId: string;
  leaveTypeId: string;
  year: string;
  employeeId: string;
}

export type LeaveBalanceSortField = 'employee.name.en' | 'employee.name.ar' | 'employee.employeeNumber' | 'remaining' | 'used';

export type BalanceEventType = 'allocated' | 'reserved' | 'released' | 'used' | 'restored';

export interface BalanceEvent {
  date: string;
  type: BalanceEventType;
  /** Positive = adds to remaining, negative = takes from it. */
  days: number;
  requestId: string | null;
  requestNumber: string | null;
  note: string;
}

/* Calendar, overview, reports -------------------------------------------------------------------------- */

export interface CalendarEntry {
  requestId: string;
  number: string;
  employeeId: string;
  name: Localized<string>;
  department: NamedRef;
  leaveType: NamedRef & { code: string };
  startDate: string;
  endDate: string;
  status: 'approved' | 'pending';
}

export interface LeaveSummary {
  year: number;
  total: number;
  byStatus: Record<LeaveStatus, number>;
  /** Approved leave covering today. */
  onLeaveToday: number;
  /** Approved leave days in the year. */
  daysUsed: number;
  monthly: Array<{ month: string } & Record<'pending' | 'approved' | 'rejected' | 'cancelled', number>>;
  byType: Array<{ leaveType: NamedRef; days: number; requests: number }>;
  byDepartment: Array<{ department: NamedRef; days: number; requests: number }>;
}

export const LEAVE_REPORT_TYPES = ['requests', 'balances', 'by-type', 'by-department'] as const;
export type LeaveReportType = (typeof LEAVE_REPORT_TYPES)[number];

export interface LeaveReportFilters {
  type: LeaveReportType;
  from: string;
  to: string;
  departmentId: string;
  leaveTypeId: string;
}

export interface UsageRow {
  key: NamedRef;
  requests: number;
  approvedDays: number;
  pendingDays: number;
  employees: number;
}

export type LeaveReportRows =
  | { type: 'requests'; rows: LeaveRequest[] }
  | { type: 'balances'; rows: LeaveBalance[] }
  | { type: 'by-type' | 'by-department'; rows: UsageRow[] };

export interface LeaveReport {
  filters: LeaveReportFilters;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: LeaveReportRows;
}

export interface CsvExport {
  fileName: string;
  content: string;
  rows: number;
}

/* Scope ------------------------------------------------------------------------------------------------ */

/**
 * Who is asking: `organization` (leave:read), `team` (leave:read:team — departments the user manages) or `own`
 * (leave:read:own), plus the role for the action rules. The real backend derives all of it from the token.
 */
export interface LeaveScope {
  kind: 'organization' | 'team' | 'own';
  userId: string;
  role: Role;
}

export interface PublicHoliday {
  date: string;
  name: Localized<string>;
}
