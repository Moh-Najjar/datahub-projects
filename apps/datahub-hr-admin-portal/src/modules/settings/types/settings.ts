import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * System Settings contracts — a DRAFT of what the future backend should return. Settings are CONFIGURATION, kept
 * apart from business records; every change is validated by the (mock) backend and written to the audit log.
 * Settings that already exist in a module (leave types, shifts, payroll policy, document categories, rating scale…)
 * are NOT duplicated here: the settings pages summarise them and link to the module's own configuration screen.
 */

export const SETTINGS_CATEGORIES = [
  'general',
  'company',
  'localization',
  'calendar',
  'attendance',
  'leave',
  'recruitment',
  'performance',
  'payroll',
  'documents',
  'notifications',
  'workflows',
  'security',
  'audit',
] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

/** Sections stored by System Settings itself (the other categories summarise module configuration). */
export const EDITABLE_SECTIONS = ['general', 'localization', 'workingWeek', 'notifications', 'security'] as const;
export type SettingsSection = (typeof EDITABLE_SECTIONS)[number];

export const CURRENCIES = ['JOD', 'USD', 'SAR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const LANGUAGES = ['en', 'ar'] as const;
export const DATE_FORMATS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd', 'd-mmm-yyyy'] as const;
export const TIME_FORMATS = ['24h', '12h'] as const;
export const CURRENCY_DISPLAYS = ['code', 'symbol'] as const;
/** A short list of time zones relevant to the demo organisation (IANA identifiers). */
export const TIMEZONES = ['Asia/Amman', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Qatar', 'Africa/Cairo', 'Europe/London', 'UTC'] as const;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Company identity shown in the portal and printed documents. Fictional demo defaults. */
export interface GeneralSettings {
  companyName: Localized<string>;
  /** SIMULATED logo: file name and size only — nothing is uploaded or stored. */
  logo: { name: string; sizeBytes: number } | null;
  contactEmail: string;
  contactPhone: string;
  address: Localized<string>;
  website: string;
  /** Payroll currencies are the supported ones; reports use this currency and never mix currencies. */
  defaultCurrency: Currency;
  /** 1 = January. */
  fiscalYearStartMonth: number;
}

export interface LocalizationSettings {
  /** Both languages are always available (the portal is bilingual with RTL); this is the default for new users. */
  defaultLanguage: (typeof LANGUAGES)[number];
  dateFormat: (typeof DATE_FORMATS)[number];
  timeFormat: (typeof TIME_FORMATS)[number];
  currencyDisplay: (typeof CURRENCY_DISPLAYS)[number];
  /** Day calendars start with (0 = Sunday). */
  weekStart: 0 | 1 | 6;
  timezone: (typeof TIMEZONES)[number];
}

/** The organisation's default working week: the days NEW shifts start with (existing shifts keep their own days). */
export interface WorkingWeekSettings {
  workDays: Weekday[];
}

export const NOTIFICATION_EVENTS = ['leave-request', 'leave-decision', 'attendance-absence', 'recruitment-stage', 'performance-reminder', 'payroll-status', 'document-expiry', 'approval-reminder'] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
/** Who receives an event (resolved by the backend from roles and the employee's manager). */
export const RECIPIENT_GROUPS = ['employee', 'manager', 'hr', 'payroll', 'recruitment', 'administrators'] as const;
export type RecipientGroup = (typeof RECIPIENT_GROUPS)[number];

export interface NotificationRule {
  event: NotificationEvent;
  enabled: boolean;
  recipients: RecipientGroup[];
  /** Days before expiry / after which pending items are reminded (only for events that use it). */
  leadDays: number | null;
}

/** CONFIGURATION only: the portal has no notification delivery yet (no in-app centre, no e-mail or SMS provider). */
export interface NotificationSettings {
  inApp: boolean;
  rules: NotificationRule[];
}

export interface SecuritySettings {
  /** Length of a portal session started from the Workspace sign-in (1–12 hours). */
  sessionHours: number;
  /** Show the session's end time in the user menu. */
  showSessionExpiry: boolean;
}

export interface SettingsValues {
  general: GeneralSettings;
  localization: LocalizationSettings;
  workingWeek: WorkingWeekSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
}

export interface SectionMeta {
  updatedAt: string | null;
  updatedBy: Localized<string> | null;
}

export interface SettingsDocument<S extends SettingsSection = SettingsSection> {
  section: S;
  values: SettingsValues[S];
  defaults: SettingsValues[S];
  meta: SectionMeta;
}

/* Holidays --------------------------------------------------------------------------------------------------------- */

/** One public holiday of the organisation's calendar — the calendar Leave Management counts leave days with. */
export interface Holiday {
  id: string;
  date: string;
  name: Localized<string>;
  /** Repeats on the same day every year. */
  recurring: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface HolidayInput {
  date: string;
  name: Localized<string>;
  recurring: boolean;
}

export interface HolidayFilters {
  year: string;
  status: 'active' | 'inactive';
}

/* Audit -------------------------------------------------------------------------------------------------------------- */

export const AUDIT_MODULES = ['settings', 'users', 'roles'] as const;
export type AuditModule = (typeof AUDIT_MODULES)[number];

/** One recorded change (settings, users, roles). Values are display text, never secrets. */
export interface AuditEntry {
  id: string;
  at: string;
  module: AuditModule;
  /** What changed: a setting key (`general.contactEmail`), a holiday, a user or a role. */
  target: string;
  targetLabel: Localized<string>;
  action: 'updated' | 'created' | 'deleted' | 'reset' | 'activated' | 'deactivated' | 'status' | 'role' | 'permissions' | 'linked' | 'unlinked';
  previous: string | null;
  next: string | null;
  actor: { userId: string; name: Localized<string> };
  reason: string;
}

export interface AuditFilters {
  module: AuditModule;
  target: string;
  /** Changes made from this date (inclusive). */
  from: string;
}

/* Overview ------------------------------------------------------------------------------------------------------------ */

export interface SettingsOverview {
  companyName: Localized<string>;
  defaultCurrency: Currency;
  defaultLanguage: 'en' | 'ar';
  timezone: string;
  workDays: Weekday[];
  activeHolidays: number;
  sessionHours: number;
  notificationsEnabled: number;
  recentChanges: AuditEntry[];
}

/** Read-only facts about the sign-in integration (never a secret, token or credential). */
export interface SecurityStatus {
  workspaceConfigured: boolean;
  workspaceOrigin: string | null;
  /** A Workspace hand-off token is accepted for at most this many minutes. */
  handoffMaxMinutes: number;
  sessionStorage: 'tab';
  passwordAuthentication: false;
}

/* Caller -------------------------------------------------------------------------------------------------------------- */

/** Who is asking. The mock derives permissions from the role (the backend: from the token). */
export interface SettingsCaller {
  userId: string;
  role: Role;
  name: Localized<string>;
}
