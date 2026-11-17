import { navItem } from '@/core/routes/navigation';

/** URLs inside Attendance (the base path comes from the navigation map). */
const base = navItem('attendance').path;

export const attendancePaths = {
  overview: base,
  records: `${base}/records`,
  record: (id: string) => `${base}/records/${encodeURIComponent(id)}`,
  shifts: `${base}/shifts`,
  shift: (id: string) => `${base}/shifts/${encodeURIComponent(id)}`,
  history: `${base}/history`,
  employeeHistory: (employeeId: string, month?: string) => `${base}/history/${encodeURIComponent(employeeId)}${month ? `?month=${month}` : ''}`,
  reports: `${base}/reports`,
};
