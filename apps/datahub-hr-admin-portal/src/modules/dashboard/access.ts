import type { Permission } from '@/core/config/permissions';
import type { ActivityType, DashboardScope, PendingActionType } from '@/modules/dashboard/types/dashboard';

/*
 * Which dashboard widgets each permission unlocks — expressed with the existing permission matrix
 * (`core/config/permissions.ts`), never a separate system. A widget is shown when the user has ANY of its
 * permissions. This only decides what the UI shows and requests; the backend must enforce the same rules.
 */

export const WIDGET_ACCESS = {
  /** Headcount KPIs and the employee growth chart (org-wide or own team). */
  headcount: ['organization.employees.view', 'hr.employees.view.team'],
  /** Department distribution — organisation-wide employee data only. */
  departments: ['organization.employees.view'],
  attendance: ['hr.attendance.view', 'hr.attendance.view.team'],
  leave: ['hr.leave.view', 'hr.leave.view.team'],
  recruitment: ['recruitment.jobs.view'],
} as const satisfies Record<string, readonly Permission[]>;

export const ACTIVITY_ACCESS: Record<ActivityType, readonly Permission[]> = {
  'employee-added': WIDGET_ACCESS.headcount,
  'employee-updated': WIDGET_ACCESS.headcount,
  'leave-submitted': WIDGET_ACCESS.leave,
  'leave-approved': WIDGET_ACCESS.leave,
  'attendance-updated': WIDGET_ACCESS.attendance,
  'position-created': WIDGET_ACCESS.recruitment,
  'user-role-changed': ['identity.users.manage'],
};

export const PENDING_ACTION_ACCESS: Record<PendingActionType, readonly Permission[]> = {
  'leave-approvals': ['hr.leave.approve', 'hr.leave.approve.team'],
  'probation-reviews': ['organization.employees.manage', 'hr.employees.view.team'],
  'documents-expiring': ['hr.documents.view'],
  'attendance-corrections': ['hr.attendance.manage', 'hr.attendance.view.team'],
  'open-positions': ['recruitment.jobs.view'],
  'payroll-changes': ['hr.payroll.view'],
};

/** Organisation-wide for HR, payroll and recruitment roles; the own department for department managers. */
export function dashboardScope(can: (permission: Permission) => boolean): DashboardScope {
  return can('organization.employees.view') || can('recruitment.jobs.view') || can('hr.payroll.view') ? 'organization' : 'team';
}
