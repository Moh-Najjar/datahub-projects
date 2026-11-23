import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/core/config/permissions';
import { usersApi } from '@/modules/users/api/usersApi';
import { renderApp } from '@/test/renderApp';

/* Users & Roles UI on a fixed clock: Monday 16 Nov 2026, 10:30. Only Date is faked. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const ADMIN = { userId: 'usr-0001', role: 'system-admin' as const, name: { en: 'Omar Khalil', ar: 'عمر خليل' } };
type User = ReturnType<typeof renderApp>['user'];
const settled = () => waitFor(() => expect(screen.queryAllByRole('status').filter((s) => !s.closest('.MuiSnackbar-root') && s.getAttribute('aria-live') !== 'polite')).toHaveLength(0), { timeout: 10_000 });
async function open(path: string, role: Role = 'system-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 });
  await settled();
  return utils;
}
async function confirmWithReason(user: User, button: string, reason?: string) {
  const dialog = await screen.findByRole('dialog');
  if (reason) await user.type(within(dialog).getByRole('textbox', { name: /Reason for the change/ }), reason);
  await user.click(within(dialog).getByRole('button', { name: button }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('access', () => {
  it('System Administrator: Users & roles in the navigation, three sections', async () => {
    await open('/users');
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Users & roles' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Users & roles sections' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Users', 'Roles', 'Permissions']);
    expect(await screen.findByRole('link', { name: 'Open Dana Yousef' })).toBeTruthy();
  }, 30_000);

  it.each(['hr-admin', 'hr-manager', 'department-manager', 'employee', 'recruiter', 'payroll-officer'] as const)('%s: no navigation item, access denied', async (role) => {
    await open('/users', role);
    expect(screen.getByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).queryByRole('link', { name: 'Users & roles' })).toBeNull();
  }, 30_000);
});

describe('accounts', () => {
  it('searches and filters the directory', async () => {
    const { user } = await open('/users');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'EMP-0025');
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Open Dana Yousef' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Open Sami Odeh' })).toBeTruthy();
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  }, 30_000);

  it('creates an account and opens it', async () => {
    const { user } = await open('/users');
    await user.click(screen.getByRole('button', { name: 'New user' }));
    const dialog = await screen.findByRole('dialog', { name: 'New user account' });
    await user.type(within(dialog).getByRole('textbox', { name: /Name \(English\)/ }), 'Nour Test');
    await user.type(within(dialog).getByRole('textbox', { name: /Name \(Arabic\)/ }), 'نور تجربة');
    await user.type(within(dialog).getByRole('textbox', { name: /Work e-mail/ }), 'hr.admin@demo.datahubhr.test');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(await within(dialog).findByText('Another account already uses this e-mail address.')).toBeTruthy();
    const email = within(dialog).getByRole('textbox', { name: /Work e-mail/ });
    await user.clear(email);
    await user.type(email, 'nour.test@demo.datahubhr.test');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Account created for Nour Test.')).toBeTruthy();
    expect(screen.getByText('Created here — needs a DataHub Portals account to sign in')).toBeTruthy();
  }, 40_000);

  it('own account: role and status cannot be changed', async () => {
    await open('/users/accounts/usr-0001');
    expect(screen.getByText(/You cannot change your own role or status/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull();
  }, 30_000);

  it('changes a role and deactivates an account, each confirmed with a reason; the history shows both', async () => {
    const { user } = await open('/users/accounts/usr-0005');
    await user.click(screen.getByRole('button', { name: 'Change role' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'New role' }));
    await user.click(await screen.findByRole('option', { name: 'HR Manager' }));
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }));
    expect(within(dialog).getByText('Enter a reason.')).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the change/ }), 'Promotion');
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Role changed.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await confirmWithReason(user, 'Deactivate', 'Left the company');
    expect(await screen.findByText('Inactive')).toBeTruthy();
    expect(await screen.findByText(/Left the company/)).toBeTruthy();
    expect(screen.getByText(/Promotion/)).toBeTruthy();
    expect((await usersApi.getUserById('usr-0005', ADMIN)).status).toBe('inactive');
  }, 40_000);

  it('unlinks an employee after confirmation', async () => {
    const { user } = await open('/users/accounts/usr-0007');
    expect(screen.getByRole('link', { name: /EMP-0005/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Unlink employee' }));
    await confirmWithReason(user, 'Unlink employee', 'Account re-provisioned');
    expect(await screen.findByText(/This account is not linked to an employee record/)).toBeTruthy();
  }, 30_000);
});

describe('roles and permissions', () => {
  it('lists the seven system roles', async () => {
    await open('/users/roles');
    const table = screen.getByRole('table', { name: 'Roles' });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    expect(within(table).getByText('Always every permission')).toBeTruthy();
  }, 30_000);

  it('is read-only: roles come from the backend; no checkboxes, a role can be highlighted', async () => {
    await open('/users/permissions?role=recruiter');
    expect(await screen.findByText(/Read-only: roles and their permissions are managed in the DataHub backend/)).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Recruiter: Manage recruitment — ✓' })).toBeTruthy();
    expect(screen.getByText('hr.payroll.approve')).toBeTruthy();
  }, 30_000);

  it('the System Administrator column and self-service permissions are locked', async () => {
    await open('/users/permissions?role=employee');
    expect(screen.queryByRole('checkbox', { name: 'System Administrator: Approve payroll' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Employee: View own profile' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Employee: View own profile — ✓' })).toBeTruthy();
  }, 30_000);
});

describe('Arabic and RTL', () => {
  it('translated, right-to-left; e-mail addresses and permission identifiers stay left-to-right', async () => {
    const { user } = await open('/users/permissions');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'المستخدمون والأدوار' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    const id = screen.getByText('hr.payroll.approve');
    expect(id.getAttribute('dir')).toBe('ltr');
  }, 30_000);
});
