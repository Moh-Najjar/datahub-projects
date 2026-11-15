import type { Localized } from '@datahub/shared-types';
import type { ActivityType } from '@/modules/dashboard/types/dashboard';

/*
 * FICTIONAL recent HR events (people, positions and actors are invented). Read only by `dashboardMock.ts`.
 * `minutesAgo` keeps the feed recent whenever the demo runs.
 */
export interface ActivitySeed {
  id: string;
  type: ActivityType;
  departmentId: string;
  actor: Localized<string>;
  subject: Localized<string>;
  minutesAgo: number;
}

const HR_ADMIN = { en: 'Lina Haddad', ar: 'لينا حداد' };
const HR_MANAGER = { en: 'Rami Saleh', ar: 'رامي صالح' };
const DEPT_MANAGER = { en: 'Dana Yousef', ar: 'دانا يوسف' };
const RECRUITER = { en: 'Maya Jaber', ar: 'مايا جابر' };
const SYS_ADMIN = { en: 'Omar Khalil', ar: 'عمر خليل' };

export const ACTIVITY_SEED: readonly ActivitySeed[] = [
  { id: 'act-01', type: 'leave-submitted', departmentId: 'dep-eng', actor: { en: 'Fadi Salem', ar: 'فادي سالم' }, subject: { en: 'Fadi Salem', ar: 'فادي سالم' }, minutesAgo: 9 },
  { id: 'act-02', type: 'attendance-updated', departmentId: 'dep-ops', actor: HR_ADMIN, subject: { en: 'Tariq Nabulsi', ar: 'طارق النابلسي' }, minutesAgo: 26 },
  { id: 'act-03', type: 'leave-approved', departmentId: 'dep-eng', actor: DEPT_MANAGER, subject: { en: 'Rana Khoury', ar: 'رنا خوري' }, minutesAgo: 48 },
  { id: 'act-04', type: 'employee-added', departmentId: 'dep-sales', actor: HR_ADMIN, subject: { en: 'Yazan Qasem', ar: 'يزن قاسم' }, minutesAgo: 95 },
  { id: 'act-05', type: 'position-created', departmentId: 'dep-eng', actor: RECRUITER, subject: { en: 'Senior Data Engineer', ar: 'مهندس بيانات أول' }, minutesAgo: 140 },
  { id: 'act-06', type: 'user-role-changed', departmentId: 'dep-it', actor: SYS_ADMIN, subject: { en: 'Hala Darwish', ar: 'هلا درويش' }, minutesAgo: 210 },
  { id: 'act-07', type: 'employee-updated', departmentId: 'dep-eng', actor: HR_MANAGER, subject: { en: 'Omar Barakat', ar: 'عمر بركات' }, minutesAgo: 265 },
  { id: 'act-08', type: 'leave-approved', departmentId: 'dep-support', actor: HR_MANAGER, subject: { en: 'Nour Hamdan', ar: 'نور حمدان' }, minutesAgo: 330 },
  { id: 'act-09', type: 'attendance-updated', departmentId: 'dep-eng', actor: DEPT_MANAGER, subject: { en: 'Laith Saadeh', ar: 'ليث سعادة' }, minutesAgo: 420 },
  { id: 'act-10', type: 'position-created', departmentId: 'dep-support', actor: RECRUITER, subject: { en: 'Support Team Lead', ar: 'قائد فريق الدعم' }, minutesAgo: 610 },
  { id: 'act-11', type: 'employee-added', departmentId: 'dep-eng', actor: HR_ADMIN, subject: { en: 'Reem Awad', ar: 'ريم عوض' }, minutesAgo: 1460 },
  { id: 'act-12', type: 'leave-submitted', departmentId: 'dep-fin', actor: { en: 'Sana Abbadi', ar: 'سناء العبادي' }, subject: { en: 'Sana Abbadi', ar: 'سناء العبادي' }, minutesAgo: 1580 },
];
