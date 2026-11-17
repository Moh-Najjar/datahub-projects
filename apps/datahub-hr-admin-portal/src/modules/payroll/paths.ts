import { navItem } from '@/core/routes/navigation';

/** URLs inside Payroll (the base path comes from the navigation map). */
const base = navItem('payroll').path;
const id = (value: string) => encodeURIComponent(value);

export const payrollPaths = {
  overview: base,
  runs: `${base}/runs`,
  run: (runId: string) => `${base}/runs/${id(runId)}`,
  line: (runId: string, employeeId: string) => `${base}/runs/${id(runId)}/employees/${id(employeeId)}`,
  compensation: `${base}/compensation`,
  employee: (employeeId: string) => `${base}/compensation/${id(employeeId)}`,
  structures: `${base}/structures`,
  allowances: `${base}/allowances`,
  deductions: `${base}/deductions`,
  payslips: `${base}/payslips`,
  payslip: (payslipId: string) => `${base}/payslips/${id(payslipId)}`,
  reports: `${base}/reports`,
  my: `${base}/my`,
};
