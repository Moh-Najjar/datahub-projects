import { z } from 'zod';
import { CURRENCIES, CURRENCY_DISPLAYS, DATE_FORMATS, LANGUAGES, NOTIFICATION_EVENTS, RECIPIENT_GROUPS, TIME_FORMATS, TIMEZONES } from '@/modules/settings/types/settings';

/*
 * Validation of every editable settings section — shared by the forms and the (mock) backend, which re-applies it to
 * each payload (VALIDATION + fieldErrors). Messages are reason keys translated by the UI (`settings:validation.*`).
 */

const text = (max: number) => z.string().trim().max(max, 'tooLong');
const required = (max: number) => text(max).min(1, 'required');
const localized = (max: number) => z.object({ en: required(max), ar: required(max).regex(/[؀-ۿ]/, 'arabicRequired') });

export const generalSchema = z.object({
  companyName: localized(120),
  logo: z
    .object({ name: z.string().trim().min(1).max(160).regex(/\.(png|jpe?g|svg)$/i, 'logoType'), sizeBytes: z.number().int().min(1).max(1_048_576, 'logoSize') })
    .nullable(),
  contactEmail: z.string().trim().max(160, 'tooLong').regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'invalidEmail'),
  contactPhone: z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, 'invalidPhone'),
  address: localized(240),
  website: z.string().trim().max(200, 'tooLong').regex(/^(https:\/\/[^\s/$.?#].[^\s]*)?$/i, 'invalidUrl'),
  defaultCurrency: z.enum(CURRENCIES),
  fiscalYearStartMonth: z.number().int().min(1, 'invalid').max(12, 'invalid'),
});

export const localizationSchema = z.object({
  defaultLanguage: z.enum(LANGUAGES),
  dateFormat: z.enum(DATE_FORMATS),
  timeFormat: z.enum(TIME_FORMATS),
  currencyDisplay: z.enum(CURRENCY_DISPLAYS),
  weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]),
  timezone: z.enum(TIMEZONES),
});

export const workingWeekSchema = z.object({
  workDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'workDaysRequired')
    .max(6, 'restDayRequired')
    .refine((days) => new Set(days).size === days.length, 'duplicate')
    .transform((days) => [...days].sort((a, b) => a - b) as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>),
});

const LEAD_EVENTS = new Set(['document-expiry', 'approval-reminder', 'performance-reminder']);
export const notificationsSchema = z.object({
  inApp: z.boolean(),
  rules: z
    .array(
      z
        .object({
          event: z.enum(NOTIFICATION_EVENTS),
          enabled: z.boolean(),
          recipients: z.array(z.enum(RECIPIENT_GROUPS)),
          leadDays: z.number().int().min(1, 'leadDays').max(90, 'leadDays').nullable(),
        })
        .superRefine((r, ctx) => {
          if (r.enabled && r.recipients.length === 0) ctx.addIssue({ code: 'custom', message: 'recipientsRequired', path: ['recipients'] });
          if (LEAD_EVENTS.has(r.event) && r.leadDays === null) ctx.addIssue({ code: 'custom', message: 'leadDays', path: ['leadDays'] });
          if (!LEAD_EVENTS.has(r.event) && r.leadDays !== null) ctx.addIssue({ code: 'custom', message: 'invalid', path: ['leadDays'] });
        }),
    )
    .refine((rules) => new Set(rules.map((r) => r.event)).size === rules.length && rules.length === NOTIFICATION_EVENTS.length, 'invalid'),
});
export const usesLeadDays = (event: string) => LEAD_EVENTS.has(event);

export const securitySchema = z.object({
  sessionHours: z.number().int('invalid').min(1, 'sessionRange').max(12, 'sessionRange'),
  showSessionExpiry: z.boolean(),
});

export const SECTION_SCHEMAS = {
  general: generalSchema,
  localization: localizationSchema,
  workingWeek: workingWeekSchema,
  notifications: notificationsSchema,
  security: securitySchema,
} as const;

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate'),
  name: localized(80),
  recurring: z.boolean(),
});

/** A reason for the audit log: optional, except where a section requires one (security). */
export const reasonSchema = text(300);

/** Zod issues → `{ field: [reason] }` (the first issue per dotted path). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = [issue.message];
  }
  return out;
}
