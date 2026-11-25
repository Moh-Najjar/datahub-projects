import { z } from 'zod';
import { INQUIRY_TYPES } from '@/core/api/contact';
import type { UiStrings } from '@/i18n';

/** Field names match the original Contact Form 7 form (`your-name`, `your-email`, `inquiry`). */
export interface AppointmentValues {
  name: string;
  email: string;
  /** The backend's inquiry type (`INQUIRY_TYPES`); the select shows its translated / original label. */
  inquiry: string;
  /** Free-text message (Contact page variant only — required there: the API requires a message). */
  message?: string;
  /** Honeypot — must stay empty (the original uses CF7 "website" honeypot). */
  website: string;
}

export const createAppointmentSchema = (messages: UiStrings['validation'], { requireMessage = false } = {}) =>
  z.object({
    name: z.string().trim().min(1, messages.required),
    email: z.string().trim().min(1, messages.required).pipe(z.email(messages.email)),
    inquiry: z.string().refine((value) => (INQUIRY_TYPES as readonly string[]).includes(value), messages.required),
    message: z.string().optional(),
    website: z.string().max(0),
  })
  .superRefine((values, ctx) => {
    if (requireMessage && !values.message?.trim()) ctx.addIssue({ code: 'custom', path: ['message'], message: messages.required });
  });
