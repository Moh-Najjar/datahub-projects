import type { SessionUser } from '@/core/context/authContext';

/*
 * FICTIONAL demo accounts for MOCK sign-in — one per role. Not real people; the `.test` domain is
 * reserved and never routable. There are deliberately NO password fields: any password is accepted
 * for these emails and passwords are never stored, logged or compared.
 * Read only by `api/authApi.ts`.
 */
export const DEMO_ACCOUNTS: readonly SessionUser[] = [
  {
    id: 'usr-0001',
    email: 'sysadmin@demo.datahubhr.test',
    name: { en: 'Omar Khalil', ar: 'عمر خليل' },
    role: 'system-admin',
    department: { en: 'Information Technology', ar: 'تقنية المعلومات' },
  },
  {
    id: 'usr-0002',
    email: 'hr.admin@demo.datahubhr.test',
    name: { en: 'Lina Haddad', ar: 'لينا حداد' },
    role: 'hr-admin',
    department: { en: 'Human Resources', ar: 'الموارد البشرية' },
  },
  {
    id: 'usr-0003',
    email: 'hr.manager@demo.datahubhr.test',
    name: { en: 'Rami Saleh', ar: 'رامي صالح' },
    role: 'hr-manager',
    department: { en: 'Human Resources', ar: 'الموارد البشرية' },
  },
  {
    id: 'usr-0004',
    email: 'dept.manager@demo.datahubhr.test',
    name: { en: 'Dana Yousef', ar: 'دانا يوسف' },
    role: 'department-manager',
    department: { en: 'Engineering', ar: 'الهندسة' },
  },
  {
    id: 'usr-0005',
    email: 'employee@demo.datahubhr.test',
    name: { en: 'Sami Odeh', ar: 'سامي عودة' },
    role: 'employee',
    department: { en: 'Engineering', ar: 'الهندسة' },
  },
  {
    id: 'usr-0006',
    email: 'recruiter@demo.datahubhr.test',
    name: { en: 'Maya Jaber', ar: 'مايا جابر' },
    role: 'recruiter',
    department: { en: 'Human Resources', ar: 'الموارد البشرية' },
  },
  {
    id: 'usr-0007',
    email: 'payroll@demo.datahubhr.test',
    name: { en: 'Khaled Mansour', ar: 'خالد منصور' },
    role: 'payroll-officer',
    department: { en: 'Finance', ar: 'المالية' },
  },
];
