import type { Permission } from '@/core/config/permissions';

/** `hr.leave.approve.team` → `permissions.leave_approve_team` in `common` (":" is i18next's namespace separator). */
export const permissionLabelKey = (p: Permission) => `permissions.${p.replaceAll('.', '_')}` as never;
