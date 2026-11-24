import type { AssignmentStatus } from '@/core/domain/training';

/**
 * The assignment status rule of the original Training Portal (AssignmentStatusCalculator): computed, never stored —
 * Upcoming before it opens, Closed after it closes, Open in between.
 */
export function computeAssignmentStatus(opensAt: string, closesAt: string, now: number = Date.now()): AssignmentStatus {
  if (now < Date.parse(opensAt)) return 'upcoming';
  if (now > Date.parse(closesAt)) return 'closed';
  return 'open';
}
