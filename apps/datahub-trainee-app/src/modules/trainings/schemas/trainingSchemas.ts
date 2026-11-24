import { z } from 'zod';
import { TRAINING_STATUSES } from '@/core/domain/training';
import { fill, type UiStrings } from '@/i18n';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Training form (create + edit). Original rules: title required ≤ 200, description required. Added (optional):
 * start/end date (end not before start) and duration in hours. `departmentId` is only used when creating.
 */
export const trainingSchema = (t: UiStrings) =>
  z
    .object({
      title: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })),
      description: z.string().trim().min(1, t.validation.required),
      departmentId: z.string().min(1, t.validation.required),
      status: z.enum(TRAINING_STATUSES),
      startDate: z.string().regex(isoDate, t.validation.date).or(z.literal('')),
      endDate: z.string().regex(isoDate, t.validation.date).or(z.literal('')),
      durationHours: z
        .string()
        .trim()
        .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 1000), t.validation.durationRange),
    })
    .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: t.validation.endBeforeStart });

export type TrainingFormValues = z.infer<ReturnType<typeof trainingSchema>>;

export const textMaterialSchema = (t: UiStrings) =>
  z.object({
    title: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })),
    content: z.string().trim().min(1, t.validation.required),
  });
export type TextMaterialFormValues = z.infer<ReturnType<typeof textMaterialSchema>>;

const isAbsoluteHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** A link material: a title and at least one link; each URL absolute (http/https) and ≤ 2048 characters. */
export const linkMaterialSchema = (t: UiStrings) =>
  z.object({
    title: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })),
    links: z
      .array(
        z.object({
          title: z.string().trim().max(200, fill(t.validation.maxLength, { max: 200 })),
          url: z.string().trim().min(1, t.validation.required).max(2048, fill(t.validation.maxLength, { max: 2048 })).refine(isAbsoluteHttpUrl, t.validation.url),
        }),
      )
      .min(1, t.validation.linksRequired),
  });
export type LinkMaterialFormValues = z.infer<ReturnType<typeof linkMaterialSchema>>;

export const fileMaterialSchema = (t: UiStrings) =>
  z.object({ title: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })) });
export type FileMaterialFormValues = z.infer<ReturnType<typeof fileMaterialSchema>>;

/** Assignment: title ≤ 200, description required, and the closing time must be after the opening time. */
export const assignmentSchema = (t: UiStrings) =>
  z
    .object({
      title: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })),
      description: z.string().trim().min(1, t.validation.required),
      opensAt: z.string().min(1, t.validation.required),
      closesAt: z.string().min(1, t.validation.required),
    })
    .refine((v) => !v.opensAt || !v.closesAt || Date.parse(v.closesAt) > Date.parse(v.opensAt), { path: ['closesAt'], message: t.validation.closeAfterOpen });
export type AssignmentFormValues = z.infer<ReturnType<typeof assignmentSchema>>;

/** A submission: text up to 4000 characters (files are validated separately). */
export const submissionSchema = (t: UiStrings) => z.object({ textResponse: z.string().max(4000, fill(t.validation.maxLength, { max: 4000 })) });
export type SubmissionFormValues = z.infer<ReturnType<typeof submissionSchema>>;
