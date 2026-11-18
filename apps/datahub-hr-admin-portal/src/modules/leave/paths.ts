import { navItem } from '@/core/routes/navigation';

/** URLs inside Leave (the base path comes from the navigation map). */
const base = navItem('leave').path;

export const leavePaths = {
  overview: base,
  requests: `${base}/requests`,
  request: (id: string) => `${base}/requests/${encodeURIComponent(id)}`,
  approvals: `${base}/approvals`,
  my: `${base}/my`,
  balances: `${base}/balances`,
  employeeBalances: (employeeId: string, year?: number) => `${base}/balances/${encodeURIComponent(employeeId)}${year ? `?year=${year}` : ''}`,
  calendar: `${base}/calendar`,
  reports: `${base}/reports`,
  types: `${base}/types`,
  type: (id: string) => `${base}/types/${encodeURIComponent(id)}`,
};

/**
 * Other modules' pages are linked through the navigation map (no import of those modules: Employee Management embeds
 * Leave, so Leave must not depend on it).
 */
export const externalPaths = {
  employee: (employeeId: string) => `${navItem('employees').path}/${encodeURIComponent(employeeId)}`,
  /** Documents directory searched by the request number (its attachment is registered there). */
  documentsFor: (requestNumber: string) => `${navItem('documents').path}/directory?search=${encodeURIComponent(requestNumber)}`,
  attendanceHistory: (employeeId: string, month: string) => `${navItem('attendance').path}/history/${encodeURIComponent(employeeId)}?month=${month}`,
};
