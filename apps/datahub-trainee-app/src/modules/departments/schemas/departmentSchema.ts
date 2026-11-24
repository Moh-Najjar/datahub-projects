import { z } from 'zod';
import { fill, type UiStrings } from '@/i18n';

/** Field rules of the original Training Portal: a required name of at most 150 characters. */
export const departmentSchema = (t: UiStrings) =>
  z.object({
    name: z.string().trim().min(1, t.validation.required).max(150, fill(t.validation.maxLength, { max: 150 })),
  });

export type DepartmentFormValues = z.infer<ReturnType<typeof departmentSchema>>;
