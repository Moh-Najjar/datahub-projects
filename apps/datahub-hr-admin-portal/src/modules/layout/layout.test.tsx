import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COLOR_MODE_STORAGE_KEY } from '@/core/theme/AppThemeProvider';
import { renderApp } from '@/test/renderApp';
import { setViewportWidth } from '@/test/matchMedia';

const navigation = async () => within(await screen.findByRole('navigation', { name: 'Main navigation' }));

describe('role-based navigation (sidebar)', () => {
  it('System Administrator: every page is a link (no planned "Soon" items left)', async () => {
    renderApp('/dashboard', { as: 'system-admin' });
    const nav = await navigation();
    expect(nav.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('link', { name: 'My profile' })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Users & roles' })).toBeTruthy();
    expect(nav.queryByText('Soon')).toBeNull();
  });

  it('Employee: no dashboard, no admin areas', async () => {
    renderApp('/profile', { as: 'employee' });
    const nav = await navigation();
    expect(nav.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    // Own payslips only (My payroll): every staff member has hr.payroll.view.own.
    expect(nav.getByRole('link', { name: 'Payroll' })).toBeTruthy();
    expect(nav.queryByText('Settings')).toBeNull();
    expect(nav.getByRole('link', { name: 'My profile' })).toBeTruthy();
  });

  it('Recruiter: recruitment visible, employees hidden; payroll only as own payslips', async () => {
    renderApp('/dashboard', { as: 'recruiter' });
    const nav = await navigation();
    expect(nav.getByText('Recruitment')).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Payroll' })).toBeTruthy();
    expect(nav.queryByText('Employees')).toBeNull();
  });
});

describe('permission guards', () => {
  it('shows access denied (URL unchanged) when the role lacks the permission', async () => {
    const { router } = renderApp('/dashboard', { as: 'employee' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Access denied' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('renders the page when the role has the permission', async () => {
    renderApp('/dashboard', { as: 'department-manager' });
    // First render lazy-loads the dashboard and ECharts (slower while all test files run in parallel).
    expect(await screen.findByRole('heading', { level: 1, name: /Dana Yousef/ }, { timeout: 5000 })).toBeTruthy();
  });

  it('shows the not-found page for unknown URLs inside the shell', async () => {
    renderApp('/no-such-page', { as: 'hr-admin' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
  });

  it('shows breadcrumbs for the current page', async () => {
    renderApp('/profile', { as: 'hr-admin' });
    const crumbs = within(await screen.findByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/dashboard');
    expect(crumbs.getByText('My profile').getAttribute('aria-current')).toBe('page');
  });
});

describe('theme switching', () => {
  it('defaults to light; switching to dark updates the page and remembers the choice', async () => {
    const { user } = renderApp('/dashboard', { as: 'hr-admin' });
    await user.click(await screen.findByRole('button', { name: 'Switch to dark mode' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark'));
    expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light'));
  });

  it('starts in light mode when nothing is stored', async () => {
    renderApp('/login');
    await screen.findByRole('button', { name: 'Switch to dark mode' });
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light');
  });
});

describe('English LTR / Arabic RTL', () => {
  it('switches the sign-in page to Arabic, right-to-left', async () => {
    const { user } = renderApp('/login');
    expect(document.documentElement.dir).toBe('ltr');
    await user.click(await screen.findByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'تسجيل الدخول' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(screen.getByText('بيانات تجريبية — سجلات موارد بشرية محاكاة')).toBeTruthy();
  });

  it('renders the app shell in Arabic (navigation, breadcrumbs, roles)', async () => {
    const { user } = renderApp('/dashboard', { as: 'hr-manager' });
    await user.click(await screen.findByRole('button', { name: 'Switch to العربية' }));
    const nav = within(await screen.findByRole('navigation', { name: 'التنقل الرئيسي' }));
    expect(nav.getByRole('link', { name: 'لوحة المعلومات' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'مسار التنقل' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
  });
});

describe('mobile navigation', () => {
  it('uses a menu button and a drawer below the md breakpoint', async () => {
    setViewportWidth(390);
    const { user } = renderApp('/dashboard', { as: 'hr-admin' });
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }));
    const nav = await navigation();
    await user.click(nav.getByRole('link', { name: 'My profile' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeTruthy();
  });
});
