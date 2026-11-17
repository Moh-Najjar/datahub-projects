import type { Localized } from '@datahub/shared-types';
import type { AllowanceType, DeductionType, EmploymentType, SalaryStructure } from '@/modules/payroll/types/payroll';

/*
 * FICTIONAL payroll configuration for the demo. Every amount and percentage is an EXAMPLE, not a pay policy, a market
 * rate or a legal rate. The statutory deduction is illustrative and inactive: no tax or social-security calculation is
 * implemented until a verified legal policy is approved.
 */

export const CREATED = '2024-01-02T09:00:00.000Z';
/** Fictional company shown on payslips. */
export const COMPANY: Localized<string> = { en: 'DataHub HR Demo Company (fictional)', ar: 'شركة DataHub HR التجريبية (وهمية)' };
/** The organisation's payroll currency in the demo (every seeded salary is in it). */
export const BASE_CURRENCY = 'JOD' as const;

const ALL_TYPES: EmploymentType[] = ['full-time', 'contract', 'temporary'];

type StructureSeed = Omit<SalaryStructure, 'assignedEmployees'>;
const structure = (id: string, code: string, en: string, ar: string, jod: number, employmentTypes: EmploymentType[], extra: Partial<StructureSeed> = {}): StructureSeed => ({
  id,
  code,
  name: { en, ar },
  description: 'Example structure for the demo (not a pay policy).',
  basicSalary: jod * 1000,
  currency: BASE_CURRENCY,
  payFrequency: 'monthly',
  employmentTypes,
  status: 'active',
  createdAt: CREATED,
  ...extra,
});

/** One structure per position level, plus part-time and internship structures (JOD, monthly). */
export const STRUCTURE_SEED: readonly StructureSeed[] = [
  structure('sal-01', 'SAL-ENT', 'Entry level', 'المستوى المبتدئ', 550, ALL_TYPES),
  structure('sal-02', 'SAL-JUN', 'Junior level', 'المستوى الأول', 750, ALL_TYPES),
  structure('sal-03', 'SAL-MID', 'Mid level', 'المستوى المتوسط', 1150, ALL_TYPES),
  structure('sal-04', 'SAL-SEN', 'Senior level', 'المستوى الأول المتقدم', 1750, ALL_TYPES),
  structure('sal-05', 'SAL-LEAD', 'Team lead', 'قائد الفريق', 2300, ALL_TYPES),
  structure('sal-06', 'SAL-MGR', 'Manager', 'المدير', 2800, ALL_TYPES),
  structure('sal-07', 'SAL-DIR', 'Director', 'المدير التنفيذي للإدارة', 3850, ALL_TYPES),
  structure('sal-08', 'SAL-EXE', 'Executive', 'الإدارة العليا', 5100, ALL_TYPES),
  structure('sal-09', 'SAL-PT', 'Part-time', 'دوام جزئي', 600, ['part-time']),
  structure('sal-10', 'SAL-INT', 'Internship', 'التدريب', 350, ['intern']),
  structure('sal-11', 'SAL-USD-CON', 'Contractor (USD)', 'متعاقد (بالدولار)', 0, ['contract'], { basicSalary: 250_000, currency: 'USD', status: 'inactive', description: 'Example of a structure in another currency (inactive; no USD payroll runs in the demo).' }),
];

/** Structure per position level. */
export const STRUCTURE_BY_LEVEL: Readonly<Record<string, string>> = {
  entry: 'sal-01',
  junior: 'sal-02',
  mid: 'sal-03',
  senior: 'sal-04',
  lead: 'sal-05',
  manager: 'sal-06',
  director: 'sal-07',
  executive: 'sal-08',
};

/** Example monthly basic range (whole JOD) per structure, for the deterministic demo salaries. */
export const BASIC_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  'sal-01': [450, 650],
  'sal-02': [600, 900],
  'sal-03': [900, 1400],
  'sal-04': [1400, 2100],
  'sal-05': [1900, 2700],
  'sal-06': [2300, 3300],
  'sal-07': [3200, 4500],
  'sal-08': [4200, 6000],
  'sal-09': [400, 750],
  'sal-10': [300, 400],
};

