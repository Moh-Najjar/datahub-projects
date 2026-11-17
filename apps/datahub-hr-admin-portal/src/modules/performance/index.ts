/*
 * Public API of Performance Management for other modules. Employee Management embeds the profile's Performance tab
 * (lazy-loaded). Performance never imports Employee Management's UI, so the module graph stays acyclic.
 */
export { EmployeePerformanceTab } from './components/EmployeePerformanceTab';
export { performanceKeys } from './hooks/usePerformance';
export { performancePaths } from './paths';
