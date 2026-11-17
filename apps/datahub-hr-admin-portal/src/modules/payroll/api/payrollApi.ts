import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/payroll/mock/payrollMock';
import type {
  AllowanceType,
  AllowanceTypeInput,
  AssignmentInput,
  CompensationFilters,
  CompensationInput,
  CompensationRecord,
  CsvExport,
  DeductionType,
  DeductionTypeInput,
  EmployeeAllowance,
  EmployeeCompensationDetail,
  EmployeeCompensationSummary,
  EmployeeDeduction,
  EmployeeOption,
  LineFilters,
  LineSummary,
  MyPayroll,
  PayrollLine,
  PayrollPolicy,
  PayrollReport,
  PayrollReportFilters,
  PayrollRun,
  PayrollScope,
  PayrollSummary,
  Payslip,
  PayslipFilters,
  PayslipSummary,
  PolicyInput,
  RecordStatus,
  RunFilters,
  RunInput,
  RunSummary,
  SalaryStructure,
  SalaryStructureInput,
  StructureFilters,
  TypeFilters,
} from '@/modules/payroll/types/payroll';

/*
 * Payroll API service — the ONLY entry point to payroll data. Every call runs against the SIMULATED backend (`mock/`);
 * with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented before the
 * contract exists). `scope` exists only because the mock has no token: the real backend derives it from the session.
 * Marking a run as paid is an administrative record only — no payment or bank transfer is made.
 */

type Signal = AbortSignal | undefined;
const run = <T>(handler: () => T, signal?: Signal) => mockRequest(handler, { signal });

export type PayrollLineDetail = ReturnType<typeof mock.runLine>;

