import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Locale } from '@/i18n/languages';
import { reportsApi, type ExportRequest } from '@/modules/reports/api/reportsApi';
import type { BuilderConfig, ReportCategory, ReportFilters, ReportId, ReportsCaller, SavedReportInput } from '@/modules/reports/types/reports';
import { categoryOf } from '@/modules/reports/utils/access';
import { useReportsAccess } from './useReportsAccess';

/*
 * Server state of Reports & Analytics (TanStack Query). Every key holds the caller (user + role = the scope) and the
 * filters, so a different user, role or filter never reuses another's result. Reports are computed on request:
 * 60 s freshness, no background refetch on focus (a report is a snapshot the user generated).
 */

export const reportKeys = {
  all: ['reports'] as const,
  scope: (c: ReportsCaller) => ['reports', 'scope', c.userId, c.role] as const,
  overview: (c: ReportsCaller, f: ReportFilters) => ['reports', 'overview', c.userId, c.role, f] as const,
  report: (c: ReportsCaller, id: ReportId, f: ReportFilters) => ['reports', 'report', c.userId, c.role, id, f] as const,
  insights: (c: ReportsCaller, f: ReportFilters) => ['reports', 'insights', c.userId, c.role, f] as const,
  executive: (c: ReportsCaller, f: ReportFilters) => ['reports', 'executive', c.userId, c.role, f] as const,
  custom: (c: ReportsCaller, config: BuilderConfig) => ['reports', 'custom', c.userId, c.role, config] as const,
  saved: (c: ReportsCaller) => ['reports', 'saved', c.userId, c.role] as const,
};

const FRESH = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

/** The category operation of a report (getEmployeeReports, getAttendanceReports…). */
const OPERATIONS: Record<ReportCategory, 'getEmployeeReports' | 'getAttendanceReports' | 'getLeaveReports' | 'getRecruitmentReports' | 'getPerformanceReports' | 'getPayrollReports' | 'getDocumentReports'> = {
  employees: 'getEmployeeReports',
  attendance: 'getAttendanceReports',
  leave: 'getLeaveReports',
  recruitment: 'getRecruitmentReports',
  performance: 'getPerformanceReports',
  payroll: 'getPayrollReports',
  documents: 'getDocumentReports',
};

export function useReportScope() {
  const { caller, access } = useReportsAccess();
  return useQuery({ queryKey: reportKeys.scope(caller), queryFn: ({ signal }) => reportsApi.getReportScope(caller, signal), enabled: access.tabs.size > 0, staleTime: 5 * 60_000 });
}

export function useReportsOverview(filters: ReportFilters) {
  const { caller } = useReportsAccess();
  return useQuery({ queryKey: reportKeys.overview(caller, filters), queryFn: ({ signal }) => reportsApi.getReportsOverview(filters, caller, signal), placeholderData: keepPreviousData, ...FRESH });
}

export function useReport(id: ReportId | null, filters: ReportFilters) {
  const { caller } = useReportsAccess();
  return useQuery({
    queryKey: reportKeys.report(caller, id ?? ('employees.directory' as ReportId), filters),
    queryFn: ({ signal }) => reportsApi[OPERATIONS[categoryOf(id!) as ReportCategory]](id!, filters, caller, signal),
    enabled: id !== null,
    placeholderData: (previous) => (previous?.id === id ? previous : undefined),
    ...FRESH,
  });
}

export function useHRInsights(filters: ReportFilters) {
  const { caller } = useReportsAccess();
  return useQuery({ queryKey: reportKeys.insights(caller, filters), queryFn: ({ signal }) => reportsApi.getHRInsights(filters, caller, signal), placeholderData: keepPreviousData, ...FRESH });
}

export function useExecutiveDashboard(filters: ReportFilters) {
  const { caller } = useReportsAccess();
  return useQuery({ queryKey: reportKeys.executive(caller, filters), queryFn: ({ signal }) => reportsApi.getExecutiveDashboard(filters, caller, signal), placeholderData: keepPreviousData, ...FRESH });
}

export function useCustomReport(config: BuilderConfig | null) {
  const { caller } = useReportsAccess();
  return useQuery({
    queryKey: config ? reportKeys.custom(caller, config) : ['reports', 'custom', 'none'],
    queryFn: ({ signal }) => reportsApi.getCustomReport(config!, caller, signal),
    enabled: config !== null,
    ...FRESH,
  });
}

export function useSavedReports() {
  const { caller } = useReportsAccess();
  return useQuery({ queryKey: reportKeys.saved(caller), queryFn: ({ signal }) => reportsApi.getSavedReports(caller, signal) });
}

export function useSaveReport() {
  const { caller } = useReportsAccess();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: SavedReportInput }) => (id ? reportsApi.updateSavedReport(id, input, caller) : reportsApi.saveReportConfiguration(input, caller)),
    onSuccess: () => client.invalidateQueries({ queryKey: reportKeys.saved(caller) }),
  });
}

export function useDeleteSavedReport() {
  const { caller } = useReportsAccess();
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: string) => reportsApi.deleteSavedReport(id, caller), onSuccess: () => client.invalidateQueries({ queryKey: reportKeys.saved(caller) }) });
}

export type { ExportRequest } from '@/modules/reports/api/reportsApi';

export function useExportReport() {
  const { caller } = useReportsAccess();
  return useMutation({ mutationFn: ({ request, language }: { request: ExportRequest; language: Locale }) => reportsApi.exportReport(request, language, caller) });
}
