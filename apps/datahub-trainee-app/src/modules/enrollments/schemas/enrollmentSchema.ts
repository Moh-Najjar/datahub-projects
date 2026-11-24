import { z } from 'zod';
import { ENROLLMENT_STATUSES } from '@/core/domain/training';
import type { UiStrings } from '@/i18n';

/** Assign a training to a user: both are required (the duplicate rule is the backend's). */
export const enrollmentSchema = (t: UiStrings) =>
  z.object({
    trainingId: z.string().min(1, t.validation.required),
    userId: z.string().min(1, t.validation.required),
  });

export type EnrollmentFormValues = z.infer<ReturnType<typeof enrollmentSchema>>;

/** Status + progress move together (see core/utils/enrollmentRules.ts). */
export const enrollmentUpdateSchema = (t: UiStrings) =>
  z.object({
    status: z.enum(ENROLLMENT_STATUSES, { error: t.validation.required }),
    progress: z.number({ error: t.validation.required }).int().min(0, t.validation.progressRange).max(100, t.validation.progressRange),
  });

export type EnrollmentUpdateValues = z.infer<ReturnType<typeof enrollmentUpdateSchema>>;
