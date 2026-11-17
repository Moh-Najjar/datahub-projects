/*
 * Public API of Payroll Management for other modules (pure re-exports). Payroll reads employees, organization,
 * attendance and leave data through their backend accessors (mock layer) and links to employee profiles; no module
 * imports payroll, so salaries never leak into other screens.
 */
export { payrollKeys } from './hooks/usePayroll';
export { payrollPaths } from './paths';
