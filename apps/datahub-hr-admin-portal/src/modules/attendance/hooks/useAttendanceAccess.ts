import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { AttendanceScope } from '@/modules/attendance/types/attendance';

/**
 * What the signed-in role may do in Attendance, from the EXISTING permission matrix:
 * - `hr.attendance.view` → whole organization; `hr.attendance.view.team` → own team (Department Manager);
 *   `hr.attendance.view.own` (every role's self-service) → own records only ("My attendance");
 * - `hr.attendance.manage` → edit/create records, simulated check-in/out, manage and assign shifts.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useAttendanceAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: AttendanceScope['kind'] = can('hr.attendance.view') ? 'organization' : can('hr.attendance.view.team') ? 'team' : 'own';
  const scope = useMemo<AttendanceScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    /** Overview, records, shifts and reports (beyond the user's own attendance). */
    canReadBeyondOwn: kind !== 'own',
    canManage: can('hr.attendance.manage'),
  };
}
