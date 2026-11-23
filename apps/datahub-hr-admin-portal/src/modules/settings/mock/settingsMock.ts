import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { WORKSPACE_ORIGIN } from '@/core/config/workspace';
import { fieldErrorsOf, holidaySchema, reasonSchema, SECTION_SCHEMAS } from '@/modules/settings/schemas/settingsSchemas';
import type {
  AuditEntry,
  AuditFilters,
  Holiday,
  HolidayFilters,
  HolidayInput,
  SecurityStatus,
  SettingsCaller,
  SettingsDocument,
  SettingsOverview,
  SettingsSection,
  SettingsValues,
} from '@/modules/settings/types/settings';
import { DEFAULT_SETTINGS, HOLIDAY_SEED } from './seed';

/*
 * SIMULATED settings backend: one in-memory configuration store (reset on reload), the organisation's holiday calendar
 * and the central audit log. Every write is validated with the shared Zod schemas, checked against the caller's
 * permissions (derived from the role — the backend: from the token) and audited with the previous and new value.
 * Users & Roles writes its changes to the same audit log (`auditLog.append`).
 */

const clone = <T,>(v: T): T => structuredClone(v);
const pad = (n: number) => String(n).padStart(2, '0');
/** A real calendar date `YYYY-MM-DD` (rejects 2026-02-30). */
const isDate = (v: string) => {
  const d = new Date(`${v}T00:00`);
  return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === v;
};
let values: SettingsValues = clone(DEFAULT_SETTINGS);
let meta: Record<SettingsSection, { updatedAt: string | null; updatedBy: Localized<string> | null }> = freshMeta();
let holidays: Holiday[] = clone([...HOLIDAY_SEED]);
let audit: AuditEntry[] = [];
let nextHoliday = HOLIDAY_SEED.length + 1;
let nextAudit = 1;

function freshMeta() {
  return { general: { updatedAt: null, updatedBy: null }, localization: { updatedAt: null, updatedBy: null }, workingWeek: { updatedAt: null, updatedBy: null }, notifications: { updatedAt: null, updatedBy: null }, security: { updatedAt: null, updatedBy: null } };
}

export function resetSettingsMock() {
  values = clone(DEFAULT_SETTINGS);
  meta = freshMeta();
  holidays = clone([...HOLIDAY_SEED]);
  audit = [];
  nextHoliday = HOLIDAY_SEED.length + 1;
  nextAudit = 1;
}

/* Access ------------------------------------------------------------------------------------------------------------- */

const forbidden = (): never => {
  throw new ApiError('FORBIDDEN', 'Not allowed');
};
const invalid = (fieldErrors: Record<string, string[]>): never => {
  throw new ApiError('VALIDATION', 'Invalid settings', fieldErrors);
};
/** Settings are managed with `hr.settings.manage`; sign-in & session settings also need `identity.users.manage` (system administration). */
function requireManage(caller: SettingsCaller, section?: SettingsSection) {
  if (!hasPermission(caller.role, 'hr.settings.manage')) forbidden();
  if (section === 'security' && !hasPermission(caller.role, 'identity.users.manage')) forbidden();
}

/* Audit log ---------------------------------------------------------------------------------------------------------- */

type AuditInput = Omit<AuditEntry, 'id' | 'at' | 'actor'>;
export const auditLog = {
  append(entry: AuditInput, caller: Pick<SettingsCaller, 'userId' | 'name'>): AuditEntry {
    const row: AuditEntry = { ...entry, id: `aud-${String(nextAudit++).padStart(5, '0')}`, at: new Date().toISOString(), actor: { userId: caller.userId, name: caller.name } };
    audit.unshift(row);
    return row;
  },
  entries: (): readonly AuditEntry[] => audit,
};

/** Display text of a value in the audit log (localized values as "English / العربية"). */
function display(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => display(v)).join(', ');
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('en' in o && 'ar' in o) return `${String(o.en)} / ${String(o.ar)}`;
    if ('name' in o && 'sizeBytes' in o) return String(o.name);
    return JSON.stringify(o);
  }
  return String(value);
}

/** One audit entry per changed field (dotted key), with the previous and new display values. */
function diff(section: SettingsSection, before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Array<{ key: string; previous: string | null; next: string | null }> = [];
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out.push({ key: `${section}.${key}`, previous: display(before[key]), next: display(after[key]) });
  }
  return out;
}

/* Settings ----------------------------------------------------------------------------------------------------------- */

export function getSection<S extends SettingsSection>(section: S, caller: SettingsCaller): SettingsDocument<S> {
  requireManage(caller, section === 'security' ? undefined : section);
  return { section, values: clone(values[section]), defaults: clone(DEFAULT_SETTINGS[section]), meta: clone(meta[section]) };
}

