import { EmployeePerformance } from './EmployeePerformance';

/**
 * "Performance" tab of the Employee Profile (Employee Management): review history, goals and development plans of that
 * employee through the Performance API — its scope rules apply (HR: everyone; managers: their team).
 */
export function EmployeePerformanceTab({ employeeId }: { employeeId: string }) {
  return <EmployeePerformance employeeId={employeeId} embedded />;
}
