import type { FilterField, ReportCategory, ReportId } from '@/modules/reports/types/reports';
import { REPORT_IDS } from '@/modules/reports/types/reports';
import { attendanceReports } from './attendance';
import type { ReportDefinition } from './common';
import { documentReports } from './documents';
import { employeeReports } from './employees';
import { leaveReports } from './leave';
import { payrollReports } from './payroll';
import { performanceReports } from './performance';
import { recruitmentReports } from './recruitment';

/** Every catalogue report, by id. */
export const REPORTS: ReadonlyMap<ReportId, ReportDefinition> = new Map([...employeeReports, ...attendanceReports, ...leaveReports, ...recruitmentReports, ...performanceReports, ...payrollReports, ...documentReports].map((d) => [d.id, d]));

/** Report ids of a category, in catalogue order. */
export const reportsOf = (category: ReportCategory): ReportId[] => REPORT_IDS[category].map((id) => `${category}.${id}` as ReportId);

/** Filters shown for the insights and executive pages. */
export const INSIGHT_FILTERS: FilterField[] = ['dateRange', 'departmentId'];

export type { ReportDefinition };