export function updateSection<S extends SettingsSection>(section: S, input: SettingsValues[S], reason: string, caller: SettingsCaller): SettingsDocument<S> {
  requireManage(caller, section);
  const parsed = SECTION_SCHEMAS[section].safeParse(input);
  if (!parsed.success) invalid(fieldErrorsOf(parsed.error));
  const why = reasonSchema.safeParse(reason ?? '');
  if (!why.success) invalid({ reason: ['tooLong'] });
  // Sign-in & session changes affect every user: a reason is required.
  if (section === 'security' && !why.data!.length) invalid({ reason: ['reasonRequired'] });
  const next = parsed.data as SettingsValues[S];
  const changes = diff(section, values[section] as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
  if (!changes.length) return getSection(section, caller);
  for (const c of changes) auditLog.append({ module: 'settings', target: c.key, targetLabel: { en: c.key, ar: c.key }, action: 'updated', previous: c.previous, next: c.next, reason: why.data! }, caller);
  values = { ...values, [section]: clone(next) };
  meta[section] = { updatedAt: new Date().toISOString(), updatedBy: caller.name };
  return getSection(section, caller);
}

/** Restore a section's demo defaults (audited like any change). */
export function resetSection<S extends SettingsSection>(section: S, reason: string, caller: SettingsCaller): SettingsDocument<S> {
  requireManage(caller, section);
  const changes = diff(section, values[section] as unknown as Record<string, unknown>, DEFAULT_SETTINGS[section] as unknown as Record<string, unknown>);
  for (const c of changes) auditLog.append({ module: 'settings', target: c.key, targetLabel: { en: c.key, ar: c.key }, action: 'reset', previous: c.previous, next: c.next, reason: (reason ?? '').trim().slice(0, 300) }, caller);
  values = { ...values, [section]: clone(DEFAULT_SETTINGS[section]) };
  if (changes.length) meta[section] = { updatedAt: new Date().toISOString(), updatedBy: caller.name };
  return getSection(section, caller);
}

/**
 * Demo reset: EVERY settings section and the holiday calendar back to the demo defaults. Touches nothing else — no
 * employee, attendance, leave, payroll or document record, and no user account. The reset itself stays in the audit log.
 */
export function resetAllSettings(reason: string, caller: SettingsCaller): { sections: number; holidays: number } {
  if (!hasPermission(caller.role, 'hr.settings.manage') || !hasPermission(caller.role, 'identity.users.manage')) forbidden();
  const why = (reason ?? '').trim();
  if (!why) invalid({ reason: ['reasonRequired'] });
  let sections = 0;
  for (const s of Object.keys(DEFAULT_SETTINGS) as SettingsSection[]) {
    if (diff(s, values[s] as unknown as Record<string, unknown>, DEFAULT_SETTINGS[s] as unknown as Record<string, unknown>).length) sections++;
  }
  const changedHolidays = JSON.stringify(holidays) !== JSON.stringify(HOLIDAY_SEED) ? holidays.length : 0;
  values = clone(DEFAULT_SETTINGS);
  meta = freshMeta();
  holidays = clone([...HOLIDAY_SEED]);
  nextHoliday = HOLIDAY_SEED.length + 1;
  auditLog.append({ module: 'settings', target: 'all', targetLabel: { en: 'All settings', ar: 'جميع الإعدادات' }, action: 'reset', previous: null, next: null, reason: why.slice(0, 300) }, caller);
  return { sections, holidays: changedHolidays };
}

/** The organisation's working week: readable by every signed-in role (new shifts start with it). */
export function workingWeek(): SettingsValues['workingWeek'] {
  return clone(values.workingWeek);
}

export function overview(caller: SettingsCaller): SettingsOverview {
  requireManage(caller);
  return {
    companyName: clone(values.general.companyName),
    defaultCurrency: values.general.defaultCurrency,
    defaultLanguage: values.localization.defaultLanguage,
    timezone: values.localization.timezone,
    workDays: [...values.workingWeek.workDays],
    activeHolidays: holidays.filter((h) => h.status === 'active').length,
    sessionHours: values.security.sessionHours,
    notificationsEnabled: values.notifications.rules.filter((r) => r.enabled).length,
    recentChanges: clone(audit.slice(0, 5)),
  };
}

export function securityStatus(caller: SettingsCaller): SecurityStatus {
  requireManage(caller);
  return { workspaceConfigured: Boolean(WORKSPACE_ORIGIN), workspaceOrigin: WORKSPACE_ORIGIN ?? null, handoffMaxMinutes: 5, sessionStorage: 'tab', passwordAuthentication: false };
}

/* Holidays ----------------------------------------------------------------------------------------------------------- */

const holidayYear = (h: Holiday) => h.date.slice(0, 4);
export function listHolidays(params: ListParams<HolidayFilters>, caller: SettingsCaller): Paginated<Holiday> {
  requireManage(caller);
  const f = params.filters ?? {};
  const rows = holidays.filter((h) => (!f.year || holidayYear(h) === f.year || (h.recurring && holidayYear(h) <= f.year)) && (!f.status || h.status === f.status));
  const q = params.search?.trim().toLowerCase();
  const found = q ? rows.filter((h) => `${h.name.en} ${h.name.ar} ${h.date}`.toLowerCase().includes(q)) : rows;
  return queryCollection(found, { sortBy: 'date', sortDirection: 'asc', ...params, search: '', filters: {} });
}

function validHoliday(input: HolidayInput, exceptId: string | null): HolidayInput {
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) invalid(fieldErrorsOf(parsed.error));
  const v = parsed.data!;
  if (!isDate(v.date)) invalid({ date: ['invalidDate'] });
  const clash = holidays.find((h) => h.id !== exceptId && h.status === 'active' && (h.date === v.date || (h.recurring && v.recurring && h.date.slice(5) === v.date.slice(5))));
  if (clash) invalid({ date: ['duplicateDate'] });
  return v;
}

