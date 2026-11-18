import type { Localized } from '@/i18n/languages';

/*
 * FICTIONAL demo accounts for the Workspace's MOCK sign-in — read only by `api/workspaceAuth.ts`.
 *
 * They are the HR Admin Portal's demo accounts (apps/datahub-hr-admin-portal/src/modules/auth/mock/demoAccounts.ts —
 * same usernames, names and roles; apps never import each other, so the list is mirrored here) plus one Blogs
 * Administrator, a role the HR portal does not have. Keep both lists in sync. Not real people; `.test` domains are
 * reserved and never routable. There are deliberately NO passwords: any password is accepted and never stored.
 * The real backend replaces this list with real accounts.
 */

/** HR portal roles (`core/config/permissions.ts` there) plus the website's Blogs Administrator. */
export type WorkspaceRole =
  | 'system-admin'
  | 'hr-admin'
  | 'hr-manager'
  | 'department-manager'
  | 'employee'
  | 'recruiter'
  | 'payroll-officer'
  | 'blogs-admin';

export interface WorkspaceAccount {
  /** The sign-in username — the account's work email. */
  username: string;
  name: Localized<string>;
  role: WorkspaceRole;
}

export const DEMO_ACCOUNTS: readonly WorkspaceAccount[] = [
  { username: 'sysadmin@demo.datahubhr.test', name: { en: 'Omar Khalil', ar: 'عمر خليل' }, role: 'system-admin' },
  { username: 'hr.admin@demo.datahubhr.test', name: { en: 'Lina Haddad', ar: 'لينا حداد' }, role: 'hr-admin' },
  { username: 'hr.manager@demo.datahubhr.test', name: { en: 'Rami Saleh', ar: 'رامي صالح' }, role: 'hr-manager' },
  { username: 'dept.manager@demo.datahubhr.test', name: { en: 'Dana Yousef', ar: 'دانا يوسف' }, role: 'department-manager' },
  { username: 'employee@demo.datahubhr.test', name: { en: 'Sami Odeh', ar: 'سامي عودة' }, role: 'employee' },
  { username: 'recruiter@demo.datahubhr.test', name: { en: 'Maya Jaber', ar: 'مايا جابر' }, role: 'recruiter' },
  { username: 'payroll@demo.datahubhr.test', name: { en: 'Khaled Mansour', ar: 'خالد منصور' }, role: 'payroll-officer' },
  // Website-only role: manages the blog, no HR access.
  { username: 'blogs.admin@demo.datahub.test', name: { en: 'Nour Hamdan', ar: 'نور حمدان' }, role: 'blogs-admin' },
];
