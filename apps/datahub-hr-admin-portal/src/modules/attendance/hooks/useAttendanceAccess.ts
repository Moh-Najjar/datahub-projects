import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { AttendanceScope } from '@/modules/attendance/types/attendance';

/**
 * What the signed-in role may do in Attendance, from the EXISTING permission matrix:
 * - `attendance:read` → whole organization; `attendance:read:team` → own team (Department Manager);
 *   `attendance:read:own` (every role's self-service) → own records only ("My attendance");
 * - `attendance:write` → edit/create records, simulated check-in/out, manage and assign shifts.
 * UI only — the backend must enforce the same rules and derive the scope from the signed-in user.
 */
export function useAttendanceAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: AttendanceScope['kind'] = can('attendance:read') ? 'organization' : can('attendance:read:team') ? 'team' : 'own';
  const scope = useMemo<AttendanceScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    /** Overview, records, shifts and reports (beyond the user's own attendance). */
    canReadBeyondOwn: kind !== 'own',
    canManage: can('attendance:write'),
  };
}
