import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Reports & Analytics contracts — a DRAFT of what a future reporting backend should return. Reports never keep data
 * of their own: every figure is computed on request from the source modules' APIs (Employees, Attendance, Leave,
 * Recruitment, Performance, Payroll, Documents), in the caller's scope. Dates are `YYYY-MM-DD`, months `YYYY-MM`.
 */

export const REPORT_CATEGORIES = ['employees', 'attendance', 'leave', 'recruitment', 'performance', 'payroll', 'documents'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Pages of the module (tabs). */
export const REPORT_TABS = ['overview', ...REPORT_CATEGORIES, 'insights', 'executive', 'builder', 'saved'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYEE_STATUSES = ['active', 'inactive'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Every filter a report may use; each report declares the ones that apply to it (others are ignored). */
export interface ReportFilters {
  from: string;
  to: string;
  departmentId: string;
  locationId: string;
  employmentType: EmploymentType | '';
  employeeStatus: EmployeeStatus | '';
}
export const FILTER_KEYS = ['from', 'to', 'departmentId', 'locationId', 'employmentType', 'employeeStatus'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
/** The date range is one filter in the UI (`from` + `to`). */
export type FilterField = 'dateRange' | 'departmentId' | 'locationId' | 'employmentType' | 'employeeStatus';

/** How a value is shown and exported. */
export type ValueKind = 'text' | 'code' | 'number' | 'decimal' | 'percent' | 'money' | 'date' | 'month' | 'localized' | 'enum' | 'rating' | 'hours';

/** Enumerations translated by the UI (`reports:enums.<name>.<value>`). */
export type EnumName =
  | 'employmentType'
  | 'employeeStatus'
  | 'attendanceStatus'
  | 'leaveStatus'
  | 'paidType'
  | 'candidateStage'
  | 'candidateSource'
  | 'funnelStep'
  | 'offerStatus'
  | 'interviewType'
  | 'requisitionStatus'
  | 'reviewState'
  | 'cycleStatus'
  | 'goalStatus'
  | 'planStatus'
  | 'runStatus'
  | 'payrollItemCategory'
  | 'documentStatus'
  | 'complianceStatus'
  | 'probationStatus'
  | 'demographic'
  | 'gender'
  | 'ageBand'
  | 'conversionState'
  | 'recommendation'
  | 'restricted';

/** `null` = not available (unknown, hidden or not computable) — never shown as zero. */
export type ReportValue = string | number | Localized<string> | null;
export type ReportRow = Record<string, ReportValue>;

export interface ReportColumn {
  key: string;
  kind: ValueKind;
  enum?: EnumName;
}

export interface SummaryItem {
  key: string;
  kind: ValueKind;
  value: ReportValue;
}

export interface ChartSpec {
  type: 'bar' | 'stacked' | 'hbar' | 'line' | 'pie';
  /** Unit of the drawn values (money in minor units, percentages as ratios 0–1). */
  valueKind: 'number' | 'percent' | 'money' | 'rating' | 'hours';
  categoryKind: ValueKind;
  categoryEnum?: EnumName;
  categories: ReportValue[];
  /** `key` names the series (`reports:series.<key>`); `null` values are gaps (no data), not zero. */
  series: Array<{ key: string; values: Array<number | null> }>;
}

/** A translated note: `reports:basis.<key>` / `reports:limitations.<key>` with interpolation values. */
export interface ReportNote {
  key: string;
  params?: Record<string, string | number>;
}

export interface ReportData {
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: SummaryItem[];
  chart: ChartSpec | null;
  /** How the figures were obtained (status basis, formula, period). */
  basis: ReportNote[];
  /** What the data cannot show (missing source data, clamped ranges, hidden records…). */
  limitations: ReportNote[];
  /** Money columns are in this currency (never mixed); `null` when the report has no money. */
  currency: 'JOD' | null;
  /** Shown when the data is insufficient for a meaningful result (insights). */
  insufficient?: boolean;
}

export interface ReportResult extends ReportData {
  id: ReportId;
  category: ReportCategory | 'insights' | 'executive';
  /** The filters the report actually applied (only those relevant to it). */
  filters: Partial<ReportFilters>;
  generatedAt: string;
}

/* Report catalogue ---------------------------------------------------------------------------------------------- */

export const REPORT_IDS = {
  employees: ['directory', 'by-department', 'by-location', 'by-type', 'by-status', 'new-hires', 'turnover', 'headcount-trend', 'probation', 'demographics'],
  attendance: ['daily', 'monthly', 'by-department', 'by-employee', 'late', 'absence', 'working-hours', 'trends', 'shifts'],
  leave: ['requests', 'by-type', 'by-department', 'by-employee', 'balances', 'utilization', 'pending', 'on-leave', 'monthly', 'paid-unpaid'],
  recruitment: ['pipeline', 'by-stage', 'by-source', 'open-positions', 'hiring-by-department', 'interviews', 'offers', 'time-to-hire', 'conversion', 'candidate-to-employee'],
  performance: ['distribution', 'by-department', 'completion', 'goals-progress', 'goals-by-status', 'history', 'development', 'cycles'],
  payroll: ['summary', 'by-department', 'by-employee', 'gross', 'net', 'allowances', 'deductions', 'monthly', 'history', 'run-status'],
  documents: ['by-category', 'by-department', 'expired', 'expiring', 'pending', 'verified', 'missing', 'compliance-by-department', 'completeness'],
} as const;
type IdsOf<C extends ReportCategory> = `${C}.${(typeof REPORT_IDS)[C][number]}`;
export type ReportId = { [C in ReportCategory]: IdsOf<C> }[ReportCategory] | 'insights.departments' | 'executive.dashboard';

/* Overview ------------------------------------------------------------------------------------------------------ */

export const OVERVIEW_KPIS = ['totalEmployees', 'activeEmployees', 'attendanceRate', 'pendingLeave', 'openPositions', 'averageRating', 'payrollCost', 'documentCompliance'] as const;
export type OverviewKpiKey = (typeof OVERVIEW_KPIS)[number] | 'newHires' | 'turnoverRate';

/**
 * One figure: `available` (value may be 0), `restricted` (not in the caller's permissions), `no-data` (nothing to
 * compute from, e.g. no completed reviews) or `error` (the source module did not answer).
 */
export type Availability = 'available' | 'restricted' | 'no-data' | 'error';

export interface OverviewKpi {
  key: OverviewKpiKey;
  kind: ValueKind;
  value: number | null;
  status: Availability;
  /** Basis shown under the figure (`reports:overview.basis.<key>`), e.g. the payroll month. */
  basis: ReportNote | null;
}

export const OVERVIEW_CHARTS = ['headcount', 'attendance', 'leave', 'recruitment', 'performance', 'payroll', 'documents'] as const;
export type OverviewChartKey = (typeof OVERVIEW_CHARTS)[number];

export interface OverviewChart {
  key: OverviewChartKey;
  status: Availability;
  chart: ChartSpec | null;
}

export interface ReportsOverview {
  filters: ReportFilters;
  kpis: OverviewKpi[];
  charts: OverviewChart[];
  currency: 'JOD';
  generatedAt: string;
}

/* Executive dashboard -------------------------------------------------------------------------------------------- */

export interface ExecutiveDashboard {
  filters: Pick<ReportFilters, 'from' | 'to' | 'departmentId'>;
  kpis: OverviewKpi[];
  /** Organisation-level aggregates only (no individual salary, medical, identity or private performance data). */
  charts: OverviewChart[];
  departments: ReportData;
  currency: 'JOD';
  generatedAt: string;
}

/* Report builder ----------------------------------------------------------------------------------------------- */

/** Datasets the builder starts from — each is an existing report's rows (no free-form queries). */
export const BUILDER_DATASETS = ['employees.directory', 'attendance.by-employee', 'leave.requests', 'leave.balances', 'recruitment.time-to-hire', 'performance.history', 'payroll.by-employee', 'documents.completeness'] as const;
export type BuilderDataset = (typeof BUILDER_DATASETS)[number];

export interface BuilderConfig {
  dataset: BuilderDataset;
  /** Columns of the dataset to show (only those the caller may see are accepted). */
  fields: string[];
  /** Group rows by one text/enum/localized field: one row per group with counts and sums. */
  groupBy: string | null;
  sortBy: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ReportFilters;
}

/* Saved reports -------------------------------------------------------------------------------------------------- */

/** A saved CONFIGURATION (never results): owned by the user who saved it and visible only to them. */
export interface SavedReport {
  id: string;
  name: string;
  /** A catalogue report with its filters, or a builder configuration. */
  kind: 'report' | 'custom';
  reportId: ReportId | null;
  filters: ReportFilters;
  builder: BuilderConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedReportInput {
  name: string;
  kind: 'report' | 'custom';
  reportId: ReportId | null;
  filters: ReportFilters;
  builder: BuilderConfig | null;
}

/* Export --------------------------------------------------------------------------------------------------------- */

export interface CsvExport {
  fileName: string;
  /** UTF-8 CSV (BOM), localized headings, formula-like text neutralised, identifiers kept as text. */
  content: string;
  rows: number;
}

/* Caller ------------------------------------------------------------------------------------------------------- */

/**
 * Who is asking. The real backend derives this from the token; the mock receives it because it has no token, and
 * derives every permission and scope from the ROLE (never from flags sent by the client).
 */
export interface ReportsCaller {
  userId: string;
  role: Role;
}

/** Saved report names: 1–80 characters, unique per owner (case-insensitive); at most 50 per user. */
export const SAVED_NAME_MAX = 80;
export const SAVED_LIMIT = 50;
