import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useLanguage } from '@/i18n/useLanguage';
import { payrollApi } from '@/modules/payroll/api/payrollApi';
import type {
  AllowanceTypeInput,
  AssignmentInput,
  CompensationFilters,
  CompensationInput,
  DeductionTypeInput,
  LineFilters,
  PayrollReportFilters,
  PayrollScope,
  PayslipFilters,
  PolicyInput,
  RecordStatus,
  RunFilters,
  RunInput,
  SalaryStructureInput,
  StructureFilters,
  TypeFilters,
} from '@/modules/payroll/types/payroll';
import { usePayrollAccess } from './usePayrollAccess';

/**
 * Query keys: `['payroll', <resource>, scope, …]` — the scope is part of every read key, so own-only data is never served
 * from an organization-wide cache entry (or the other way round).
 */
export const payrollKeys = {
  all: ['payroll'] as const,
  summary: (s: PayrollScope) => [...payrollKeys.all, 'summary', s] as const,
  structures: (s: PayrollScope, p: ListParams<StructureFilters>) => [...payrollKeys.all, 'structures', s, p] as const,
  compensations: (s: PayrollScope, p: ListParams<CompensationFilters>) => [...payrollKeys.all, 'compensation', 'list', s, p] as const,
  compensation: (s: PayrollScope, employeeId: string) => [...payrollKeys.all, 'compensation', 'detail', s, employeeId] as const,
  allowanceTypes: (s: PayrollScope, p: ListParams<TypeFilters>) => [...payrollKeys.all, 'allowance-types', s, p] as const,
  deductionTypes: (s: PayrollScope, p: ListParams<TypeFilters>) => [...payrollKeys.all, 'deduction-types', s, p] as const,
  policy: (s: PayrollScope) => [...payrollKeys.all, 'policy', s] as const,
  runs: (s: PayrollScope, p: ListParams<RunFilters>) => [...payrollKeys.all, 'runs', 'list', s, p] as const,
  run: (s: PayrollScope, id: string) => [...payrollKeys.all, 'runs', 'detail', s, id] as const,
  lines: (s: PayrollScope, id: string, p: ListParams<LineFilters>) => [...payrollKeys.all, 'runs', 'lines', s, id, p] as const,
  line: (s: PayrollScope, id: string, employeeId: string) => [...payrollKeys.all, 'runs', 'line', s, id, employeeId] as const,
  payslips: (s: PayrollScope, p: ListParams<PayslipFilters>) => [...payrollKeys.all, 'payslips', 'list', s, p] as const,
  payslip: (s: PayrollScope, id: string) => [...payrollKeys.all, 'payslips', 'detail', s, id] as const,
  report: (s: PayrollScope, p: ListParams<PayrollReportFilters>) => [...payrollKeys.all, 'report', s, p] as const,
  my: (s: PayrollScope) => [...payrollKeys.all, 'my', s] as const,
  options: (s: PayrollScope, search: string) => [...payrollKeys.all, 'options', s, search] as const,
};

/* Queries ---------------------------------------------------------------------------------------------- */

export function usePayrollSummary() {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.summary(scope), queryFn: ({ signal }) => payrollApi.getPayrollSummary(scope, signal), staleTime: 60_000 });
}
export function useSalaryStructures(params: ListParams<StructureFilters>, enabled = true) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.structures(scope, params), queryFn: ({ signal }) => payrollApi.getSalaryStructures(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useCompensations(params: ListParams<CompensationFilters>) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.compensations(scope, params), queryFn: ({ signal }) => payrollApi.getEmployeeCompensations(params, scope, signal), placeholderData: keepPreviousData });
}
export function useCompensation(employeeId: string) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.compensation(scope, employeeId), queryFn: ({ signal }) => payrollApi.getEmployeeCompensation(employeeId, scope, signal) });
}
export function useAllowanceTypes(params: ListParams<TypeFilters>, enabled = true) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.allowanceTypes(scope, params), queryFn: ({ signal }) => payrollApi.getAllowanceTypes(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useDeductionTypes(params: ListParams<TypeFilters>, enabled = true) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.deductionTypes(scope, params), queryFn: ({ signal }) => payrollApi.getDeductionTypes(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function usePayrollPolicy(enabled = true) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.policy(scope), queryFn: ({ signal }) => payrollApi.getPayrollPolicy(scope, signal), enabled });
}
export function usePayrollRuns(params: ListParams<RunFilters>) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.runs(scope, params), queryFn: ({ signal }) => payrollApi.getPayrollRuns(params, scope, signal), placeholderData: keepPreviousData });
}
export function usePayrollRun(id: string) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.run(scope, id), queryFn: ({ signal }) => payrollApi.getPayrollRunById(id, scope, signal) });
}
export function usePayrollLines(id: string, params: ListParams<LineFilters>, enabled = true) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.lines(scope, id, params), queryFn: ({ signal }) => payrollApi.getPayrollDetails(id, params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function usePayrollLine(id: string, employeeId: string) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.line(scope, id, employeeId), queryFn: ({ signal }) => payrollApi.getPayrollLine(id, employeeId, scope, signal) });
}
/** Organization payslips (hr.payroll.view), or the caller's OWN payslips (own scope, or `own` = true for My payroll). */
export function usePayslips(params: ListParams<PayslipFilters>, own = false) {
  const { scope } = usePayrollAccess();
  return useQuery({
    queryKey: [...payrollKeys.payslips(scope, params), own ? 'own' : 'scope'],
    queryFn: ({ signal }) => (scope.kind === 'organization' && !own ? payrollApi.getPayslips(params, scope, signal) : payrollApi.getMyPayslips(params, scope, signal)),
    placeholderData: keepPreviousData,
  });
}
export function usePayslip(id: string) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.payslip(scope, id), queryFn: ({ signal }) => payrollApi.getPayslipById(id, scope, signal) });
}
export function usePayrollReport(params: ListParams<PayrollReportFilters>, enabled: boolean) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.report(scope, params), queryFn: ({ signal }) => payrollApi.getPayrollReports(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useMyPayroll() {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.my(scope), queryFn: ({ signal }) => payrollApi.getMyPayroll(scope, signal) });
}
export function usePayrollEmployeeOptions(search: string, enabled = true) {
  const { scope } = usePayrollAccess();
  return useQuery({ queryKey: payrollKeys.options(scope, search), queryFn: ({ signal }) => payrollApi.getEmployeeOptions(search, scope, signal), placeholderData: keepPreviousData, enabled });
}

