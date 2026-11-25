import { z } from 'zod';
import { fill, type UiStrings } from '@/i18n';

/** Field rules of the original Training Portal: name ≤ 200, valid e-mail, a role from the role options, optional department. */
export const userSchema = (t: UiStrings) =>
  z.object({
    fullName: z.string().trim().min(1, t.validation.required).max(200, fill(t.validation.maxLength, { max: 200 })),
    email: z.string().trim().min(1, t.validation.required).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, t.validation.email),
    role: z.string().min(1, t.validation.required),
    departmentId: z.string(),
    isActive: z.boolean(),
  });

export type UserFormValues = z.infer<ReturnType<typeof userSchema>>;
