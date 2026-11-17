import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Payroll contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly these shapes.
 *
 * MONEY: every amount is an INTEGER in the currency's minor unit (`Minor`): JOD has 3 decimals (1 JOD = 1000 fils),
 * USD / SAR / AED have 2. Percentages are integer basis points (1 500 = 15.00 %). No floating-point arithmetic is ever
 * applied to amounts (see `utils/money.ts`). Dates are local `YYYY-MM-DD`; timestamps ISO.
 *
 * Employees, departments, positions and locations are referenced by id (Employee / Organization Management own them);
 * payroll keeps only compensation data, and SNAPSHOTS of the employee inside calculated payroll lines and payslips.
 */

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export const CURRENCIES = ['JOD', 'USD', 'SAR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Integer amount in the currency's minor unit. */
export type Minor = number;

/**
 * Only monthly payroll is supported: other frequencies need an approved policy for how a salary converts to a pay
 * period. The field exists so the contract does not change when one is approved.
 */
export const PAY_FREQUENCIES = ['monthly'] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

/** Mirror of Employee Management's contract (kept here so payroll's contract stands alone, like Recruitment's). */
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EmploymentStatus = 'active' | 'inactive';

export type RecordStatus = 'active' | 'inactive';
export type CalculationType = 'fixed' | 'percentage';
export type Recurrence = 'recurring' | 'one-time';

/* Salary structures ------------------------------------------------------------------------------------------ */

export interface SalaryStructure {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  /** Default monthly basic salary for employees assigned to the structure (each employee's compensation may differ). */
  basicSalary: Minor;
  currency: Currency;
  payFrequency: PayFrequency;
  /** Employment types the structure may be assigned to. */
  employmentTypes: EmploymentType[];
  status: RecordStatus;
  createdAt: string;
  /** Derived: employees whose compensation in force today uses the structure. */
  assignedEmployees: number;
}

export type SalaryStructureInput = Pick<SalaryStructure, 'code' | 'name' | 'description' | 'basicSalary' | 'currency' | 'payFrequency' | 'employmentTypes'>;

export interface StructureFilters {
  status: RecordStatus;
  currency: Currency;
}

export type StructureSortField = 'code' | 'name.en' | 'name.ar' | 'basicSalary' | 'status' | 'assignedEmployees';

/* Employee compensation ------------------------------------------------------------------------------------------ */

export const COMPENSATION_REASONS = ['hire', 'annual-review', 'promotion', 'adjustment', 'correction'] as const;
export type CompensationReason = (typeof COMPENSATION_REASONS)[number];

/** `current` = in force today; `scheduled` = starts in the future; `past` = superseded by a later record. */
export type RecordState = 'current' | 'scheduled' | 'past';

/**
 * One salary record. Records are IMMUTABLE: a change creates a new record from its effective date, and a record's end
 * is derived from the next record (never stored), so periods cannot overlap and history is never overwritten.
 */
export interface CompensationRecord {
  id: string;
  employeeId: string;
  structure: NamedRef & { code: string };
  basicSalary: Minor;
  currency: Currency;
  payFrequency: PayFrequency;
  effectiveFrom: string;
  /** Derived: the day before the next record starts (`null` = open-ended). */
  effectiveTo: string | null;
  reason: CompensationReason;
  note: string;
  createdAt: string;
  createdBy: Localized<string>;
  state: RecordState;
}

export interface CompensationInput {
  structureId: string;
  basicSalary: Minor;
  effectiveFrom: string;
  reason: CompensationReason;
  note: string;
}

export interface EmployeeSnapshot {
  name: Localized<string>;
  employeeNumber: string;
  department: NamedRef;
  position: NamedRef;
  location: NamedRef;
}

/** `active` = a record is in force today; `scheduled` = only a future record; `missing` = none. */
export type CompensationStatus = 'active' | 'scheduled' | 'missing';

/** A row of the compensation list. Salaries are returned ONLY by payroll endpoints (never by employee listings). */
export interface EmployeeCompensationSummary {
  employeeId: string;
  employee: EmployeeSnapshot & { employmentType: EmploymentType; status: EmploymentStatus; hireDate: string };
  current: Pick<CompensationRecord, 'id' | 'structure' | 'basicSalary' | 'currency' | 'payFrequency' | 'effectiveFrom'> | null;
  status: CompensationStatus;
}

export interface CompensationFilters {
  departmentId: string;
  locationId: string;
  employmentStatus: EmploymentStatus;
  status: CompensationStatus;
  structureId: string;
}

export type CompensationSortField = 'employee.name.en' | 'employee.name.ar' | 'employee.employeeNumber' | 'basicSalary' | 'effectiveFrom' | 'status';

export interface EmployeeCompensationDetail extends EmployeeCompensationSummary {
  history: CompensationRecord[];
  allowances: EmployeeAllowance[];
  deductions: EmployeeDeduction[];
  /** What the caller may do (computed by the backend). */
  can: { update: boolean };
}

/* Allowances and deductions --------------------------------------------------------------------------------------- */

export interface AllowanceType {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  calculation: CalculationType;
  /** Fixed amount (minor units of `currency`) — `null` for percentage types. */
  amount: Minor | null;
  /** Basis points of the basic salary — `null` for fixed types. */
  percentage: number | null;
  /** Currency of a fixed amount (it applies only to employees paid in that currency). */
  currency: Currency;
  recurrence: Recurrence;
  /** Configuration only: no tax is calculated anywhere (no approved tax policy exists). */
  taxable: boolean;
  status: RecordStatus;
  createdAt: string;
  /** Derived: employees with an assignment in force today. */
  assignedEmployees: number;
}

export type AllowanceTypeInput = Pick<AllowanceType, 'code' | 'name' | 'description' | 'calculation' | 'amount' | 'percentage' | 'currency' | 'recurrence' | 'taxable'>;

export const DEDUCTION_CATEGORIES = ['unpaid-leave', 'absence', 'advance', 'loan', 'statutory', 'other'] as const;
export type DeductionCategory = (typeof DEDUCTION_CATEGORIES)[number];
/** Calculated by the system from approved leave / attendance (daily rate), never assigned by hand. */
export const SYSTEM_DEDUCTION_CATEGORIES: readonly DeductionCategory[] = ['unpaid-leave', 'absence'];

export type DeductionCalculation = CalculationType | 'daily-rate';

export interface DeductionType {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  category: DeductionCategory;
  calculation: DeductionCalculation;
  amount: Minor | null;
  percentage: number | null;
  currency: Currency;
  recurrence: Recurrence;
  /** Optional cap per pay period (minor units of `currency`). */
  maxAmount: Minor | null;
  /** Statutory deductions are ILLUSTRATIVE until a verified legal policy is approved (always true for `statutory`). */
  illustrative: boolean;
  status: RecordStatus;
  createdAt: string;
  assignedEmployees: number;
}

export type DeductionTypeInput = Pick<DeductionType, 'code' | 'name' | 'description' | 'category' | 'calculation' | 'amount' | 'percentage' | 'currency' | 'recurrence' | 'maxAmount'>;

export interface TypeFilters {
  status: RecordStatus;
}

export type TypeSortField = 'code' | 'name.en' | 'name.ar' | 'status' | 'assignedEmployees';

/** `current` = in force today; `scheduled` = starts later; `ended` = finished (or a one-time item already past). */
export type AssignmentState = 'current' | 'scheduled' | 'ended';

export interface AssignmentEvent {
  at: string;
  by: Localized<string>;
  action: 'assigned' | 'ended';
  note: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  calculation: CalculationType;
  amount: Minor | null;
  percentage: number | null;
  currency: Currency;
  recurrence: Recurrence;
  /** One-time items apply only to the pay period containing `effectiveFrom`. */
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string;
  createdAt: string;
  state: AssignmentState;
  history: AssignmentEvent[];
}

export interface EmployeeAllowance extends Assignment {
  type: NamedRef & { code: string; taxable: boolean };
}

export interface EmployeeDeduction extends Assignment {
  type: NamedRef & { code: string; category: DeductionCategory; maxAmount: Minor | null; illustrative: boolean };
}

/** Assign an allowance / deduction type to an employee. Amount and percentage default to the type's values. */
export interface AssignmentInput {
  typeId: string;
  amount: Minor | null;
  percentage: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string;
}

/* Calculation policy ---------------------------------------------------------------------------------------------- */

/**
 * The calculation rules in force. Only the daily-rate divisor is editable (approved default: 30); the rest is fixed in
 * this version and shown so every figure can be explained. Deductions are ILLUSTRATIVE, not legal advice.
 */
export interface PayrollPolicy {
  /** Daily rate = monthly basic ÷ divisor (unpaid leave and, when enabled, absence deductions). */
  dailyRateDivisor: number;
  /** Each line is rounded ONCE, half-up (away from zero), to the currency's minor unit; totals add rounded lines. */
  rounding: 'half-up-per-line';
  /** Partial periods (hire, leaving, salary change inside the period): basic × days covered ÷ calendar days of the period. */
  proration: 'calendar-days';
  /** A negative net salary is an error that blocks submission (no approved policy allows it). */
  allowNegativeNet: false;
  /** Attendance has no overtime field: overtime pay is always 0 (time beyond the shift is shown for reference only). */
  overtime: 'not-supported';
  updatedAt: string;
  updatedBy: Localized<string>;
}

export interface PolicyInput {
  dailyRateDivisor: number;
}

/* Payroll runs ---------------------------------------------------------------------------------------------------- */

export const RUN_STATUSES = ['draft', 'calculating', 'calculated', 'pending-approval', 'approved', 'rejected', 'paid', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export interface RunEvent {
  at: string;
  by: Localized<string>;
  from: RunStatus | null;
  to: RunStatus;
  /** e.g. `created`, `recalculated`, `validated`, `edited`, `payslips` — plus the transition itself. */
  action: string;
  note: string;
}

export interface RunTotals {
  employees: number;
  basic: Minor;
  allowances: Minor;
  overtime: Minor;
  gross: Minor;
  deductions: Minor;
  net: Minor;
}

export type IssueSeverity = 'error' | 'warning';

export interface RunIssue {
  severity: IssueSeverity;
  /** Translation key under `issues.*`. */
  code: string;
  employeeId: string | null;
  employee: { name: Localized<string>; employeeNumber: string } | null;
}

export interface PayrollRun {
  id: string;
  /** e.g. PR-2026-0014 */
  number: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  payFrequency: PayFrequency;
  /** Top-level department the run covers; `null` = every department. */
  department: NamedRef | null;
  currency: Currency;
  status: RunStatus;
  createdAt: string;
  createdBy: { userId: string; name: Localized<string> };
  calculatedAt: string | null;
  validatedAt: string | null;
  /** Issues found by the last calculation / validation. */
  issues: RunIssue[];
  totals: RunTotals | null;
  submittedAt: string | null;
  submittedBy: Localized<string> | null;
  approvedAt: string | null;
  approvedBy: Localized<string> | null;
  rejectedAt: string | null;
  rejectedBy: Localized<string> | null;
  rejectionReason: string | null;
  paidAt: string | null;
  paidBy: Localized<string> | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** The policy the calculation used (snapshot). */
  policy: Pick<PayrollPolicy, 'dailyRateDivisor' | 'rounding' | 'proration'> | null;
  payslipsGenerated: number;
  history: RunEvent[];
  /** What the caller may do now (computed by the backend from the rules and the caller's permissions). */
  can: { edit: boolean; calculate: boolean; validate: boolean; submit: boolean; approve: boolean; reject: boolean; markPaid: boolean; cancel: boolean; generatePayslips: boolean };
  /** Why approval is not possible for this caller, when it otherwise would be (`ownRun`: creators never approve their own run). */
  approvalBlockedReason: 'ownRun' | null;
}

export type RunSummary = Omit<PayrollRun, 'history' | 'issues'> & { errorCount: number; warningCount: number };

export interface RunFilters {
  status: RunStatus;
  departmentId: string;
  /** Runs whose period overlaps the month `YYYY-MM`. */
  month: string;
}

export type RunSortField = 'number' | 'periodStart' | 'paymentDate' | 'status' | 'totals.net';

export interface RunInput {
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  payFrequency: PayFrequency;
  /** Top-level department, or `null` for all. */
  departmentId: string | null;
  currency: Currency;
}

/* Payroll lines (employee-level results: immutable snapshots) ---------------------------------------------------- */

export type LineStatus = 'ok' | 'warning' | 'error';

export type ItemBasis =
  | { method: 'prorated'; base: Minor; days: number; periodDays: number }
  | { method: 'fixed'; base: Minor }
  | { method: 'percentage'; base: Minor; percentage: number }
  | { method: 'daily-rate'; base: Minor; days: number; divisor: number };

export interface LineItem {
  code: string;
  name: Localized<string>;
  kind: 'basic' | 'allowance' | 'overtime' | 'deduction';
  category: DeductionCategory | null;
  amount: Minor;
  /** How the amount was obtained (after which the per-period cap, if any, was applied). */
  basis: ItemBasis[];
  capped: boolean;
  illustrative: boolean;
  /** Source records: compensation, assignment, leave request or attendance dates. */
  sources: string[];
}

export interface CalculationInputs {
  period: { start: string; end: string; days: number };
  employment: { hireDate: string; lastDay: string | null; from: string; to: string; days: number };
  compensation: Array<{ recordId: string; structureCode: string; basicSalary: Minor; from: string; to: string; days: number }>;
  attendance: {
    dataFrom: string | null;
    dataTo: string | null;
    scheduledDays: number;
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    incomplete: number;
    onLeave: number;
    lateMinutes: number;
    workedMinutes: number;
    /** Reference only: never paid (no overtime policy). */
    minutesBeyondShift: number;
    absentDates: string[];
  };
  leave: Array<{ requestId: string; number: string; typeCode: string; typeName: Localized<string>; paid: boolean; dates: string[] }>;
  /** Approved unpaid leave days deducted (each date once, even if two requests covered it). */
  unpaidLeaveDays: number;
  /** Absence days deducted (0 unless an absence deduction type is active). */
  absenceDays: number;
  policy: { dailyRateDivisor: number };
}

export interface PayrollLine {
  runId: string;
  employeeId: string;
  employee: EmployeeSnapshot;
  /** Top-level department at calculation (reports group by it). */
  topDepartment: NamedRef;
  currency: Currency;
  basic: Minor;
  allowances: Minor;
  overtime: Minor;
  gross: Minor;
  deductions: Minor;
  net: Minor;
  status: LineStatus;
  issues: string[];
  earnings: LineItem[];
  deductionItems: LineItem[];
  inputs: CalculationInputs;
  payslipId: string | null;
}

export type LineSummary = Omit<PayrollLine, 'earnings' | 'deductionItems' | 'inputs'>;

export interface LineFilters {
  status: LineStatus;
  departmentId: string;
}

export type LineSortField = 'employee.name.en' | 'employee.name.ar' | 'employee.employeeNumber' | 'gross' | 'deductions' | 'net' | 'status';

/* Payslips ------------------------------------------------------------------------------------------------------- */

export interface Payslip {
  id: string;
  /** e.g. PS-2026-10-EMP-0006 */
  number: string;
  runId: string;
  runNumber: string;
  employeeId: string;
  employee: EmployeeSnapshot;
  company: Localized<string>;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  currency: Currency;
  basic: Minor;
  allowances: Minor;
  overtime: Minor;
  gross: Minor;
  deductions: Minor;
  net: Minor;
  earnings: LineItem[];
  deductionItems: LineItem[];
  generatedAt: string;
  generatedBy: Localized<string>;
  /** Derived from the run: `paid` once the (simulated) payment is recorded. */
  paymentStatus: 'approved' | 'paid';
}

export type PayslipSummary = Omit<Payslip, 'earnings' | 'deductionItems' | 'company'>;

export interface PayslipFilters {
  /** `YYYY-MM` of the period start. */
  month: string;
  departmentId: string;
  runId: string;
}

export type PayslipSortField = 'number' | 'employee.name.en' | 'employee.name.ar' | 'periodStart' | 'net';

/* Overview -------------------------------------------------------------------------------------------------------- */

export interface ActivityEntry extends RunEvent {
  runId: string;
  runNumber: string;
}

export interface PayrollSummary {
  /** Every figure is in this currency (no exchange-rate policy exists, so currencies are never mixed). */
  currency: Currency;
  /** Employees with compensation in force today (in this currency). */
  totalEmployees: number;
  /** The latest period whose runs are approved or paid ("last payroll"). */
  latest: { month: string; runs: number; employees: number; gross: Minor; deductions: Minor; net: Minor } | null;
  /** Runs not finished yet: draft, calculated or rejected. */
  pendingRuns: number;
  awaitingApproval: number;
  /** The month containing today and its runs. */
  currentPeriod: { month: string; start: string; end: string; runs: Array<{ id: string; number: string; status: RunStatus; department: NamedRef | null }> };
  /** Approved and paid runs per month (last 12 months), oldest first. */
  monthly: Array<{ month: string; basic: Minor; allowances: Minor; overtime: Minor; gross: Minor; deductions: Minor; net: Minor; employees: number }>;
  /** Gross cost of the latest approved/paid period per top-level department. */
  byDepartment: Array<{ department: NamedRef; gross: Minor; net: Minor; employees: number }>;
  /** Basic salaries in force today, by range (`max` exclusive; `null` = and above). */
  salaryRanges: Array<{ min: Minor; max: Minor | null; employees: number }>;
  recentActivity: ActivityEntry[];
}

/* Reports --------------------------------------------------------------------------------------------------------- */

export const PAYROLL_REPORT_TYPES = ['summary', 'department', 'employee', 'allowances', 'deductions', 'monthly', 'history'] as const;
export type PayrollReportType = (typeof PAYROLL_REPORT_TYPES)[number];

export interface PayrollReportFilters {
  type: PayrollReportType;
  /** First and last month (`YYYY-MM`) of the payroll periods included. */
  fromMonth: string;
  toMonth: string;
  departmentId: string;
  locationId: string;
  employeeId: string;
}

export type ReportCell = string | number | Localized<string> | null;
export type ReportColumnKind = 'text' | 'localized' | 'money' | 'number' | 'date' | 'month' | 'status' | 'code';

export interface PayrollReport {
  filters: PayrollReportFilters;
  currency: Currency;
  columns: Array<{ key: string; kind: ReportColumnKind }>;
  rows: Array<Record<string, ReportCell>>;
  /** Sums of the money / number columns over ALL rows (not just the page). */
  totals: Record<string, number>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CsvExport {
  fileName: string;
  /** UTF-8 CSV text (with BOM so spreadsheet apps show Arabic correctly), formula-like cells neutralised. */
  content: string;
  rows: number;
}

/* Self-service ---------------------------------------------------------------------------------------------------- */

export interface MyPayroll {
  employee: { id: string; name: Localized<string>; employeeNumber: string; department: NamedRef; position: NamedRef };
  current: CompensationRecord | null;
  allowances: EmployeeAllowance[];
  deductions: EmployeeDeduction[];
  /** One entry per payslip (approved / paid runs only), newest first. */
  history: Array<Pick<PayslipSummary, 'id' | 'number' | 'periodStart' | 'periodEnd' | 'paymentDate' | 'currency' | 'gross' | 'deductions' | 'net' | 'paymentStatus'>>;
}

/* Lookups / scope ------------------------------------------------------------------------------------------------- */

export interface EmployeeOption {
  id: string;
  name: Localized<string>;
  employeeNumber: string;
  department: NamedRef;
}

/**
 * Who is asking: `organization` (payroll:read) or `own` (payroll:read:own), plus the role for the action rules
 * (payroll:write, payroll:approve). The real backend derives all of it from the signed-in user's token.
 */
export interface PayrollScope {
  kind: 'organization' | 'own';
  userId: string;
  role: Role;
}
