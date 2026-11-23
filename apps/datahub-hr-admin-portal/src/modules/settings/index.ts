/*
 * Public API of System Settings for other modules (pure re-exports).
 * - Attendance: `useWorkingWeek` — the organisation's working week is the default of NEW shifts.
 * - Users & Roles: `useAuditLog` (an account's history) and the audit types (its simulated backend writes to the same log).
 * Leave reads the holiday calendar through the simulated backend (leave/mock → settings mock), never through UI code.
 */
export { useAuditLog, useWorkingWeek, settingsKeys } from './hooks/useSettings';
export type { AuditEntry, AuditModule } from './types/settings';

