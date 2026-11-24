import type { EnrollmentStatus, TrainingStatus } from '@/core/domain/training';
import { token } from './read';

/*
 * Status values of the Academy API ↔ the app's domain statuses. The backend's spelling is not documented (Swagger
 * types them as plain strings), so reading accepts any casing / separator (`InProgress`, `in_progress`, `in-progress`)
 * and writing sends the .NET-style PascalCase name.
 */

export function enrollmentStatusOf(value: string | null): EnrollmentStatus {
  const t = token(value);
  if (t === 'completed' || t === 'complete' || t === 'passed') return 'completed';
  if (t === 'inprogress' || t === 'started' || t === 'active') return 'in-progress';
  return 'assigned';
}

export const backendEnrollmentStatus: Record<EnrollmentStatus, string> = { assigned: 'Assigned', 'in-progress': 'InProgress', completed: 'Completed' };

export function trainingStatusOf(value: string | null): TrainingStatus {
  const t = token(value);
  if (t === 'published' || t === 'active') return 'published';
  if (t === 'archived') return 'archived';
  return 'draft';
}

export const backendTrainingStatus: Record<TrainingStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };
