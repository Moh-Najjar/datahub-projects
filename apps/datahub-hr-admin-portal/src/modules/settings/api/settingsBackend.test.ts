import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { leaveApi } from '@/modules/leave';
import { settingsApi as api } from '@/modules/settings/api/settingsApi';
import { DEFAULT_SETTINGS } from '@/modules/settings/mock/seed';
import type { SettingsCaller } from '@/modules/settings/types/settings';

/* System Settings backend on a fixed clock: Monday 16 Nov 2026, 10:30. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
const as = (role: Role): SettingsCaller => ({ userId: users[role], role, name: { en: `User ${role}`, ar: `مستخدم ${role}` } });
const ADMIN = as('system-admin');
const HR = as('hr-admin');

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const e = await promise.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e, 'expected an error').toBeInstanceOf(ApiError);
  return e as ApiError;
}

describe('access', () => {
  it('hr.settings.manage reads and writes settings; every other role is refused', async () => {
    expect((await api.getSettings('general', HR)).values.companyName.en).toBe('DataHub Demo Company');
    for (const role of ['hr-manager', 'department-manager', 'employee', 'recruiter', 'payroll-officer'] as const) {
      expect((await failure(api.getSettings('general', as(role)))).code, role).toBe('FORBIDDEN');
      expect((await failure(api.getSettingsOverview(as(role)))).code, role).toBe('FORBIDDEN');
      expect((await failure(api.updateSettings('general', DEFAULT_SETTINGS.general, '', as(role)))).code, role).toBe('FORBIDDEN');
    }
  });

  it('sign-in & session settings and the demo reset are System Administrator only', async () => {
    const next = { ...DEFAULT_SETTINGS.security, sessionHours: 4 };
    expect((await failure(api.updateSettings('security', next, 'Shorter sessions', HR))).code).toBe('FORBIDDEN');
    expect((await failure(api.resetAllSettings('Clean demo', HR))).code).toBe('FORBIDDEN');
    expect((await api.updateSettings('security', next, 'Shorter sessions', ADMIN)).values.sessionHours).toBe(4);
  });

  it('the working week is readable by every signed-in role (new shifts start with it)', async () => {
    expect((await api.getWorkingWeek()).workDays).toEqual([0, 1, 2, 3, 4]);
  });

  it('security status never exposes a secret', async () => {
    const s = await api.getSecurityStatus(HR);
    expect(Object.keys(s).sort()).toEqual(['handoffMaxMinutes', 'passwordAuthentication', 'sessionStorage', 'workspaceConfigured', 'workspaceOrigin']);
    expect(s.passwordAuthentication).toBe(false);
  });
});

describe('updates, validation and audit', () => {
  it('validates at the API (field errors), whatever the UI sent', async () => {
    const bad = { ...DEFAULT_SETTINGS.general, contactEmail: 'not-an-email', companyName: { en: 'X', ar: 'Latin only' }, fiscalYearStartMonth: 13 };
    expect((await failure(api.updateSettings('general', bad, '', HR))).fieldErrors).toEqual({ contactEmail: ['invalidEmail'], 'companyName.ar': ['arabicRequired'], fiscalYearStartMonth: ['invalid'] });
    expect((await failure(api.updateSettings('workingWeek', { workDays: [] }, '', HR))).fieldErrors).toEqual({ workDays: ['workDaysRequired'] });
    expect((await failure(api.updateSettings('workingWeek', { workDays: [0, 1, 2, 3, 4, 5, 6] }, '', HR))).fieldErrors).toEqual({ workDays: ['restDayRequired'] });
    expect((await failure(api.updateSettings('security', { sessionHours: 24, showSessionExpiry: false }, 'x', ADMIN))).fieldErrors).toEqual({ sessionHours: ['sessionRange'] });
    expect((await failure(api.updateSettings('security', { sessionHours: 4, showSessionExpiry: false }, '', ADMIN))).fieldErrors).toEqual({ reason: ['reasonRequired'] });
    const logo = { ...DEFAULT_SETTINGS.general, logo: { name: 'logo.exe', sizeBytes: 10 } };
    expect((await failure(api.updateSettings('general', logo, '', HR))).fieldErrors).toEqual({ 'logo.name': ['logoType'] });
  });

  it('records one audit entry per changed field: previous, new, who, when, why', async () => {
    const next = { ...DEFAULT_SETTINGS.general, contactPhone: '+962 6 111 1111', defaultCurrency: 'USD' as const };
    const doc = await api.updateSettings('general', next, 'New switchboard', HR);
    expect(doc.values.contactPhone).toBe('+962 6 111 1111');
    expect(doc.meta.updatedBy).toEqual(HR.name);
    const log = await api.getAuditLog({ page: 1, pageSize: 10 }, HR);
    expect(log.items.map((a) => [a.target, a.previous, a.next])).toEqual([
      ['general.defaultCurrency', 'JOD', 'USD'],
      ['general.contactPhone', '+962 6 000 0000', '+962 6 111 1111'],
    ]);
    expect(log.items[0]).toMatchObject({ module: 'settings', action: 'updated', reason: 'New switchboard', actor: { userId: 'usr-0002' } });
    // Saving unchanged values records nothing.
    await api.updateSettings('general', next, '', HR);
    expect((await api.getAuditLog({ page: 1, pageSize: 10 }, HR)).total).toBe(2);
    expect((await api.getSettingsOverview(HR)).recentChanges).toHaveLength(2);
  });

  it('restores a section’s defaults (audited) and the demo reset touches settings only', async () => {
    await api.updateSettings('localization', { ...DEFAULT_SETTINGS.localization, timezone: 'UTC' }, '', HR);
    const reset = await api.resetSettings('localization', 'Back to defaults', HR);
    expect(reset.values).toEqual(DEFAULT_SETTINGS.localization);
    expect((await api.getAuditLog({ page: 1, pageSize: 1 }, HR)).items[0]).toMatchObject({ action: 'reset', target: 'localization.timezone', previous: 'UTC', next: 'Asia/Amman' });

    await api.createHoliday({ date: '2026-12-01', name: { en: 'Example day', ar: 'يوم مثال' }, recurring: false }, '', HR);
    const before = await leaveApi.getLeaveSummary(2026, { kind: 'organization', userId: HR.userId, role: HR.role });
    expect((await failure(api.resetAllSettings('', ADMIN))).fieldErrors).toEqual({ reason: ['reasonRequired'] });
    expect(await api.resetAllSettings('Clean demo', ADMIN)).toEqual({ sections: 0, holidays: 6 });
    expect((await api.getHolidays({ page: 1, pageSize: 100 }, HR)).total).toBe(5);
    expect(await leaveApi.getLeaveSummary(2026, { kind: 'organization', userId: HR.userId, role: HR.role })).toEqual(before);
    expect((await api.getAuditLog({ page: 1, pageSize: 1 }, HR)).items[0]).toMatchObject({ target: 'all', action: 'reset', reason: 'Clean demo' });
  });

  it('notification rules: recipients required when on, lead days only where used', async () => {
    const rules = DEFAULT_SETTINGS.notifications.rules.map((r) => (r.event === 'leave-request' ? { ...r, recipients: [] } : r.event === 'document-expiry' ? { ...r, leadDays: null } : r));
    expect((await failure(api.updateSettings('notifications', { inApp: true, rules }, '', HR))).fieldErrors).toEqual({ 'rules.0.recipients': ['recipientsRequired'], 'rules.6.leadDays': ['leadDays'] });
    const off = DEFAULT_SETTINGS.notifications.rules.map((r) => (r.event === 'leave-request' ? { ...r, enabled: false, recipients: [] } : r));
    expect((await api.updateSettings('notifications', { inApp: true, rules: off }, '', HR)).values.rules[0]!.enabled).toBe(false);
  });
});

describe('working days & holidays', () => {
  it('holidays: create, validate, filter by year, deactivate', async () => {
    expect((await failure(api.createHoliday({ date: '2026-02-30', name: { en: 'Bad', ar: 'خطأ' }, recurring: false }, '', HR))).fieldErrors).toEqual({ date: ['invalidDate'] });
    expect((await failure(api.createHoliday({ date: '2026-05-01', name: { en: 'Again', ar: 'مرة أخرى' }, recurring: false }, '', HR))).fieldErrors).toEqual({ date: ['duplicateDate'] });
    const h = await api.createHoliday({ date: '2027-03-21', name: { en: 'Spring (example)', ar: 'الربيع (مثال)' }, recurring: true }, '', HR);
    expect((await api.getHolidays({ page: 1, pageSize: 100, filters: { year: '2028' } }, HR)).items.map((x) => x.id)).toEqual([h.id]);
    expect((await api.updateHolidayStatus(h.id, 'inactive', 'Not observed', HR)).status).toBe('inactive');
    expect((await failure(api.updateHolidayStatus(h.id, 'inactive', '', HR))).code).toBe('CONFLICT');
    expect((await api.getHolidays({ page: 1, pageSize: 100, filters: { status: 'active' } }, HR)).total).toBe(5);
  });

  it('Leave counts NEW requests with the calendar; existing requests keep their days', async () => {
    const me = { kind: 'own' as const, userId: 'usr-0005', role: 'employee' as const };
    const input = { leaveTypeId: 'lt-01', startDate: '2026-12-06', endDate: '2026-12-10', reason: '', document: null, submit: false };
    const existing = (await leaveApi.getLeaveRequests({ page: 1, pageSize: 100 }, { kind: 'organization', userId: HR.userId, role: HR.role })).items.map((r) => [r.id, r.days]);
    expect((await leaveApi.getLeaveQuote(input, me)).days).toBe(5);
    await api.createHoliday({ date: '2026-12-08', name: { en: 'Example closure', ar: 'إغلاق مثال' }, recurring: false }, '', HR);
    const quote = await leaveApi.getLeaveQuote(input, me);
    expect(quote.days).toBe(4);
    expect(quote.excludedHolidays.map((x) => x.date)).toEqual(['2026-12-08']);
    expect((await leaveApi.getLeaveRequests({ page: 1, pageSize: 100 }, { kind: 'organization', userId: HR.userId, role: HR.role })).items.map((r) => [r.id, r.days])).toEqual(existing);
  });
});
