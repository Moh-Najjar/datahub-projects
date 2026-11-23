import type { Holiday, NotificationRule, SettingsValues } from '@/modules/settings/types/settings';

/*
 * FICTIONAL demo defaults (not a real company, not legal or country-specific policy). `.test` e-mail domain, "000"
 * phone numbers — never routable.
 */

const RULES: NotificationRule[] = [
  { event: 'leave-request', enabled: true, recipients: ['manager', 'hr'], leadDays: null },
  { event: 'leave-decision', enabled: true, recipients: ['employee'], leadDays: null },
  { event: 'attendance-absence', enabled: false, recipients: ['manager'], leadDays: null },
  { event: 'recruitment-stage', enabled: true, recipients: ['recruitment'], leadDays: null },
  { event: 'performance-reminder', enabled: true, recipients: ['employee', 'manager'], leadDays: 7 },
  { event: 'payroll-status', enabled: true, recipients: ['payroll', 'hr'], leadDays: null },
  { event: 'document-expiry', enabled: true, recipients: ['employee', 'hr'], leadDays: 30 },
  { event: 'approval-reminder', enabled: true, recipients: ['manager', 'hr', 'payroll'], leadDays: 3 },
];

export const DEFAULT_SETTINGS: SettingsValues = {
  general: {
    companyName: { en: 'DataHub Demo Company', ar: 'شركة داتاهب التجريبية' },
    logo: null,
    contactEmail: 'hr@demo.datahubhr.test',
    contactPhone: '+962 6 000 0000',
    address: { en: 'Demo Street 1, Amman (fictional)', ar: 'شارع تجريبي 1، عمّان (عنوان خيالي)' },
    website: '',
    defaultCurrency: 'JOD',
    fiscalYearStartMonth: 1,
  },
  localization: { defaultLanguage: 'en', dateFormat: 'dd/mm/yyyy', timeFormat: '24h', currencyDisplay: 'code', weekStart: 0, timezone: 'Asia/Amman' },
  // Sunday–Thursday, as the demo shifts (Attendance) are scheduled.
  workingWeek: { workDays: [0, 1, 2, 3, 4] },
  notifications: { inApp: true, rules: RULES },
  security: { sessionHours: 8, showSessionExpiry: false },
};

const at = '2026-01-05T09:00:00.000Z';
/**
 * EXAMPLE public holidays for the demo (not an official calendar) — the calendar Leave Management counts leave days
 * with (moved here from the leave seed: one source of truth).
 */
export const HOLIDAY_SEED: readonly Holiday[] = [
  { id: 'hol-001', date: '2026-01-01', name: { en: "New Year's Day", ar: 'رأس السنة الميلادية' }, recurring: false, status: 'active', createdAt: at, updatedAt: at },
  { id: 'hol-002', date: '2026-05-01', name: { en: 'Labour Day', ar: 'عيد العمال' }, recurring: false, status: 'active', createdAt: at, updatedAt: at },
  { id: 'hol-003', date: '2026-11-26', name: { en: 'Company Day (example)', ar: 'يوم الشركة (مثال)' }, recurring: false, status: 'active', createdAt: at, updatedAt: at },
  { id: 'hol-004', date: '2026-12-31', name: { en: 'Year-End Closure (example)', ar: 'إغلاق نهاية العام (مثال)' }, recurring: false, status: 'active', createdAt: at, updatedAt: at },
  { id: 'hol-005', date: '2027-01-01', name: { en: "New Year's Day", ar: 'رأس السنة الميلادية' }, recurring: false, status: 'active', createdAt: at, updatedAt: at },
];
