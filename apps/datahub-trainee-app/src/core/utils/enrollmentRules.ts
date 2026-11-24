import type { DbEnrollment } from '@/core/api/mock/dbTypes';
import type { EnrollmentStatus } from '@/core/domain/training';

/*
 * Enrollment status ⇄ progress rules.
 *
 * Original Training Portal (preserved): any status can be set at any time; setting Completed stamps `completedAt`
 * (now), any other status clears it.
 * Progress tracking (added): progress is 0–100 and stays consistent with the status —
 *   0 ⇒ Assigned · 1–99 ⇒ In Progress · 100 ⇒ Completed.
 * Setting a status by hand moves progress to match (Completed ⇒ 100, Assigned ⇒ 0; In Progress keeps a 1–99 value,
 * otherwise 1, or 99 when reopening a completed enrollment).
 */

export const clampProgress = (value: number): number => Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export const statusForProgress = (progress: number): EnrollmentStatus => (progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'assigned');

type EnrollmentState = Pick<DbEnrollment, 'status' | 'progress' | 'completedAt'>;

/** The enrollment state after setting `progress`. `completedAt` is kept when it was already complete. */
export function withProgress(current: EnrollmentState, progress: number, now: string): EnrollmentState {
  const value = clampProgress(progress);
  const status = statusForProgress(value);
  return { status, progress: value, completedAt: status === 'completed' ? (current.status === 'completed' && current.completedAt ? current.completedAt : now) : null };
}

/** The enrollment state after setting `status` by hand. */
export function withStatus(current: EnrollmentState, status: EnrollmentStatus, now: string): EnrollmentState {
  if (status === 'completed') return { status, progress: 100, completedAt: current.status === 'completed' && current.completedAt ? current.completedAt : now };
  if (status === 'assigned') return { status, progress: 0, completedAt: null };
  const progress = current.progress >= 1 && current.progress <= 99 ? current.progress : current.progress >= 100 ? 99 : 1;
  return { status, progress, completedAt: null };
}

/** Only a completed enrollment may have a certificate. */
export const isCertificateEligible = (enrollment: Pick<DbEnrollment, 'status'>): boolean => enrollment.status === 'completed';

/** A stable, unique certificate reference: `DH-CERT-<enrollment id>-<yyyymmdd of completion>`. */
export function certificateReference(enrollment: Pick<DbEnrollment, 'id' | 'completedAt'>): string {
  const stamp = (enrollment.completedAt ?? '').slice(0, 10).replace(/-/g, '');
  return `DH-CERT-${enrollment.id.replace(/^enr-/i, '').toUpperCase()}-${stamp || '00000000'}`;
}