export function createHoliday(input: HolidayInput, reason: string, caller: SettingsCaller): Holiday {
  requireManage(caller);
  const v = validHoliday(input, null);
  const now = new Date().toISOString();
  const row: Holiday = { id: `hol-${String(nextHoliday++).padStart(3, '0')}`, date: v.date, name: v.name, recurring: v.recurring, status: 'active', createdAt: now, updatedAt: now };
  holidays.push(row);
  auditLog.append({ module: 'settings', target: `holiday:${row.id}`, targetLabel: row.name, action: 'created', previous: null, next: `${row.date} ${display(row.name)}`, reason: (reason ?? '').trim().slice(0, 300) }, caller);
  return clone(row);
}

export function updateHoliday(id: string, input: HolidayInput, reason: string, caller: SettingsCaller): Holiday {
  requireManage(caller);
  const row = holidays.find((h) => h.id === id);
  if (!row) throw new ApiError('NOT_FOUND', 'Holiday not found');
  const v = validHoliday(input, id);
  const previous = `${row.date} ${display(row.name)}${row.recurring ? ' ↻' : ''}`;
  Object.assign(row, { date: v.date, name: v.name, recurring: v.recurring, updatedAt: new Date().toISOString() });
  auditLog.append({ module: 'settings', target: `holiday:${row.id}`, targetLabel: row.name, action: 'updated', previous, next: `${row.date} ${display(row.name)}${row.recurring ? ' ↻' : ''}`, reason: (reason ?? '').trim().slice(0, 300) }, caller);
  return clone(row);
}

export function updateHolidayStatus(id: string, status: Holiday['status'], reason: string, caller: SettingsCaller): Holiday {
  requireManage(caller);
  const row = holidays.find((h) => h.id === id);
  if (!row) throw new ApiError('NOT_FOUND', 'Holiday not found');
  if (row.status === status) throw new ApiError('CONFLICT', `Holiday already ${status}`);
  if (status === 'active') validHoliday({ date: row.date, name: row.name, recurring: row.recurring }, id);
  row.status = status;
  row.updatedAt = new Date().toISOString();
  auditLog.append({ module: 'settings', target: `holiday:${row.id}`, targetLabel: row.name, action: status === 'active' ? 'activated' : 'deactivated', previous: status === 'active' ? 'inactive' : 'active', next: status, reason: (reason ?? '').trim().slice(0, 300) }, caller);
  return clone(row);
}

/** Active holidays as dated entries (recurring ones repeated for every year from their first date up to `untilYear`). */
export function holidayCalendar(untilYear = new Date().getFullYear() + 5): Array<{ date: string; name: Localized<string> }> {
  const out: Array<{ date: string; name: Localized<string> }> = [];
  for (const h of holidays) {
    if (h.status !== 'active') continue;
    if (!h.recurring) out.push({ date: h.date, name: clone(h.name) });
    else for (let y = Number(h.date.slice(0, 4)); y <= untilYear; y++) out.push({ date: `${y}${h.date.slice(4)}`, name: clone(h.name) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* Audit view ----------------------------------------------------------------------------------------------------------- */

export function listAudit(params: ListParams<AuditFilters>, caller: SettingsCaller): Paginated<AuditEntry> {
  requireManage(caller);
  const f = params.filters ?? {};
  // User & role changes are visible only to those who manage users.
  const mayUsers = hasPermission(caller.role, 'identity.users.manage');
  const rows = audit.filter((a) => (mayUsers || a.module === 'settings') && (!f.module || a.module === f.module) && (!f.target || a.target === f.target || a.target.startsWith(`${f.target}.`)) && (!f.from || a.at.slice(0, 10) >= f.from));
  const q = params.search?.trim().toLowerCase();
  const found = q ? rows.filter((a) => [a.target, a.targetLabel.en, a.targetLabel.ar, a.actor.name.en, a.actor.name.ar, a.reason, a.previous ?? '', a.next ?? ''].join(' ').toLowerCase().includes(q)) : rows;
  return queryCollection(found, { sortBy: 'at', sortDirection: 'desc', ...params, search: '', filters: {} });
}

/** Backend accessors for other simulated modules (Leave counts days with the holiday calendar; Auth issues sessions). */
export const settingsData = {
  holidayCalendar,
  sessionHours: () => values.security.sessionHours,
  workingWeek,
  auditLog,
};
