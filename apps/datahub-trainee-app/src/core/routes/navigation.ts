import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import type { TrainingPermission } from '@/core/auth/trainingPolicy';
import { ROUTES } from './paths';

/*
 * THE map of the app's pages: path, icon, the business permission(s) that show it (any of) and its sidebar group.
 * The sidebar, the breadcrumbs and the route guards all read it, so navigation and protection never drift apart.
 * Hidden navigation is a convenience, not security — the route guard and the backend enforce access too.
 */

export type NavKey = 'dashboard' | 'trainings' | 'myTrainings' | 'enrollments' | 'users' | 'departments' | 'rankings' | 'certificates';
export type NavGroup = 'learn' | 'manage';

export interface NavItem {
  key: NavKey;
  path: string;
  icon: SvgIconComponent;
  /** Shown to a user holding ANY of these permissions. */
  anyOf: readonly TrainingPermission[];
  group: NavGroup;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', path: ROUTES.dashboard, icon: DashboardOutlinedIcon, anyOf: ['dashboard.view'], group: 'learn' },
  { key: 'trainings', path: ROUTES.trainings, icon: SchoolOutlinedIcon, anyOf: ['trainings.manage'], group: 'learn' },
  { key: 'myTrainings', path: ROUTES.trainings, icon: SchoolOutlinedIcon, anyOf: ['trainings.learn'], group: 'learn' },
  { key: 'certificates', path: ROUTES.certificates, icon: WorkspacePremiumOutlinedIcon, anyOf: ['certificates.view'], group: 'learn' },
  { key: 'enrollments', path: ROUTES.enrollments, icon: AssignmentIndOutlinedIcon, anyOf: ['enrollments.manage'], group: 'manage' },
  { key: 'users', path: ROUTES.users, icon: PeopleOutlinedIcon, anyOf: ['users.manage'], group: 'manage' },
  { key: 'departments', path: ROUTES.departments, icon: ApartmentOutlinedIcon, anyOf: ['departments.manage'], group: 'manage' },
  { key: 'rankings', path: ROUTES.rankings, icon: LeaderboardOutlinedIcon, anyOf: ['rankings.view'], group: 'manage' },
];

/** The navigation items a user with these permissions may see. */
export function navItemsFor(can: (permission: TrainingPermission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some(can));
}

export const navItem = (key: NavKey): NavItem => NAV_ITEMS.find((item) => item.key === key)!;

/** Where signed-in users land (the first item they can see). */
export function landingPath(can: (permission: TrainingPermission) => boolean): string {
  return navItemsFor(can)[0]?.path ?? ROUTES.dashboard;
}
