import type enAttendance from './locales/en/attendance.json';
import type enAuth from './locales/en/auth.json';
import type enCommon from './locales/en/common.json';
import type enDashboard from './locales/en/dashboard.json';
import type enDocuments from './locales/en/documents.json';
import type enEmployees from './locales/en/employees.json';
import type enLeave from './locales/en/leave.json';
import type enOrganization from './locales/en/organization.json';
import type enPayroll from './locales/en/payroll.json';
import type enPerformance from './locales/en/performance.json';
import type enRecruitment from './locales/en/recruitment.json';

/** Type-checked translation keys: `t('nav.items.dashboard')` compiles, a typo does not. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      attendance: typeof enAttendance;
      auth: typeof enAuth;
      dashboard: typeof enDashboard;
      documents: typeof enDocuments;
      employees: typeof enEmployees;
      leave: typeof enLeave;
      organization: typeof enOrganization;
      payroll: typeof enPayroll;
      performance: typeof enPerformance;
      recruitment: typeof enRecruitment;
    };
  }
}
