import type { Paginated } from '@/core/api/types';
import { attendanceApi, type AttendanceRecord, type AttendanceReport, type AttendanceScope } from '@/modules/attendance';
import { documentsApi, type DocumentsScope } from '@/modules/documents';
import { employeesApi, type EmployeeScope, type EmploymentType } from '@/modules/employees';
import { leaveApi, type LeaveReport, type LeaveScope } from '@/modules/leave';
import { payrollApi, type PayrollReportFilters, type PayrollScope } from '@/modules/payroll';
import { performanceApi, type PerformanceScope } from '@/modules/performance';
import { recruitmentApi, type RecruitmentScope } from '@/modules/recruitment';
import type { ReportAccess } from '@/modules/reports/utils/access';

/*
 * The ONLY way Reports reads data: the source modules' public API services (the same calls their own pages make),
 * in the caller's scope. Nothing is copied or stored. Lists are read completely (every page, in parallel) so reports
 * and exports cover all matching records, not just one page.
 */

type Signal = AbortSignal | undefined;
const PAGE = 100;

/** Every page of a paginated endpoint (first page, then the rest in parallel). */
export async function fetchAll<T>(load: (page: number) => Promise<{ items: T[]; totalPages: number }>): Promise<T[]> {
  const first = await load(1);
  const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => load(i + 2)));
  return [first.items, ...rest.map((p) => p.items)].flat();
}
const pages = <T,>(p: Paginated<T>) => ({ items: p.items, totalPages: p.totalPages });

/** Source-module scopes for the caller (never wider than the module itself allows — see utils/access.ts). */
export function sourceScopes(access: ReportAccess) {
  const { userId, role } = access.caller;
  const s = access.scopes;
  return {
    employees: (s.employees === 'team' ? { kind: 'team', userId, role } : { kind: 'organization', role }) as EmployeeScope,
    attendance: { kind: s.attendance ?? 'own', userId, role } as AttendanceScope,
    leave: { kind: s.leave ?? 'own', userId, role } as LeaveScope,
    recruitment: { kind: s.recruitment ?? 'team', userId, role } as RecruitmentScope,
    performance: { kind: s.performance ?? 'own', userId, role } as PerformanceScope,
    payroll: { kind: 'organization', userId, role } as PayrollScope,
    documents: { userId, role } as DocumentsScope,
  };
}