type AllowanceSeed = Omit<AllowanceType, 'assignedEmployees'>;
const allowance = (id: string, code: string, en: string, ar: string, description: string, v: Pick<AllowanceType, 'calculation' | 'amount' | 'percentage' | 'recurrence' | 'taxable'>): AllowanceSeed => ({
  id,
  code,
  name: { en, ar },
  description,
  currency: BASE_CURRENCY,
  status: 'active',
  createdAt: CREATED,
  ...v,
});

export const ALLOWANCE_TYPE_SEED: readonly AllowanceSeed[] = [
  allowance('alw-01', 'HOUSING', 'Housing allowance', 'بدل السكن', 'Example: a percentage of the basic salary for senior roles.', { calculation: 'percentage', amount: null, percentage: 1000, recurrence: 'recurring', taxable: true }),
  allowance('alw-02', 'TRANSPORT', 'Transportation allowance', 'بدل المواصلات', 'Example: fixed monthly amount.', { calculation: 'fixed', amount: 40_000, percentage: null, recurrence: 'recurring', taxable: false }),
  allowance('alw-03', 'COMMS', 'Communication allowance', 'بدل الاتصالات', 'Example: fixed monthly amount for customer-facing roles.', { calculation: 'fixed', amount: 15_000, percentage: null, recurrence: 'recurring', taxable: false }),
  allowance('alw-04', 'MEAL', 'Meal allowance', 'بدل الوجبات', 'Example: fixed monthly amount for on-site operations.', { calculation: 'fixed', amount: 25_500, percentage: null, recurrence: 'recurring', taxable: false }),
  allowance('alw-05', 'OTHER-ALW', 'Other allowance', 'بدل آخر', 'Example: a one-time amount (e.g. a project completion payment).', { calculation: 'fixed', amount: 100_000, percentage: null, recurrence: 'one-time', taxable: true }),
];

type DeductionSeed = Omit<DeductionType, 'assignedEmployees'>;
const deduction = (id: string, code: string, en: string, ar: string, description: string, v: Pick<DeductionType, 'category' | 'calculation' | 'amount' | 'percentage' | 'recurrence' | 'maxAmount' | 'illustrative' | 'status'>): DeductionSeed => ({
  id,
  code,
  name: { en, ar },
  description,
  currency: BASE_CURRENCY,
  createdAt: CREATED,
  ...v,
});

export const DEDUCTION_TYPE_SEED: readonly DeductionSeed[] = [
  deduction('ded-01', 'UNPAID-LV', 'Unpaid leave deduction', 'خصم الإجازة بدون راتب', 'Approved unpaid leave days × daily rate (basic ÷ policy divisor). Pending, rejected and cancelled leave never count.', {
    category: 'unpaid-leave',
    calculation: 'daily-rate',
    amount: null,
    percentage: null,
    recurrence: 'recurring',
    maxAmount: null,
    illustrative: false,
    status: 'active',
  }),
  deduction('ded-02', 'ABSENCE', 'Absence deduction', 'خصم الغياب', 'Absent days without approved leave × daily rate. Disabled until an absence policy is explicitly approved and enabled.', {
    category: 'absence',
    calculation: 'daily-rate',
    amount: null,
    percentage: null,
    recurrence: 'recurring',
    maxAmount: null,
    illustrative: false,
    status: 'inactive',
  }),
  deduction('ded-03', 'ADVANCE', 'Salary advance repayment', 'استرداد سلفة على الراتب', 'Example: one-time repayment of an advance.', { category: 'advance', calculation: 'fixed', amount: 150_000, percentage: null, recurrence: 'one-time', maxAmount: null, illustrative: false, status: 'active' }),
  deduction('ded-04', 'LOAN', 'Loan repayment', 'سداد قرض', 'Example: monthly instalment of an employee loan.', { category: 'loan', calculation: 'fixed', amount: 60_000, percentage: null, recurrence: 'recurring', maxAmount: 200_000, illustrative: false, status: 'active' }),
  deduction('ded-05', 'STAT-EX', 'Statutory contribution (illustrative)', 'اقتطاع نظامي (توضيحي)', 'ILLUSTRATIVE ONLY: not a legal rate. Inactive until a verified legal policy is approved.', {
    category: 'statutory',
    calculation: 'percentage',
    amount: null,
    percentage: 500,
    recurrence: 'recurring',
    maxAmount: null,
    illustrative: true,
    status: 'inactive',
  }),
  deduction('ded-06', 'OTHER-DED', 'Other deduction', 'خصم آخر', 'Example: another one-time deduction.', { category: 'other', calculation: 'fixed', amount: 20_000, percentage: null, recurrence: 'one-time', maxAmount: null, illustrative: false, status: 'active' }),
];

