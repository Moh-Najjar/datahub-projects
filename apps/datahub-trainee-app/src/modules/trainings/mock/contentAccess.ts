import { assertCanViewTraining, invalid, notFound, requireManagedDepartment, requirePermission } from '@/core/api/mock/access';
import type { DbFile, DbTraining } from '@/core/api/mock/dbTypes';
import { db, newId } from '@/core/api/mock/mockDatabase';
import { requireActor } from '@/core/auth/actor';
import type { TrainingActor } from '@/core/auth/trainingPolicy';
import type { FileInput } from '../types/content';
import { fileProblem } from '../utils/files';

/** Access rules shared by the content (materials) and assignments backends. */

function trainingById(trainingId: string): DbTraining {
  return db().trainings.find((t) => t.id === trainingId) ?? notFound('training.notFound');
}

/** The caller and the training, when the caller may AUTHOR it (SuperAdmin, or DepartmentAdmin of its department). */
export function authorTraining(trainingId: string): { actor: TrainingActor; training: DbTraining } {
  const actor = requireActor();
  requirePermission(actor, 'trainings.manage');
  const training = trainingById(trainingId);
  requireManagedDepartment(actor, training.departmentId, 'training.outsideDepartment');
  return { actor, training };
}

/** The caller and the training, when the caller may VIEW it (managers: their scope; learners: enrolled + published). */
export function viewTraining(trainingId: string): { actor: TrainingActor; training: DbTraining } {
  const actor = requireActor();
  const training = trainingById(trainingId);
  assertCanViewTraining(actor, training);
  return { actor, training };
}

/** Validates uploaded file metadata (non-empty, ≤ 100 MB, allowed extension) and turns it into stored file records. */
export function storeFiles(files: readonly FileInput[], field = 'files'): DbFile[] {
  files.forEach((file) => {
    const problem = fileProblem(file);
    if (problem) invalid(field, problem);
  });
  return files.map((file) => ({ id: newId('fil'), title: file.title?.trim() || null, fileName: file.fileName, contentType: file.contentType, fileSizeBytes: file.fileSizeBytes }));
}
