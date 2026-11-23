/*
 * Public API of Payroll Management for other modules (pure re-exports). Payroll reads employees, organization,
 * attendance and leave data through their backend accessors (mock layer) and links to employee profiles; no module
 * imports payroll, so salaries never leak into other screens.
 */
export { payrollKeys } from './hooks/usePayroll';
export { payrollPaths } from './paths';
/** For Reports & Analytics: the module's own API service, contracts and exact money formatting (integer minor units). */
export { payrollApi } from './api/payrollApi';
export { formatAmount } from './utils/format';
export { toDecimalString } from './utils/money';
export type { Currency, Minor, PayrollReport, PayrollReportFilters, PayrollScope, PayrollSummary, RunSummary } from './types/payroll';
