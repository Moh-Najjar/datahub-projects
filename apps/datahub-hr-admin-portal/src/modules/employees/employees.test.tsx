import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setMockConfig } from '@/core/api/mock/mockConfig';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { employeesApi } from '@/modules/employees/api/employeesApi';
import { renderApp } from '@/test/renderApp';

type User = ReturnType<typeof renderApp>['user'];

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1, name: /Employees|Access denied/ }, { timeout: 5000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 3000 });
  return utils;
}

const directory = () => screen.getByRole('table', { name: 'Employee directory' });
const names = () =>
  within(directory())
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(within(row).getAllByRole('cell')[0]!).getByRole('link').textContent);

async function choose(user: User, label: string | RegExp, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

const setDate = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('access by role (existing permission matrix)', () => {
  it('HR Administrator: enabled sidebar link, whole organization, create action', async () => {
    // Start on a light page (the dashboard would also load ECharts) and navigate with the sidebar.
    const { user } = renderApp('/profile', { as: 'hr-admin' });
    await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
    await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Employees' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Employees' }, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText('1–10 of 248')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New employee' })).toBeTruthy();
    expect(screen.queryByText(/view-only access/)).toBeNull();
  }, 15_000);

  it.each(['system-admin', 'hr-manager'] as const)('%s can create and edit employees', async (role) => {
    await open('/employees', role);
    expect(screen.getByRole('button', { name: 'New employee' })).toBeTruthy();
  });

  it('Payroll Officer: read-only directory and profiles; the Documents tab shows payroll documents only', async () => {
    const { user } = await open('/employees', 'payroll-officer');
    expect(screen.getByText(/view-only access/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New employee' })).toBeNull();
    expect(screen.getByText('1–10 of 248')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: /^Actions for/ })[0]!);
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['View profile']);
    await user.keyboard('{Escape}');

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'dana');
    await user.click(await screen.findByRole('link', { name: 'Dana Yousef' }));
    await screen.findByRole('heading', { level: 2, name: 'Dana Yousef' });
    // Documents Management decides what the payroll role sees (payroll categories only — tested there).
    expect(screen.getByRole('tab', { name: 'Documents' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  });

  it('Payroll Officer cannot open the create form', async () => {
    await open('/employees/new', 'payroll-officer');
    expect(screen.getByText('Your role cannot create or edit employee records.')).toBeTruthy();
  });

  it('Department Manager: own team only (Engineering), read-only, other profiles refused', async () => {
    const { router } = await open('/employees', 'department-manager');
    expect(screen.getByText('Employees in the departments you manage.')).toBeTruthy();
    expect(screen.getByText('1–10 of 62')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New employee' })).toBeNull();
    await router.navigate('/employees/emp-0007');
    expect(await screen.findByText('This employee is not in your team.')).toBeTruthy();
    await router.navigate('/employees/emp-0014');
    expect(await screen.findByRole('heading', { level: 2, name: 'Hani Awad' })).toBeTruthy();
    // Team documents (standard confidentiality, manager-visible categories) — filtered by the Documents API.
    expect(screen.getByRole('tab', { name: 'Documents' })).toBeTruthy();
  });

  it.each(['recruiter', 'employee'] as const)('%s: no Employees item and access denied', async (role) => {
    const spy = vi.spyOn(employeesApi, 'getEmployees');
    await open('/employees', role);
    expect(screen.getByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).queryByText('Employees')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('personal information (hr.employees.view.personal)', () => {
  const RESTRICTED = /Personal information .* is available only to HR roles\./;
  const PERSONAL_LABELS = ['Date of birth', 'Gender', 'Nationality', 'Marital status', 'Personal email', 'Address'];

  it.each([
    ['payroll-officer', '/employees/emp-0014'],
    ['department-manager', '/employees/emp-0014'],
  ] as const)('%s: employment and organization details, but no personal details', async (role, path) => {
    const { user } = await open(path, role);
    await screen.findByRole('heading', { level: 2, name: 'Hani Awad' });
    for (const label of PERSONAL_LABELS) expect(screen.queryByText(label), label).toBeNull();
    expect(screen.getByText(RESTRICTED)).toBeTruthy();
    expect(screen.getByText('EMP-0014', { selector: 'dd *' })).toBeTruthy(); // identity stays
    expect(screen.queryByRole('tab', { name: 'Emergency contact' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Contact' }));
    expect(screen.getByText('hani.awad@staff.datahubhr.test')).toBeTruthy(); // work e-mail stays
    expect(screen.queryByText('Personal email')).toBeNull();
    expect(screen.queryByText('Phone number')).toBeNull();
    expect(screen.getByText(RESTRICTED)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Employment' }));
    expect(screen.getByText('Contract start date')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Organization' }));
    expect(screen.getByRole('link', { name: 'Mobile Development' })).toBeTruthy();
  });

  it('a restricted role cannot reach the emergency contact through the URL', async () => {
    await open('/employees/emp-0014?tab=emergency', 'payroll-officer');
    await screen.findByRole('heading', { level: 2, name: 'Hani Awad' });
    expect(screen.getByRole('tab', { name: 'Personal', selected: true })).toBeTruthy();
    expect(screen.queryByText('Contact name')).toBeNull();
  });

  it.each(['hr-admin', 'hr-manager', 'system-admin'] as const)('%s sees personal details and the emergency contact', async (role) => {
    const { user } = await open('/employees/emp-0014', role);
    await screen.findByRole('heading', { level: 2, name: 'Hani Awad' });
    expect(screen.getByText('Date of birth')).toBeTruthy();
    expect(screen.queryByText(RESTRICTED)).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Emergency contact' }));
    expect(screen.getByText('Contact name')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Contact' }));
    expect(screen.getByText('Personal email')).toBeTruthy();
  });

  it('Arabic: the restriction notice is translated', async () => {
    const { user } = await open('/employees/emp-0014', 'payroll-officer');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByText(/متاحة لأدوار الموارد البشرية فقط/)).toBeTruthy();
  });
});

describe('employee directory', () => {
  it('searches by name, number and e-mail; filters; sorts; paginates', async () => {
    const { user } = await open('/employees');
    const search = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(search, 'dana yousef');
    await waitFor(() => expect(names()).toEqual(['Dana Yousef']));
    await user.clear(search);
    await user.type(search, 'EMP-0007');
    await waitFor(() => expect(names()).toEqual(['Nadia Fares']));
    await user.clear(search);
    await user.type(search, 'laila.masri@');
    await waitFor(() => expect(names()).toEqual(['Laila Masri']));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await choose(user, 'Department', 'Mobile Development');
    await waitFor(() => expect(screen.getByText('1–10 of 10')).toBeTruthy());
    // Position options follow the selected department.
    await user.click(screen.getByRole('combobox', { name: 'Position' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['All positions', 'Mobile Developer']);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await choose(user, 'Employment status', 'Inactive');
    await waitFor(() => expect(screen.getByText('1–10 of 13')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await user.click(screen.getByRole('button', { name: 'No.' }));
    await user.click(screen.getByRole('button', { name: 'No.' }));
    // Descending by employee number: the newest record first.
    await waitFor(() => expect(within(within(directory()).getAllByRole('row')[1]!).getAllByRole('cell')[1]!.textContent).toBe('EMP-0248'));
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByText('11–20 of 248')).toBeTruthy();
  }, 20_000);

  it('shows "no results" for a search without matches', async () => {
    const { user } = await open('/employees');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzzzzz');
    expect(await screen.findByText('No results match your search or filters.')).toBeTruthy();
  });
});

describe('create and edit', () => {
  it('validates, reports duplicates from the API, offers only the department positions, and creates the employee', async () => {
    const { user } = await open('/employees/new');
    expect(screen.getByRole('heading', { level: 2, name: 'New employee' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('New employee')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('Some fields need attention. Please review the highlighted fields.')).toBeTruthy();
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThan(10);
    expect(screen.getByRole('combobox', { name: /^Position/ }).getAttribute('aria-disabled')).toBe('true');

    await user.type(screen.getByRole('textbox', { name: /^Employee number/ }), 'emp-0001');
    await user.type(screen.getByRole('textbox', { name: /^First name \(English\)/ }), 'Test');
    await user.type(screen.getByRole('textbox', { name: /^Last name \(English\)/ }), 'Person');
    await user.type(screen.getByRole('textbox', { name: /^First name \(Arabic\)/ }), 'تجربة');
    await user.type(screen.getByRole('textbox', { name: /^Last name \(Arabic\)/ }), 'شخص');
    setDate(/^Date of birth/, '1995-04-12');
    await choose(user, /^Gender/, 'Female');
    await choose(user, /^Nationality/, 'Jordan');
    await choose(user, /^Marital status/, 'Single');
    await user.type(screen.getByRole('textbox', { name: /^Work email/ }), 'dana.yousef@staff.datahubhr.test');
    await user.type(screen.getAllByRole('textbox', { name: /^Phone number/ })[0]!, '+962 79 000 1234');
    await user.type(screen.getByRole('textbox', { name: /^Address/ }), 'Building 1');
    await user.type(screen.getByRole('textbox', { name: /^City/ }), 'Amman');
    await choose(user, /^Country/, 'Jordan');
    setDate(/^Hire date/, '2026-09-01');
    await choose(user, /^Employment type/, 'Full-time');
    setDate(/^Contract start date/, '2026-09-01');

    await choose(user, /^Department/, /Quality Assurance/);
    await user.click(screen.getByRole('combobox', { name: /^Position/ }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent).filter((o) => o !== 'Select…')).toEqual(['QA Engineer', 'QA Lead']);
    await user.click(screen.getByRole('option', { name: 'QA Engineer' }));
    await choose(user, /^Work location/, 'Amman Headquarters');
    await user.type(screen.getByRole('combobox', { name: 'Direct manager' }), 'Nour');
    await user.click(await screen.findByRole('option', { name: /Nour Haddadin/ }, { timeout: 3000 }));
    await user.type(screen.getByRole('textbox', { name: /^Contact name/ }), 'Sam Person');
    await choose(user, /^Relationship/, 'Parent');
    await user.type(screen.getAllByRole('textbox', { name: /^Phone number/ })[1]!, '+962 78 000 9999');

    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findAllByText('Already used by another employee.')).toHaveLength(2); // number + e-mail

    await user.clear(screen.getByRole('textbox', { name: /^Employee number/ }));
    await user.type(screen.getByRole('textbox', { name: /^Employee number/ }), 'emp-9001');
    await user.clear(screen.getByRole('textbox', { name: /^Work email/ }));
    await user.type(screen.getByRole('textbox', { name: /^Work email/ }), 'test.person@staff.datahubhr.test');
    await user.click(screen.getByRole('button', { name: 'Create employee' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Test Person' }, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('Employee created.')).toBeTruthy();
    expect(screen.getByText('QA Engineer · Quality Assurance')).toBeTruthy();
  }, 30_000);

  it('editing: changing the department clears the position; changes appear in the employment history', async () => {
    const { user } = await open('/employees/emp-0050/edit');
    await screen.findByRole('heading', { level: 2, name: /^Edit employee:/ });
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Edit')).toBeTruthy();
    await choose(user, /^Department/, /Data & Analytics/);
    expect(screen.getByRole('combobox', { name: /^Position/ }).textContent).not.toMatch(/\w/);
    await choose(user, /^Position/, 'Data Analyst');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Employee updated.', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/Data Analyst · Data & Analytics/)).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(await screen.findByText('Department changed')).toBeTruthy();
  }, 20_000);
});

describe('status changes', () => {
  it('explains why a department manager cannot be deactivated', async () => {
    const { user } = await open('/employees/emp-0001');
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Deactivate Dana Yousef?' }));
    await user.click(dialog.getByRole('button', { name: 'Deactivate' }));
    expect(await dialog.findByText(/manages a department/)).toBeTruthy();
  });

  it('deactivates and re-activates from the directory', async () => {
    const { user } = await open('/employees');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'lina haddad');
    await user.click(await screen.findByRole('button', { name: 'Actions for Lina Haddad' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Deactivate Lina Haddad?' })).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Lina Haddad is now inactive.')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole('link', { name: 'Lina Haddad' }).closest('tr')!).getByText('Inactive')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Actions for Lina Haddad' }));
    await user.click(screen.getByRole('menuitem', { name: 'Activate' }));
    expect(await screen.findByText('Lina Haddad is now active.')).toBeTruthy();
  });
});

describe('profile', () => {
  it('header, breadcrumbs and sections', async () => {
    const { user } = await open('/employees/emp-0013');
    expect(screen.getByRole('heading', { level: 2, name: 'Laila Masri' })).toBeTruthy();
    expect(screen.getAllByText('EMP-0013').length).toBeGreaterThan(0);
    expect(screen.getByText('Senior Software Engineer · Software Development')).toBeTruthy();
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Employees' })).toBeTruthy();
    expect(crumbs.getByText('Laila Masri').getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('First name (Arabic)').nextSibling?.textContent).toBe('ليلى');

    await user.click(screen.getByRole('tab', { name: 'Contact' }));
    expect(screen.getByText('laila.masri@staff.datahubhr.test').closest('[dir="ltr"]')).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Organization' }));
    expect(screen.getByRole('link', { name: 'Dana Yousef' })).toBeTruthy(); // direct manager
    expect(screen.getByRole('link', { name: 'Software Development' })).toBeTruthy(); // to Organization Management
    await user.click(screen.getByRole('tab', { name: 'Emergency contact' }));
    expect(screen.getByText('Relationship')).toBeTruthy();
  });

  it('documents tab: Documents Management records, the checklist and a clearly simulated upload', async () => {
    const { user } = await open('/employees/emp-0001?tab=documents');
    expect(await screen.findByText(/file contents are not stored/, {}, { timeout: 8000 })).toBeTruthy();
    expect((await screen.findAllByText('Employment contract')).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-document-status]').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('list', { name: 'Required documents' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Upload document (simulated)' }));
    expect(dialog.getByText(/Their content is not sent or stored/)).toBeTruthy();
    await choose(user, /^Category/, 'Training Certificate');
    await user.upload(dialog.getByTestId('document-file-input'), new File(['x'], 'first-aid.pdf', { type: 'application/pdf' }));
    expect(dialog.getByText('first-aid.pdf')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByText(/saved \(simulated upload, pending review\)/, {}, { timeout: 5000 })).toBeTruthy();
    expect((await screen.findAllByText('Training Certificate')).length).toBeGreaterThan(0);
  });

  it('employment history', async () => {
    await open('/employees/emp-0001?tab=history');
    expect(await screen.findByText('Joined the organization')).toBeTruthy();
    expect(document.querySelector('[data-history="joined"]')?.textContent).toContain('Engineering');
  });

  it('unknown employee: not-found message', async () => {
    await open('/employees/emp-9999');
    expect(await screen.findByText('This employee does not exist or was removed.')).toBeTruthy();
  });
});

describe('loading, error and empty states', () => {
  it('shows loading placeholders', async () => {
    setMockConfig({ delayMs: { min: 300, max: 300 } });
    renderApp('/employees', { as: 'hr-admin' });
    expect((await screen.findAllByRole('status', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('1–10 of 248')).toBeTruthy(), { timeout: 4000 });
  });

  it('shows an error with retry, then recovers', async () => {
    const spy = vi.spyOn(employeesApi, 'getEmployees').mockRejectedValue(new ApiError('SERVER'));
    const { user } = renderApp('/employees', { as: 'hr-admin' });
    const alert = await screen.findByText('This list could not be loaded.', {}, { timeout: 5000 });
    spy.mockRestore();
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1–10 of 248')).toBeTruthy();
  });

  it('shows an empty state', async () => {
    vi.spyOn(employeesApi, 'getEmployees').mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    await open('/employees');
    expect(screen.getByText('Nothing has been added yet.')).toBeTruthy();
  });
});

describe('language and theme', () => {
  it('Arabic: RTL, Arabic names, e-mails and numbers kept left-to-right, Latin digits', async () => {
    const { user } = await open('/employees');
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'الموظفون' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    const table = await screen.findByRole('table', { name: 'دليل الموظفين' });
    await waitFor(() => expect(within(table).getAllByRole('link').every((a) => /[؀-ۿ]/.test(a.textContent ?? ''))).toBe(true));
    expect(within(table).getAllByText(/^EMP-\d{4}$/)[0]!.getAttribute('dir')).toBe('ltr');
    expect(screen.getByText('1–10 من 248')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
  });

});