export const REJECTION_REASON = 'Please confirm the loan instalments for two employees before resubmitting.';
export const CANCELLATION_REASON = 'Created twice by mistake; the department is covered by another run.';

/** Labels for CSV exports (the backend renders the file in the requested language). */
export const CSV_TEXT = {
  en: {
    runNumber: 'Run number',
    month: 'Period',
    department: 'Department',
    status: 'Status',
    employees: 'Employees',
    employee: 'Employee',
    employeeNumber: 'Employee number',
    periods: 'Periods',
    basic: 'Basic salary',
    allowances: 'Allowances',
    overtime: 'Overtime',
    gross: 'Gross salary',
    deductions: 'Deductions',
    net: 'Net salary',
    item: 'Item',
    code: 'Code',
    category: 'Category',
    amount: 'Amount',
    runs: 'Runs',
    paymentDate: 'Payment date',
    payslip: 'Payslip',
    all: 'All departments',
    currency: 'Currency',
  },
  ar: {
    runNumber: 'رقم مسير الرواتب',
    month: 'الفترة',
    department: 'القسم',
    status: 'الحالة',
    employees: 'الموظفون',
    employee: 'الموظف',
    employeeNumber: 'الرقم الوظيفي',
    periods: 'الفترات',
    basic: 'الراتب الأساسي',
    allowances: 'البدلات',
    overtime: 'العمل الإضافي',
    gross: 'إجمالي الراتب',
    deductions: 'الاقتطاعات',
    net: 'صافي الراتب',
    item: 'البند',
    code: 'الرمز',
    category: 'الفئة',
    amount: 'المبلغ',
    runs: 'المسيرات',
    paymentDate: 'تاريخ الدفع',
    payslip: 'قسيمة الراتب',
    all: 'جميع الأقسام',
    currency: 'العملة',
  },
} as const;

export const CSV_STATUS = {
  en: { draft: 'Draft', calculating: 'Calculating', calculated: 'Calculated', 'pending-approval': 'Pending approval', approved: 'Approved', rejected: 'Rejected', paid: 'Paid', cancelled: 'Cancelled' },
  ar: { draft: 'مسودة', calculating: 'قيد الاحتساب', calculated: 'محتسب', 'pending-approval': 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض', paid: 'مدفوع', cancelled: 'ملغى' },
} as const;

export const CSV_CATEGORY = {
  en: { 'unpaid-leave': 'Unpaid leave', absence: 'Absence', advance: 'Advance', loan: 'Loan', statutory: 'Statutory (illustrative)', other: 'Other', allowance: 'Allowance' },
  ar: { 'unpaid-leave': 'إجازة بدون راتب', absence: 'غياب', advance: 'سلفة', loan: 'قرض', statutory: 'نظامي (توضيحي)', other: 'أخرى', allowance: 'بدل' },
} as const;
