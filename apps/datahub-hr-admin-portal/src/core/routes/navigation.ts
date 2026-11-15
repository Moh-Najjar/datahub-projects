import type { SvgIconComponent } from '@mui/icons-material';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import type { Permission } from '@/core/config/permissions';

/**
 * The app's navigation map — one source for the sidebar, breadcrumbs and the router's permission guards.
 *
 * `available: false` marks areas planned for a later phase: they appear (disabled, "coming soon") only to
 * roles that will be allowed to use them, so role-based navigation is visible today without building the
 * modules early. Flip to `true` and add the route when the module ships.
 */
export interface NavItem {
  key: NavKey;
  path: string;
  icon: SvgIconComponent;
  /** Visible when the user has ANY of these permissions. */
  anyOf: readonly Permission[];
  available: boolean;
}

export type NavKey =
  | 'dashboard'
  | 'profile'
  | 'employees'
  | 'organization'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'recruitment'
  | 'performance'
  | 'documents'
  | 'reports'
  | 'settings'
  | 'users';

export interface NavGroup {
  key: 'overview' | 'people' | 'time' | 'talent' | 'finance' | 'administration';
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', path: '/dashboard', icon: SpaceDashboardOutlined, anyOf: ['dashboard:view'], available: true },
      { key: 'profile', path: '/profile', icon: AccountCircleOutlined, anyOf: ['profile:view'], available: true },
    ],
  },
  {
    key: 'people',
    items: [
      { key: 'employees', path: '/employees', icon: PeopleAltOutlined, anyOf: ['employees:read', 'employees:read:team'], available: false },
      { key: 'organization', path: '/organization', icon: AccountTreeOutlined, anyOf: ['organization:read'], available: false },
    ],
  },
  {
    key: 'time',
    items: [
      { key: 'attendance', path: '/attendance', icon: AccessTimeOutlined, anyOf: ['attendance:read', 'attendance:read:team', 'attendance:read:own'], available: false },
      { key: 'leave', path: '/leave', icon: EventAvailableOutlined, anyOf: ['leave:read', 'leave:read:team', 'leave:read:own'], available: false },
    ],
  },
  {
    key: 'talent',
    items: [
      { key: 'recruitment', path: '/recruitment', icon: WorkOutlineOutlined, anyOf: ['recruitment:read'], available: false },
      { key: 'performance', path: '/performance', icon: TrendingUpOutlined, anyOf: ['performance:read'], available: false },
    ],
  },
  {
    key: 'finance',
    items: [{ key: 'payroll', path: '/payroll', icon: PaymentsOutlined, anyOf: ['payroll:read'], available: false }],
  },
  {
    key: 'administration',
    items: [
      { key: 'documents', path: '/documents', icon: DescriptionOutlined, anyOf: ['documents:read'], available: false },
      { key: 'reports', path: '/reports', icon: AssessmentOutlined, anyOf: ['reports:view'], available: false },
      { key: 'settings', path: '/settings', icon: SettingsOutlined, anyOf: ['settings:manage'], available: false },
      { key: 'users', path: '/users', icon: AdminPanelSettingsOutlined, anyOf: ['users:manage'], available: false },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function navItem(key: NavKey): NavItem {
  return NAV_ITEMS.find((i) => i.key === key)!;
}

/** Groups and items the user may see (empty groups dropped). */
export function visibleNavGroups(canAny: (permissions: readonly Permission[]) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canAny(i.anyOf)) })).filter((g) => g.items.length > 0);
}

/** Where to send a user after sign-in: the first available page they may open. */
export function landingPath(canAny: (permissions: readonly Permission[]) => boolean): string {
  return NAV_ITEMS.find((i) => i.available && canAny(i.anyOf))?.path ?? '/profile';
}
