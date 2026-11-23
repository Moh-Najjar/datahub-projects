/*
 * Public API of Employee Management for other modules (pure re-exports). Attendance uses it to search and show
 * employees — employee data is never duplicated elsewhere.
 */
export { useEmployees } from './hooks/useEmployees';
export { employeePaths } from './paths';
export { displayName } from './utils/names';
export { EmployeeAvatar } from './components/EmployeeAvatar';
/** The employee form, reusable for another module's controlled create flow (Recruitment: hired candidate → employee). */
export { EmployeeForm, type ExternalCreate } from './components/form/EmployeeForm';
export { employeeKeys } from './hooks/useEmployees';
export type { EmployeeInput, EmployeeSummary, PersonName } from './types/employee';
/** For Reports & Analytics: the module's own API service and contracts (the API enforces scope and personal-data rules). */
export { employeesApi } from './api/employeesApi';
export type { Employee, EmployeeScope, EmploymentHistoryEntry, EmploymentStatus, EmploymentType } from './types/employee';
