import type { LeaveType, PublicHoliday } from '@/modules/leave/types/leave';

/*
 * FICTIONAL leave configuration for the simulated backend. The allocations and rules are EXAMPLES for the demo — they
 * are configurable and do not represent any company's official leave policy. Read only by the leave mock files.
 */

const created = '2019-02-03T09:00:00.000Z';
const type = (t: Omit<LeaveType, 'status' | 'createdAt'> & Partial<Pick<LeaveType, 'status'>>): LeaveType => ({ status: 'active', createdAt: created, ...t });

export const LEAVE_TYPE_SEED: readonly LeaveType[] = [
  type({ id: 'lt-01', code: 'ANNUAL', name: { en: 'Annual Leave', ar: 'الإجازة السنوية' }, description: 'Paid time off for rest and personal matters.', paid: true, annualAllocation: 14, seniorityYears: 5, seniorityExtraDays: 7, prorateFirstYear: true, maxConsecutiveDays: 21, requiresApproval: true, requiresDocument: false, eligibility: 'all', excludesPublicHolidays: true }),
  type({ id: 'lt-02', code: 'SICK', name: { en: 'Sick Leave', ar: 'الإجازة المرضية' }, description: 'Paid leave when unable to work due to illness; a medical note is required.', paid: true, annualAllocation: 14, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 14, requiresApproval: true, requiresDocument: true, eligibility: 'all', excludesPublicHolidays: true }),
  type({ id: 'lt-03', code: 'UNPAID', name: { en: 'Unpaid Leave', ar: 'إجازة بدون راتب' }, description: 'Leave without pay; no annual allocation.', paid: false, annualAllocation: null, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 30, requiresApproval: true, requiresDocument: false, eligibility: 'all', excludesPublicHolidays: false }),
  type({ id: 'lt-04', code: 'MATERN', name: { en: 'Maternity Leave', ar: 'إجازة الأمومة' }, description: 'Paid leave around childbirth.', paid: true, annualAllocation: 70, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 70, requiresApproval: true, requiresDocument: true, eligibility: 'female', excludesPublicHolidays: false }),
  type({ id: 'lt-05', code: 'PATERN', name: { en: 'Paternity Leave', ar: 'إجازة الأبوة' }, description: 'Paid leave after the birth of a child.', paid: true, annualAllocation: 3, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 3, requiresApproval: true, requiresDocument: false, eligibility: 'male', excludesPublicHolidays: false }),
  type({ id: 'lt-06', code: 'BEREAV', name: { en: 'Bereavement Leave', ar: 'إجازة الوفاة' }, description: 'Paid leave after the death of a close relative; approved automatically.', paid: true, annualAllocation: 3, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 3, requiresApproval: false, requiresDocument: false, eligibility: 'all', excludesPublicHolidays: false }),
  type({ id: 'lt-07', code: 'EMERG', name: { en: 'Emergency Leave', ar: 'إجازة طارئة' }, description: 'Short paid leave for urgent personal situations.', paid: true, annualAllocation: 3, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 2, requiresApproval: true, requiresDocument: false, eligibility: 'all', excludesPublicHolidays: true }),
  type({ id: 'lt-08', code: 'OTHER', name: { en: 'Other Leave', ar: 'إجازة أخرى' }, description: 'Other approved absences; a supporting document is required.', paid: false, annualAllocation: null, seniorityYears: 0, seniorityExtraDays: 0, prorateFirstYear: false, maxConsecutiveDays: 10, requiresApproval: true, requiresDocument: true, eligibility: 'all', excludesPublicHolidays: false }),
];

/** EXAMPLE public holidays for the demo (not an official calendar). */
export const PUBLIC_HOLIDAYS: readonly PublicHoliday[] = [
  { date: '2026-01-01', name: { en: "New Year's Day", ar: 'رأس السنة الميلادية' } },
  { date: '2026-05-01', name: { en: 'Labour Day', ar: 'عيد العمال' } },
  { date: '2026-11-26', name: { en: 'Company Day (example)', ar: 'يوم الشركة (مثال)' } },
  { date: '2026-12-31', name: { en: 'Year-End Closure (example)', ar: 'إغلاق نهاية العام (مثال)' } },
  { date: '2027-01-01', name: { en: "New Year's Day", ar: 'رأس السنة الميلادية' } },
];

/** Rejection reasons used by the fictional history. */
export const SEED_REJECTION_REASONS = [
  'The medical note was not provided within the required time.',
  'The team is at minimum staffing on these dates; please choose other dates.',
] as const;
