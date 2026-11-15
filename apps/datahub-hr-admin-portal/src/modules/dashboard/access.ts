import type { Permission } from '@/core/config/permissions';
import type { ActivityType, DashboardScope, PendingActionType } from '@/modules/dashboard/types/dashboard';

/*
 * Which dashboard widgets each permission unlocks — expressed with the existing permission matrix
 * (`core/config/permissions.ts`), never a separate system. A widget is shown when the user has ANY of its
 * permissions. This only decides what the UI shows and requests; the backend must enforce the same rules.
 */

export const WIDGET_ACCESS = {
  /** Headcount KPIs and the employee growth chart (org-wide or own team). */
  headcount: ['employees:read', 'employees:read:team'],
  /** Department distribution — organisation-wide employee data only. */
  departments: ['employees:read'],
  attendance: ['attendance:read', 'attendance:read:team'],
  leave: ['leave:read', 'leave:read:team'],
  recruitment: ['recruitment:read'],
} as const satisfies Record<string, readonly Permission[]>;

export const ACTIVITY_ACCESS: Record<ActivityType, readonly Permission[]> = {
  'employee-added': WIDGET_ACCESS.headcount,
  'employee-updated': WIDGET_ACCESS.headcount,
  'leave-submitted': WIDGET_ACCESS.leave,
  'leave-approved': WIDGET_ACCESS.leave,
  'attendance-updated': WIDGET_ACCESS.attendance,
  'position-created': WIDGET_ACCESS.recruitment,
  'user-role-changed': ['users:manage'],
};

export const PENDING_ACTION_ACCESS: Record<PendingActionType, readonly Permission[]> = {
  'leave-approvals': ['leave:approve', 'leave:approve:team'],
  'probation-reviews': ['employees:write', 'employees:read:team'],
  'documents-expiring': ['documents:read'],
  'attendance-corrections': ['attendance:write', 'attendance:read:team'],
  'open-positions': ['recruitment:read'],
  'payroll-changes': ['payroll:read'],
};

/** Organisation-wide for HR, payroll and recruitment roles; the own department for department managers. */
export function dashboardScope(can: (permission: Permission) => boolean): DashboardScope {
  return can('employees:read') || can('recruitment:read') || can('payroll:read') ? 'organization' : 'team';
}