export function sources(access: ReportAccess, signal: Signal) {
  const scope = sourceScopes(access);
  return {
    scope,
    /* Employees */
    employees: (filters: { departmentId?: string; locationId?: string; employmentType?: EmploymentType | ''; status?: 'active' | 'inactive' | '' } = {}) =>
      fetchAll((page) =>
        employeesApi
          .getEmployees(
            { page, pageSize: PAGE, sortBy: 'employeeNumber', sortDirection: 'asc', filters: { departmentId: filters.departmentId || undefined, locationId: filters.locationId || undefined, employmentType: filters.employmentType || undefined, status: filters.status || undefined } },
            scope.employees,
            signal,
          )
          .then(pages),
      ),
    employee: (id: string) => employeesApi.getEmployeeById(id, scope.employees, signal),
    employmentHistory: (id: string) => employeesApi.getEmployeeEmploymentHistory(id, scope.employees, signal),
    /* Attendance */
    attendanceSummary: () => attendanceApi.getAttendanceSummary(scope.attendance, signal),
    attendanceReport: async (type: AttendanceReport['filters']['type'], from: string, to: string, departmentId: string) => {
      let totals: AttendanceReport['totals'] | null = null;
      const rows = await fetchAll(async (page) => {
        const r = await attendanceApi.getAttendanceReports({ page, pageSize: PAGE, filters: { type, from, to, departmentId } }, scope.attendance, signal);
        totals ??= r.totals;
        return { items: r.data.rows as unknown[], totalPages: r.totalPages };
      });
      return { rows, totals: totals! };
    },
    attendanceRecords: (from: string, to: string, departmentId: string): Promise<AttendanceRecord[]> =>
      fetchAll((page) => attendanceApi.getAttendanceRecords({ page, pageSize: PAGE, filters: { from, to, departmentId: departmentId || undefined } }, scope.attendance, signal).then(pages)),
    /* Leave */
    leaveSummary: (year: number) => leaveApi.getLeaveSummary(year, scope.leave, signal),
    leaveReport: (type: LeaveReport['filters']['type'], from: string, to: string, departmentId: string) =>
      fetchAll(async (page) => {
        const r = await leaveApi.getLeaveReports({ page, pageSize: PAGE, filters: { type, from, to, departmentId, leaveTypeId: '' } }, scope.leave, signal);
        return { items: r.data.rows as unknown[], totalPages: r.totalPages };
      }),
    leaveRequests: (filters: { status?: 'pending' | 'approved'; from?: string; to?: string; departmentId?: string }) =>
      fetchAll((page) => leaveApi.getLeaveRequests({ page, pageSize: PAGE, filters: { status: filters.status, from: filters.from, to: filters.to, departmentId: filters.departmentId || undefined } }, scope.leave, signal).then(pages)),
    /* Recruitment */
    recruitmentSummary: () => recruitmentApi.getRecruitmentSummary(scope.recruitment, signal),
    requisitions: (departmentId = '') => fetchAll((page) => recruitmentApi.getRequisitions({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.recruitment, signal).then(pages)),
    /** Current candidates and archived ones (archived applications still count for sources, hires and timing). */
    candidates: async () => {
      const [current, archived] = await Promise.all([
        fetchAll((page) => recruitmentApi.getCandidates({ page, pageSize: PAGE }, scope.recruitment, signal).then(pages)),
        fetchAll((page) => recruitmentApi.getCandidates({ page, pageSize: PAGE, filters: { archived: 'true' } }, scope.recruitment, signal).then(pages)),
      ]);
      return [...current, ...archived];
    },
    interviews: () => fetchAll((page) => recruitmentApi.getInterviews({ page, pageSize: PAGE }, scope.recruitment, signal).then(pages)),
    offers: () => fetchAll((page) => recruitmentApi.getOffers({ page, pageSize: PAGE }, scope.recruitment, signal).then(pages)),
    /* Performance */
    performanceSummary: () => performanceApi.getPerformanceSummary(scope.performance, signal),
    cycles: () => fetchAll((page) => performanceApi.getReviewCycles({ page, pageSize: PAGE }, scope.performance, signal).then(pages)),
    reviews: (departmentId = '') => fetchAll((page) => performanceApi.getReviews({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.performance, signal).then(pages)),
    goals: (departmentId = '') => fetchAll((page) => performanceApi.getGoals({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.performance, signal).then(pages)),
    plans: (departmentId = '') => fetchAll((page) => performanceApi.getDevelopmentPlans({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.performance, signal).then(pages)),
    /* Payroll */
    payrollSummary: () => payrollApi.getPayrollSummary(scope.payroll, signal),
    payrollReport: async (filters: PayrollReportFilters) => {
      let head: Awaited<ReturnType<typeof payrollApi.getPayrollReports>> | null = null;
      const rows = await fetchAll(async (page) => {
        const r = await payrollApi.getPayrollReports({ page, pageSize: PAGE, filters }, scope.payroll, signal);
        head ??= r;
        return { items: r.rows, totalPages: r.totalPages };
      });
      const first = head!;
      return { columns: first.columns, totals: first.totals, currency: first.currency, rows };
    },
    payrollRuns: (departmentId = '') => fetchAll((page) => payrollApi.getPayrollRuns({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.payroll, signal).then(pages)),
    /* Documents */
    documentsOverview: () => documentsApi.getDocumentsOverview(scope.documents, signal),
    documents: (filters: { departmentId?: string; status?: 'pending-review' | 'verified' } = {}) =>
      fetchAll((page) => documentsApi.getDocuments({ page, pageSize: PAGE, filters: { departmentId: filters.departmentId || undefined, status: filters.status, ownerType: 'employee' } }, scope.documents, signal).then(pages)),
    expiringDocuments: (window: '7' | '30' | '60' | '90', departmentId = '') =>
      fetchAll((page) => documentsApi.getExpiringDocuments({ page, pageSize: PAGE, filters: { window, departmentId: departmentId || undefined } }, scope.documents, signal).then(pages)),
    expiredDocuments: (departmentId = '') => fetchAll((page) => documentsApi.getExpiredDocuments({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.documents, signal).then(pages)),
    compliance: (departmentId = '') => fetchAll((page) => documentsApi.getComplianceList({ page, pageSize: PAGE, filters: { departmentId: departmentId || undefined } }, scope.documents, signal).then(pages)),
  };
}

export type Sources = ReturnType<typeof sources>;