export const payrollApi = {
  /* Compensation */
  getSalaryStructures: (params: ListParams<StructureFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<SalaryStructure>> => run(() => mock.listStructures(params, scope), signal),
  getSalaryStructureById: (id: string, scope: PayrollScope, signal?: Signal): Promise<SalaryStructure> => run(() => mock.getStructure(id, scope), signal),
  createSalaryStructure: (input: SalaryStructureInput, scope: PayrollScope): Promise<SalaryStructure> => run(() => mock.createStructure(input, scope)),
  updateSalaryStructure: (id: string, input: SalaryStructureInput, scope: PayrollScope): Promise<SalaryStructure> => run(() => mock.updateStructure(id, input, scope)),
  updateSalaryStructureStatus: (id: string, status: RecordStatus, scope: PayrollScope): Promise<SalaryStructure> => run(() => mock.updateStructureStatus(id, status, scope)),
  getEmployeeCompensations: (params: ListParams<CompensationFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<EmployeeCompensationSummary>> => run(() => mock.listCompensation(params, scope), signal),
  getEmployeeCompensation: (employeeId: string, scope: PayrollScope, signal?: Signal): Promise<EmployeeCompensationDetail> => run(() => mock.getCompensation(employeeId, scope), signal),
  /** Creates a new salary record (also used to assign a salary structure); history is never overwritten. */
  updateEmployeeCompensation: (employeeId: string, input: CompensationInput, scope: PayrollScope): Promise<EmployeeCompensationDetail> => run(() => mock.updateCompensation(employeeId, input, scope)),
  getSalaryHistory: (employeeId: string, scope: PayrollScope, signal?: Signal): Promise<CompensationRecord[]> => run(() => mock.salaryHistory(employeeId, scope), signal),

  /* Allowances */
  getAllowanceTypes: (params: ListParams<TypeFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<AllowanceType>> => run(() => mock.listAllowanceTypes(params, scope), signal),
  createAllowanceType: (input: AllowanceTypeInput, scope: PayrollScope): Promise<AllowanceType> => run(() => mock.createAllowanceType(input, scope)),
  updateAllowanceType: (id: string, input: AllowanceTypeInput, scope: PayrollScope): Promise<AllowanceType> => run(() => mock.updateAllowanceType(id, input, scope)),
  updateAllowanceTypeStatus: (id: string, status: RecordStatus, scope: PayrollScope): Promise<AllowanceType> => run(() => mock.updateAllowanceTypeStatus(id, status, scope)),
  assignEmployeeAllowance: (employeeId: string, input: AssignmentInput, scope: PayrollScope): Promise<EmployeeAllowance> => run(() => mock.assignAllowance(employeeId, input, scope)),
  getEmployeeAllowances: (employeeId: string, scope: PayrollScope, signal?: Signal): Promise<EmployeeAllowance[]> => run(() => mock.employeeAllowances(employeeId, scope), signal),

  /* Deductions */
  getDeductionTypes: (params: ListParams<TypeFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<DeductionType>> => run(() => mock.listDeductionTypes(params, scope), signal),
  createDeductionType: (input: DeductionTypeInput, scope: PayrollScope): Promise<DeductionType> => run(() => mock.createDeductionType(input, scope)),
  updateDeductionType: (id: string, input: DeductionTypeInput, scope: PayrollScope): Promise<DeductionType> => run(() => mock.updateDeductionType(id, input, scope)),
  updateDeductionTypeStatus: (id: string, status: RecordStatus, scope: PayrollScope): Promise<DeductionType> => run(() => mock.updateDeductionTypeStatus(id, status, scope)),
  assignEmployeeDeduction: (employeeId: string, input: AssignmentInput, scope: PayrollScope): Promise<EmployeeDeduction> => run(() => mock.assignDeduction(employeeId, input, scope)),
  getEmployeeDeductions: (employeeId: string, scope: PayrollScope, signal?: Signal): Promise<EmployeeDeduction[]> => run(() => mock.employeeDeductions(employeeId, scope), signal),
  /** Ends a recurring allowance or deduction assignment on `endDate`. */
  endEmployeeAssignment: (id: string, endDate: string, note: string, scope: PayrollScope): Promise<EmployeeAllowance | EmployeeDeduction> => run(() => mock.endAssignment(id, endDate, note, scope)),
  getPayrollPolicy: (scope: PayrollScope, signal?: Signal): Promise<PayrollPolicy> => run(() => mock.getPolicy(scope), signal),
  updatePayrollPolicy: (input: PolicyInput, scope: PayrollScope): Promise<PayrollPolicy> => run(() => mock.updatePolicy(input, scope)),

  /* Payroll runs */
  getPayrollSummary: (scope: PayrollScope, signal?: Signal): Promise<PayrollSummary> => run(() => mock.summary(scope), signal),
  getPayrollRuns: (params: ListParams<RunFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<RunSummary>> => run(() => mock.listRuns(params, scope), signal),
  getPayrollRunById: (id: string, scope: PayrollScope, signal?: Signal): Promise<PayrollRun> => run(() => mock.getRun(id, scope), signal),
  createPayrollRun: (input: RunInput, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.createRun(input, scope)),
  updatePayrollRun: (id: string, input: RunInput, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.updateRun(id, input, scope)),
  calculatePayrollRun: (id: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.calculateRun(id, scope)),
  validatePayrollRun: (id: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.validateRun(id, scope)),
  submitPayrollForApproval: (id: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.submitRun(id, scope)),
  approvePayrollRun: (id: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.approveRun(id, scope)),
  rejectPayrollRun: (id: string, reason: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.rejectRun(id, reason, scope)),
  /** SIMULATED: records the run as paid; no payment or bank transfer is made. */
  markPayrollAsPaid: (id: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.markRunPaid(id, scope)),
  cancelPayrollRun: (id: string, reason: string, scope: PayrollScope): Promise<PayrollRun> => run(() => mock.cancelRun(id, reason, scope)),
  getPayrollDetails: (runId: string, params: ListParams<LineFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<LineSummary>> => run(() => mock.runLines(runId, params, scope), signal),
  getPayrollLine: (runId: string, employeeId: string, scope: PayrollScope, signal?: Signal): Promise<PayrollLine & PayrollLineDetail> => run(() => mock.runLine(runId, employeeId, scope), signal),

  /* Payslips */
  getPayslips: (params: ListParams<PayslipFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<PayslipSummary>> => run(() => mock.listPayslips(params, scope), signal),
  getPayslipById: (id: string, scope: PayrollScope, signal?: Signal): Promise<Payslip> => run(() => mock.getPayslip(id, scope), signal),
  /** Issues payslips for an approved / paid run (all employees, or the listed ones). */
  generatePayslip: (runId: string, employeeIds: string[] | undefined, scope: PayrollScope): Promise<{ run: PayrollRun; generated: number }> => run(() => mock.generatePayslips(runId, employeeIds, scope)),

  /* Reports */
  getPayrollReports: (params: ListParams<PayrollReportFilters>, scope: PayrollScope, signal?: Signal): Promise<PayrollReport> => run(() => mock.report(params, scope), signal),
  exportPayrollReport: (filters: PayrollReportFilters, language: 'en' | 'ar', scope: PayrollScope): Promise<CsvExport> => run(() => mock.exportReport(filters, language, scope)),

  /* Employee self-service */
  getMyPayroll: (scope: PayrollScope, signal?: Signal): Promise<MyPayroll> => run(() => mock.myPayroll(scope), signal),
  getMyPayslips: (params: ListParams<PayslipFilters>, scope: PayrollScope, signal?: Signal): Promise<Paginated<PayslipSummary>> => run(() => mock.myPayslips(params, scope), signal),

  /* Lookups */
  getEmployeeOptions: (search: string, scope: PayrollScope, signal?: Signal): Promise<EmployeeOption[]> => run(() => mock.employeeOptions(search, scope), signal),
};
