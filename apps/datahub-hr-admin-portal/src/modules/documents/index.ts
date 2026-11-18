/*
 * Public API of Documents Management for other modules (pure re-exports). Employee Management (profile tab), Recruitment
 * (candidate profile) and Payroll (compensation page) show documents through these components, loaded lazily. Documents
 * never imports those modules' UI: it reads their data through the simulated backend accessors only, so the module graph
 * stays acyclic.
 */
export { EmployeeDocumentsTab, CandidateDocumentsPanel, PayrollDocumentsPanel } from './components/integration/OwnerPanels';
export { documentKeys } from './hooks/useDocuments';
export { documentPaths } from './paths';
