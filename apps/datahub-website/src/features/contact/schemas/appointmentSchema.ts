import { z } from 'zod';
import type { UiStrings } from '@/i18n/ui';

/** Field names match the original Contact Form 7 form (`your-name`, `your-email`, `inquiry`). */
export interface AppointmentValues {
  name: string;
  email: string;
  inquiry: string;
  /** Optional free-text message (Contact page variant only). */
  message?: string;
  /** Honeypot — must stay empty (the original uses CF7 "website" honeypot). */
  website: string;
}

export const createAppointmentSchema = (messages: UiStrings['validation']) =>
  z.object({
    name: z.string().trim().min(1, messages.required),
    email: z.string().trim().min(1, messages.required).pipe(z.email(messages.email)),
    inquiry: z.string().min(1, messages.required),
    message: z.string().optional(),
    website: z.string().max(0),
  });
