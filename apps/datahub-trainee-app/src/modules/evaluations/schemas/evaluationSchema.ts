import { z } from 'zod';
import { MAX_SCORE, MIN_SCORE } from '@/core/config/evaluationDefaults';
import { fill, type UiStrings } from '@/i18n';

/** Original rules: at least one category; name ≤ 200, criteria ≤ 1000, score a whole number from 1 to 10. */
export const evaluationSchema = (t: UiStrings) =>
  z.object({
    evaluatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.validation.date),
    enrollmentId: z.string(),
    categories: z
      .array(
        z.object({
          categoryName: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })),
          criteria: z.string().trim().max(1000, fill(t.validation.maxLength, { max: 1000 })),
          score: z
            .number({ error: t.validation.scoreRange })
            .int(t.validation.scoreRange)
            .min(MIN_SCORE, fill(t.validation.scoreBetween, { min: MIN_SCORE, max: MAX_SCORE }))
            .max(MAX_SCORE, fill(t.validation.scoreBetween, { min: MIN_SCORE, max: MAX_SCORE })),
        }),
      )
      .min(1, t.validation.categoriesRequired),
  });

export type EvaluationFormValues = z.infer<ReturnType<typeof evaluationSchema>>;
