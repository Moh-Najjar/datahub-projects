import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/core/config/permissions';
import { settingsApi } from '@/modules/settings/api/settingsApi';
import { renderApp } from '@/test/renderApp';

/* System Settings UI on a fixed clock: Monday 16 Nov 2026, 10:30. Only Date is faked. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const HR = { userId: 'usr-0002', role: 'hr-admin' as const, name: { en: 'Lina Haddad', ar: 'لينا حداد' } };
const settled = () => waitFor(() => expect(screen.queryAllByRole('status').filter((s) => !s.closest('.MuiSnackbar-root'))).toHaveLength(0), { timeout: 10_000 });
async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 });
  await settled();
  return utils;
}
async function confirmDialog(user: ReturnType<typeof renderApp>['user'], button: string, reason?: string) {
  const dialog = await screen.findByRole('dialog');
  if (reason) await user.type(within(dialog).getByRole('textbox', { name: /Reason for the change/ }), reason);
  await user.click(within(dialog).getByRole('button', { name: button }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('access', () => {
  it('System and HR Administrators see the settings; other roles are refused', async () => {
    await open('/settings', 'system-admin');
    const nav = within(screen.getByRole('navigation', { name: 'Settings categories' }));
    expect(nav.getAllByRole('link')).toHaveLength(14);
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Settings' })).toBeTruthy();
  }, 30_000);

  it.each(['hr-manager', 'department-manager', 'employee', 'recruiter', 'payroll-officer'] as const)('%s: access denied', async (role) => {
    await open('/settings', role);
    expect(screen.getByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
  }, 30_000);

  it('HR Administrator: sign-in & session settings are read-only', async () => {
    await open('/settings/security');
    expect(screen.getByText('Only a System Administrator can change these settings.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect((screen.getByRole('spinbutton', { name: /Session length/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Reset settings to demo defaults' })).toBeNull();
  }, 30_000);
});

describe('editing', () => {
  it('validates, confirms with a reason, saves and records the change in the audit log', async () => {
    const { user } = await open('/settings/general');
    const email = screen.getByRole('textbox', { name: /Contact e-mail/ });
    await user.clear(email);
    await user.type(email, 'not-valid');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid e-mail address.')).toBeTruthy();
    await user.clear(email);
    await user.type(email, 'people@demo.datahubhr.test');
    expect(screen.getByText('You have unsaved changes.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await confirmDialog(user, 'Save changes', 'New team mailbox');
    expect(await screen.findByText('Settings saved.')).toBeTruthy();
    const log = await settingsApi.getAuditLog({ page: 1, pageSize: 5 }, HR);
    expect(log.items[0]).toMatchObject({ target: 'general.contactEmail', previous: 'hr@demo.datahubhr.test', next: 'people@demo.datahubhr.test', reason: 'New team mailbox' });

    await user.click(screen.getByRole('link', { name: 'All settings' }));
    expect(await screen.findByRole('heading', { name: 'Recently changed' })).toBeTruthy();
    expect(await screen.findByText('general.contactEmail')).toBeTruthy();
  }, 40_000);

  it('restores the defaults after confirmation', async () => {
    await settingsApi.updateSettings('localization', { defaultLanguage: 'ar', dateFormat: 'yyyy-mm-dd', timeFormat: '12h', currencyDisplay: 'symbol', weekStart: 6, timezone: 'UTC' }, '', HR);
    const { user } = await open('/settings/localization');
    await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
    await confirmDialog(user, 'Restore defaults');
    expect(await screen.findByText('Defaults restored.')).toBeTruthy();
    expect((await settingsApi.getSettings('localization', HR)).values.timezone).toBe('Asia/Amman');
  }, 30_000);

  it('adds a public holiday and deactivates it', async () => {
    const { user } = await open('/settings/calendar');
    await user.click(screen.getByRole('button', { name: 'Add holiday' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a public holiday' });
    fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: '2026-12-24' } });
    await user.type(within(dialog).getByRole('textbox', { name: /Name \(English\)/ }), 'Winter break (example)');
    await user.type(within(dialog).getByRole('textbox', { name: /Name \(Arabic\)/ }), 'عطلة الشتاء (مثال)');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('cell', { name: 'Winter break (example)' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Deactivate: Winter break (example)' }));
    await confirmDialog(user, 'Deactivate');
    await waitFor(() => expect(within(screen.getByRole('cell', { name: 'Winter break (example)' }).closest('tr')!).getByText('Inactive')).toBeTruthy());
  }, 40_000);

  it('new shifts start with the organisation’s working week', async () => {
    await settingsApi.updateSettings('workingWeek', { workDays: [1, 2, 3, 4, 5] }, '', HR);
    const { user } = renderApp('/attendance/shifts', { as: 'hr-admin' });
    await user.click(await screen.findByRole('button', { name: /New shift|Add shift|Create shift/ }, { timeout: 10_000 }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect((within(dialog).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true));
    expect((within(dialog).getByRole('checkbox', { name: 'Sunday' }) as HTMLInputElement).checked).toBe(false);
    expect((within(dialog).getByRole('checkbox', { name: 'Friday' }) as HTMLInputElement).checked).toBe(true);
  }, 30_000);
});

describe('module configuration and notices', () => {
  it('summaries link to the module that owns the configuration', async () => {
    await open('/settings/leave');
    expect(await screen.findByRole('cell', { name: 'Annual Leave' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage in Leave' }).getAttribute('href')).toBe('/leave/types');
  }, 30_000);

  it('notifications say clearly that nothing is delivered yet', async () => {
    await open('/settings/notifications');
    expect(screen.getByText(/no e-mail or SMS provider is connected/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'On: Leave request submitted' })).toBeTruthy();
  }, 30_000);

  it('System Administrator: audit log with the demo reset', async () => {
    const { user } = await open('/settings/audit', 'system-admin');
    await user.click(screen.getByRole('button', { name: 'Reset settings to demo defaults' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset settings to demo defaults' }));
    expect(within(dialog).getByText('Enter a reason.')).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the change/ }), 'Fresh demo');
    await user.click(within(dialog).getByRole('button', { name: 'Reset settings to demo defaults' }));
    expect(await screen.findByText('Settings reset to the demo defaults.')).toBeTruthy();
    expect(await screen.findByRole('cell', { name: 'Fresh demo' })).toBeTruthy();
  }, 30_000);
});

describe('Arabic and RTL', () => {
  it('translated and right-to-left; identifiers stay left-to-right', async () => {
    const { user } = await open('/settings');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'إعدادات النظام' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('link', { name: /أيام العمل والعطل/ })).toBeTruthy();
    const currency = screen.getByText('JOD');
    expect(currency.getAttribute('dir')).toBe('ltr');
  }, 30_000);
});
