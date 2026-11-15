import { z } from 'zod';
import type { TFunction } from 'i18next';

/** Sign-in form validation; messages in the active language. */
export function createLoginSchema(t: TFunction<'auth'>) {
  return z.object({
    email: z.string().trim().min(1, t('login.errors.emailRequired')).pipe(z.email(t('login.errors.emailInvalid'))),
    password: z.string().min(1, t('login.errors.passwordRequired')),
  });
}

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;
