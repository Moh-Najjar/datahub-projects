import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { organizationApi } from '@/modules/organization/api/organizationApi';
import { renderApp } from '@/test/renderApp';

type User = ReturnType<typeof renderApp>['user'];

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /Organization|Access denied/ }, { timeout: 5000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 3000 });
  return utils;
}

const table = (name: string) => screen.getByRole('table', { name });
/** First-column text of each body row. */
const firstColumn = (name: string) =>
  within(table(name))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]!.textContent);

async function choose(user: User, label: string | RegExp, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('access by role (existing permission matrix)', () => {
  it('HR Administrator: Organization is an enabled sidebar link; overview totals; create actions', async () => {
    // Start on a light page (the dashboard would also load ECharts) and navigate with the sidebar.
    const { user } = renderApp('/profile', { as: 'hr-admin' });
    await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
    const link =within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Organization' });
    await user.click(link);
    // The click lazy-loads the Organization chunk (slower while all test files run in parallel).
    expect(await screen.findByRole('heading', { level: 1, name: 'Organization' }, { timeout: 5000 })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-summary="units"]')?.textContent).toBe('23'));
    expect(['departments', 'positions', 'locations'].map((k) => document.querySelector(`[data-summary="${k}"]`)?.textContent)).toEqual(['8', '36', '6']);
    await user.click(screen.getByRole('tab', { name: 'Departments' }));
    expect(await screen.findByRole('button', { name: 'New department' })).toBeTruthy();
    expect(screen.queryByText(/view-only access/)).toBeNull();
  }, 15_000);

  it.each(['system-admin', 'hr-manager'] as const)('%s can manage the structure', async (role) => {
    await open('/organization/locations', role);
    expect(screen.getByRole('button', { name: 'New location' })).toBeTruthy();
  });

  it('Recruiter: read-only (organization:read without organization:write)', async () => {
    const { user } = await open('/organization/departments', 'recruiter');
    expect(screen.getByText(/view-only access/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New department' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Actions for Engineering' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['View details']);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('tab', { name: 'Positions' }));
    await screen.findByRole('table', { name: 'Positions' });
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New position' })).toBeNull();
  });

  it.each(['department-manager', 'payroll-officer', 'employee'] as const)('%s: no Organization item and access denied', async (role) => {
    const spy = vi.spyOn(organizationApi, 'getOrganizationSummary');
    await open('/organization', role);
    expect(screen.getByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).queryByText('Organization')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('unfinished modules stay disabled "Soon" items', async () => {
    await open('/organization');
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    for (const name of ['Payroll', 'Documents', 'Reports']) {
      expect(nav.getByText(name).closest('[aria-disabled="true"]'), name).not.toBeNull();
    }
    expect(nav.getByRole('link', { name: 'Employees' })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Attendance' })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Leave' })).toBeTruthy();
  });
});

describe('departments list', () => {
  it('searches, filters, sorts and paginates (server-side)', async () => {
    const { user } = await open('/organization/departments');
    expect(screen.getByText('1–10 of 23')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByText('11–20 of 23')).toBeTruthy();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'sales');
    await waitFor(() => expect(firstColumn('Departments')).toEqual(['Channel Sales', 'Enterprise Sales', 'Sales']));
    expect(screen.getByText('1–3 of 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await choose(user, 'Status', 'Inactive');
    await waitFor(() => expect(firstColumn('Departments')).toEqual(['Research Lab']));
    await choose(user, 'Status', 'All statuses');

    await choose(user, 'Parent department', 'Top-level departments only');
    await waitFor(() => expect(screen.getByText('1–8 of 8')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Employees' }));
    await user.click(screen.getByRole('button', { name: 'Employees' }));
    await waitFor(() => expect(firstColumn('Departments')[0]).toBe('Customer Support'));
    expect(within(table('Departments')).getByRole('columnheader', { name: /Employees/ }).getAttribute('aria-sort')).toBe('descending');
  });

  it('shows "no results" for a search with no match', async () => {
    const { user } = await open('/organization/departments');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzzz');
    expect(await screen.findByText('No results match your search or filters.')).toBeTruthy();
  });
});

describe('department forms', () => {
  it('validates, reports a duplicate code from the API, then creates the department', async () => {
    const { user } = await open('/organization/departments');
    await user.click(screen.getByRole('button', { name: 'New department' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New department' }));
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(dialog.getAllByText('This field is required.')).toHaveLength(3);

    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'eng');
    await user.type(dialog.getByRole('textbox', { name: /^Name \(English\)/ }), 'Platform Engineering');
    await user.type(dialog.getByRole('textbox', { name: /^Name \(Arabic\)/ }), 'Platform');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await dialog.findByText('Enter the name in Arabic.')).toBeTruthy();

    await user.clear(dialog.getByRole('textbox', { name: /^Name \(Arabic\)/ }));
    await user.type(dialog.getByRole('textbox', { name: /^Name \(Arabic\)/ }), 'هندسة المنصات');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await dialog.findByText('This code is already used. Choose a different code.')).toBeTruthy();

    await user.clear(dialog.getByRole('textbox', { name: /^Code/ }));
    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'plat');
    await choose(user, 'Parent department', 'Engineering');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Department created.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'plat');
    await waitFor(() => expect(firstColumn('Departments')).toEqual(['Platform Engineering']));
  });

  it('the parent selector excludes the department itself and its subdepartments (no cycles)', async () => {
    const { user } = await open('/organization/departments/dep-eng');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog', { name: 'Edit department' });
    await user.click(screen.getByRole('combobox', { name: 'Parent department' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toContain('Sales');
    for (const own of ['Engineering', 'Software Development', 'Mobile Development', 'Quality Assurance']) expect(options, own).not.toContain(own);
  });

  it('inactive departments are listed but cannot be chosen as parent', async () => {
    const { user } = await open('/organization/departments');
    await user.click(screen.getByRole('button', { name: 'New department' }));
    await screen.findByRole('dialog', { name: 'New department' });
    await user.click(screen.getByRole('combobox', { name: 'Parent department' }));
    expect((await screen.findByRole('option', { name: 'Research Lab (inactive)' })).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('option', { name: 'Customer Support' }).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('assigns a manager from the details page', async () => {
    const { user } = await open('/organization/departments/dep-sales-chn');
    expect(screen.getByText('No manager assigned')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Assign manager' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Assign department manager' }));
    await user.type(dialog.getByRole('combobox', { name: 'Department manager' }), 'Rania');
    await user.click(await screen.findByRole('option', { name: /Rania Saad/ }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Department updated.')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Rania Saad')).toBeTruthy());
  });
});

describe('status changes', () => {
  it('deactivation asks for confirmation and explains hierarchy rule violations', async () => {
    const { user } = await open('/organization/departments/dep-eng');
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Deactivate Engineering?' }));
    await user.click(dialog.getByRole('button', { name: 'Deactivate' }));
    expect(await dialog.findByText(/has active subdepartments/)).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
  });

  it('deactivates and re-activates from the list', async () => {
    const { user } = await open('/organization/departments');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'marketing');
    await user.click(await screen.findByRole('button', { name: 'Actions for Marketing' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Deactivate Marketing?' })).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Marketing is now inactive.')).toBeTruthy();
    const row = () => screen.getByRole('link', { name: 'Marketing' }).closest('tr')!;
    await waitFor(() => expect(within(row()).getByText('Inactive')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Actions for Marketing' }));
    await user.click(screen.getByRole('menuitem', { name: 'Activate' }));
    expect(await screen.findByText('Marketing is now active.')).toBeTruthy();
  });
});

describe('hierarchy', () => {
  it('expands and collapses levels; expand all; hides inactive units', async () => {
    const { user } = await open('/organization/hierarchy');
    const tree = () => within(screen.getByRole('list', { name: 'Department hierarchy' }));
    // Top level expanded by default: children visible, grandchildren not.
    expect(tree().getByRole('link', { name: 'Software Development' })).toBeTruthy();
    expect(tree().queryByRole('link', { name: 'Mobile Development' })).toBeNull();

    const expandSwd = tree().getByRole('button', { name: 'Expand Software Development' });
    expect(expandSwd.getAttribute('aria-expanded')).toBe('false');
    await user.click(expandSwd);
    expect(tree().getByRole('link', { name: 'Mobile Development' })).toBeTruthy();

    await user.click(tree().getByRole('button', { name: 'Collapse Engineering' }));
    expect(tree().queryByRole('link', { name: 'Software Development' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(tree().getByRole('link', { name: 'Mobile Development' })).toBeTruthy();
    expect(tree().getByText('Employees: 58')).toBeTruthy(); // Engineering incl. subdepartments = dashboard figure
    expect(tree().getByRole('link', { name: 'Research Lab' })).toBeTruthy();

    await user.click(screen.getByRole('switch', { name: 'Show inactive units' }));
    expect(tree().queryByRole('link', { name: 'Research Lab' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(tree().queryByRole('link', { name: 'Software Development' })).toBeNull();
  });
});

describe('details, positions and locations', () => {
  it('department details: manager, totals, subdepartments and positions', async () => {
    await open('/organization/departments/dep-eng');
    expect(screen.getByRole('heading', { level: 2, name: 'Engineering' })).toBeTruthy();
    expect(screen.getByText('Dana Yousef')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Employees (incl. subdepartments)').nextSibling?.textContent).toBe('58'));
    const subs = within(screen.getByRole('region', { name: 'Subdepartments' }));
    expect(subs.getByRole('link', { name: 'Quality Assurance' })).toBeTruthy();
    expect(await screen.findByText('Senior Data Engineer')).toBeTruthy();
  });

  it('unknown department: not-found message', async () => {
    await open('/organization/departments/dep-missing');
    expect(await screen.findByText('This department does not exist or was removed.')).toBeTruthy();
  });

  it('positions: filter by employment level; create with validation', async () => {
    const { user } = await open('/organization/positions');
    await choose(user, 'Employment level', 'Director');
    await waitFor(() => expect(firstColumn('Positions')).toEqual(['Head of Sales', 'Operations Director']));

    await user.click(screen.getByRole('button', { name: 'New position' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New position' }));
    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'ops-dir');
    await user.type(dialog.getByRole('textbox', { name: /^Title \(English\)/ }), 'Director of Operations');
    await user.type(dialog.getByRole('textbox', { name: /^Title \(Arabic\)/ }), 'مدير العمليات التنفيذي');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(dialog.getAllByText('This field is required.')).toHaveLength(2); // department + level
    await choose(user, /^Department/, 'Operations');
    await choose(user, /^Employment level/, 'Director');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await dialog.findByText('This code is already used. Choose a different code.')).toBeTruthy();
  });

  it('locations: create, then open the details page', async () => {
    const { user } = await open('/organization/locations');
    await user.click(screen.getByRole('button', { name: 'New location' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New location' }));
    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'doh-01');
    await user.type(dialog.getByRole('textbox', { name: /^Name \(English\)/ }), 'Doha Office');
    await user.type(dialog.getByRole('textbox', { name: /^Name \(Arabic\)/ }), 'مكتب الدوحة');
    await user.type(dialog.getByRole('textbox', { name: /^Address/ }), 'West Bay, Tower 2');
    await user.type(dialog.getByRole('textbox', { name: /^City/ }), 'Doha');
    await choose(user, /^Country/, 'Qatar');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Location created.')).toBeTruthy();

    await user.click(await screen.findByRole('link', { name: 'Doha Office' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Doha Office' })).toBeTruthy();
    expect(screen.getAllByText('DOH-01').length).toBeGreaterThan(0);
    expect(screen.getByText('Qatar')).toBeTruthy();
  });
});

describe('loading, error and empty states', () => {
  it('shows loading placeholders while the list loads', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    renderApp('/organization/departments', { as: 'hr-admin' });
    expect((await screen.findAllByRole('status', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('1–10 of 23')).toBeTruthy(), { timeout: 4000 });
  });

  it('shows an error with retry, then recovers', async () => {
    const spy = vi.spyOn(organizationApi, 'getLocations').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/organization/locations', { as: 'hr-admin' });
    const alert = await screen.findByText('This list could not be loaded.', {}, { timeout: 5000 });
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Amman Headquarters' })).toBeTruthy();
  });

  it('shows an empty state when nothing exists yet', async () => {
    vi.spyOn(organizationApi, 'getLocations').mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    await open('/organization/locations');
    expect(screen.getByText('Nothing has been added yet.')).toBeTruthy();
  });
});

describe('language and theme', () => {
  it('Arabic: RTL, translated tabs, columns and data, Latin digits', async () => {
    const { user } = await open('/organization/departments');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'الهيكل التنظيمي' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('tab', { name: 'الأقسام' }).getAttribute('aria-selected')).toBe('true');
    const departments = await screen.findByRole('table', { name: 'الأقسام' });
    expect(within(departments).getByRole('columnheader', { name: /الموظفون/ })).toBeTruthy();
    // Names (and their sort order) follow the language.
    await waitFor(() => expect(firstColumn('الأقسام').every((name) => /[؀-ۿ]/.test(name ?? ''))).toBe(true));
    expect(screen.getByText('1–10 من 23')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
  });

  it('dark mode applies to the module', async () => {
    const { user } = await open('/organization');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark'));
    expect(screen.getByRole('heading', { level: 1, name: 'Organization' })).toBeTruthy();
  });
});