/* Mutations (every change invalidates the payroll cache, so totals, lists and details stay consistent) ------ */

function useWrite<TVars, TResult>(fn: (vars: TVars, scope: PayrollScope) => Promise<TResult>) {
  const { scope } = usePayrollAccess();
  const client = useQueryClient();
  return useMutation({ mutationFn: (vars: TVars) => fn(vars, scope), onSuccess: () => client.invalidateQueries({ queryKey: payrollKeys.all }) });
}

export const useCreateStructure = () => useWrite((input: SalaryStructureInput, s) => payrollApi.createSalaryStructure(input, s));
export const useUpdateStructure = () => useWrite(({ id, input }: { id: string; input: SalaryStructureInput }, s) => payrollApi.updateSalaryStructure(id, input, s));
export const useUpdateStructureStatus = () => useWrite(({ id, status }: { id: string; status: RecordStatus }, s) => payrollApi.updateSalaryStructureStatus(id, status, s));
export const useUpdateCompensation = () => useWrite(({ employeeId, input }: { employeeId: string; input: CompensationInput }, s) => payrollApi.updateEmployeeCompensation(employeeId, input, s));

export const useCreateAllowanceType = () => useWrite((input: AllowanceTypeInput, s) => payrollApi.createAllowanceType(input, s));
export const useUpdateAllowanceType = () => useWrite(({ id, input }: { id: string; input: AllowanceTypeInput }, s) => payrollApi.updateAllowanceType(id, input, s));
export const useUpdateAllowanceTypeStatus = () => useWrite(({ id, status }: { id: string; status: RecordStatus }, s) => payrollApi.updateAllowanceTypeStatus(id, status, s));
export const useCreateDeductionType = () => useWrite((input: DeductionTypeInput, s) => payrollApi.createDeductionType(input, s));
export const useUpdateDeductionType = () => useWrite(({ id, input }: { id: string; input: DeductionTypeInput }, s) => payrollApi.updateDeductionType(id, input, s));
export const useUpdateDeductionTypeStatus = () => useWrite(({ id, status }: { id: string; status: RecordStatus }, s) => payrollApi.updateDeductionTypeStatus(id, status, s));
export const useAssignAllowance = () => useWrite(({ employeeId, input }: { employeeId: string; input: AssignmentInput }, s) => payrollApi.assignEmployeeAllowance(employeeId, input, s));
export const useAssignDeduction = () => useWrite(({ employeeId, input }: { employeeId: string; input: AssignmentInput }, s) => payrollApi.assignEmployeeDeduction(employeeId, input, s));
export const useEndAssignment = () => useWrite(({ id, endDate, note }: { id: string; endDate: string; note: string }, s) => payrollApi.endEmployeeAssignment(id, endDate, note, s));
export const useUpdatePolicy = () => useWrite((input: PolicyInput, s) => payrollApi.updatePayrollPolicy(input, s));

export const useCreateRun = () => useWrite((input: RunInput, s) => payrollApi.createPayrollRun(input, s));
export const useUpdateRun = () => useWrite(({ id, input }: { id: string; input: RunInput }, s) => payrollApi.updatePayrollRun(id, input, s));
export const useCalculateRun = () => useWrite((id: string, s) => payrollApi.calculatePayrollRun(id, s));
export const useValidateRun = () => useWrite((id: string, s) => payrollApi.validatePayrollRun(id, s));
export const useSubmitRun = () => useWrite((id: string, s) => payrollApi.submitPayrollForApproval(id, s));
export const useApproveRun = () => useWrite((id: string, s) => payrollApi.approvePayrollRun(id, s));
export const useRejectRun = () => useWrite(({ id, reason }: { id: string; reason: string }, s) => payrollApi.rejectPayrollRun(id, reason, s));
export const useMarkRunPaid = () => useWrite((id: string, s) => payrollApi.markPayrollAsPaid(id, s));
export const useCancelRun = () => useWrite(({ id, reason }: { id: string; reason: string }, s) => payrollApi.cancelPayrollRun(id, reason, s));
export const useGeneratePayslips = () => useWrite(({ id, employeeIds }: { id: string; employeeIds?: string[] }, s) => payrollApi.generatePayslip(id, employeeIds, s));

/** CSV export (not cached: every click builds the file from current data in the user's language). */
export function useExportReport() {
  const { scope } = usePayrollAccess();
  const { language } = useLanguage();
  return useMutation({ mutationFn: (filters: PayrollReportFilters) => payrollApi.exportPayrollReport(filters, language, scope) });
}
