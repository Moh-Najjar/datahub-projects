import { forbidden, notFound, requireManagedDepartment } from '@/core/api/mock/access';
import type { DbEnrollment } from '@/core/api/mock/dbTypes';
import { db } from '@/core/api/mock/mockDatabase';
import { queryCollection } from '@/core/api/mock/mockUtils';
import type { ListParams, Paginated } from '@/core/api/types';
import { requireActor } from '@/core/auth/actor';
import { canManageDepartment, isLearnerRole, type TrainingActor } from '@/core/auth/trainingPolicy';
import { certificateReference, isCertificateEligible } from '@/core/utils/enrollmentRules';
import type { CertificateDto, CertificateFilters } from '../types/certificate';

/*
 * Simulated Certificates backend. A certificate exists only for a COMPLETED enrollment. A learner sees their own;
 * SuperAdmin sees all; a DepartmentAdmin those of trainings in their department. The reference is derived from the
 * enrollment and its completion date, so it is stable and unique.
 */

function toDto(enrollment: DbEnrollment): CertificateDto {
  const database = db();
  const training = database.trainings.find((t) => t.id === enrollment.trainingId);
  return {
    enrollmentId: enrollment.id,
    reference: certificateReference(enrollment),
    traineeName: database.users.find((u) => u.id === enrollment.userId)?.fullName ?? '',
    trainingId: enrollment.trainingId,
    trainingTitle: training?.title ?? '',
    departmentName: database.departments.find((d) => d.id === training?.departmentId)?.name ?? null,
    trainerName: database.users.find((u) => u.id === training?.trainerId)?.fullName ?? null,
    durationHours: training?.durationHours ?? null,
    completedAt: enrollment.completedAt ?? enrollment.assignedAt,
  };
}

/** May the actor see this enrollment's certificate? */
function mayView(actor: TrainingActor, enrollment: DbEnrollment): boolean {
  if (isLearnerRole(actor.role)) return enrollment.userId === actor.userId;
  const training = db().trainings.find((t) => t.id === enrollment.trainingId);
  return canManageDepartment(actor, training?.departmentId ?? null);
}

export const certificatesMock = {
  list(params: ListParams<CertificateFilters>): Paginated<CertificateDto> {
    const actor = requireActor();
    const rows = db()
      .enrollments.filter((e) => isCertificateEligible(e) && mayView(actor, e))
      .map(toDto);
    return queryCollection(rows, params, {
      searchFields: (c) => [c.traineeName, c.trainingTitle, c.reference],
      matches: (c, f) => !f.trainingId || c.trainingId === f.trainingId,
      sorters: {
        completedAt: (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt),
        trainee: (a, b) => a.traineeName.localeCompare(b.traineeName),
        training: (a, b) => a.trainingTitle.localeCompare(b.trainingTitle),
      },
      defaultSort: (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
    });
  },

  get(enrollmentId: string): CertificateDto {
    const actor = requireActor();
    const enrollment = db().enrollments.find((e) => e.id === enrollmentId) ?? notFound('enrollment.notFound');
    if (!mayView(actor, enrollment)) {
      if (isLearnerRole(actor.role)) forbidden('certificate.notYours');
      requireManagedDepartment(actor, db().trainings.find((t) => t.id === enrollment.trainingId)?.departmentId ?? null, 'enrollment.outsideDepartment');
    }
    if (!isCertificateEligible(enrollment)) forbidden('certificate.notEligible');
    return toDto(enrollment);
  },
};
