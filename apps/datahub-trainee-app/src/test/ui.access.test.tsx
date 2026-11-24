import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { SESSION_STORAGE_KEY } from '@/core/auth/authContext';
import { renderApp } from './renderApp';

const navLinks = async () => {
  const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
  return within(nav).getAllByRole('link').map((a) => a.textContent);
};
const denied = () => screen.findByText("You don't have access to this page");

describe('role-based navigation', () => {
  it('SuperAdmin sees every area, including Departments', async () => {
    renderApp('/dashboard', { as: U.superAdmin });
    expect(await navLinks()).toEqual(['Dashboard', 'Trainings', 'Certificates', 'Enrollments', 'Users', 'Departments', 'Rankings']);
  });

  it('DepartmentAdmin sees everything except Departments', async () => {
    renderApp('/dashboard', { as: U.adminDataEngineering });
    expect(await navLinks()).toEqual(['Dashboard', 'Trainings', 'Certificates', 'Enrollments', 'Users', 'Rankings']);
  });

  it.each([
    ['Trainee', U.yousef],
    ['Intern', U.noor],
    ['Employee', U.lina],
  ])('%s sees only their learning area — no administration', async (_, userId) => {
    renderApp('/dashboard', { as: userId });
    expect(await navLinks()).toEqual(['Dashboard', 'My trainings', 'Certificates']);
  });
});

describe('protected pages cannot be opened by typing the URL', () => {
  it.each([
    ['/users', U.yousef],
    ['/enrollments', U.noor],
    ['/rankings', U.lina],
    ['/departments', U.ziad],
    ['/users/usr-0008/evaluations', U.hadi],
  ])('learner opening %s sees the access-denied page', async (path, userId) => {
    renderApp(path, { as: userId });
    expect(await denied()).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a DepartmentAdmin cannot open Departments', async () => {
    renderApp('/departments', { as: U.adminAi });
    expect(await denied()).toBeTruthy();
  });

  it('the allowed roles can', async () => {
    const { unmount } = renderApp('/departments', { as: U.superAdmin });
    expect(await screen.findByRole('heading', { level: 1, name: 'Departments' })).toBeTruthy();
    unmount();
    renderApp('/rankings', { as: U.adminAi });
    expect(await screen.findByRole('heading', { level: 1, name: 'Rankings' })).toBeTruthy();
  });

  it('shows a not-found page for unknown URLs', async () => {
    renderApp('/definitely-not-a-page', { as: U.superAdmin });
    expect(await screen.findByText('Page not found')).toBeTruthy();
  });
});

describe('record-level access', () => {
  it('a learner cannot open a training they are not enrolled in', async () => {
    renderApp('/trainings/trn-0002', { as: U.ziad });
    expect(await screen.findByText('You can only open trainings you are enrolled in.')).toBeTruthy();
  });

  it('a DepartmentAdmin cannot open another department\'s training', async () => {
    renderApp('/trainings/trn-0004', { as: U.adminDataEngineering });
    expect(await screen.findByText('This training belongs to another department.')).toBeTruthy();
  });

  it('a learner cannot see the staff tabs or management actions on a training they are enrolled in', async () => {
    renderApp('/trainings/trn-0001', { as: U.yousef });
    await screen.findByRole('heading', { level: 1, name: 'SQL & Data Modeling Foundations' });
    expect(screen.queryByRole('tab', { name: 'Trainees' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Publish|Unpublish/ })).toBeNull();
  });

  it('typing the trainees tab URL as a learner falls back to the overview', async () => {
    const { router } = renderApp('/trainings/trn-0001/trainees', { as: U.yousef });
    await waitFor(() => expect(router.state.location.pathname).toBe('/trainings/trn-0001'));
  });
});

describe('"view as" simulation is mock-only and never changes the Workspace session', () => {
  it('lets a tester act as another directory user without touching the Workspace token or permissions', async () => {
    const user = userEvent.setup();
    renderApp('/dashboard', { as: U.superAdmin });
    const before = sessionStorage.getItem(SESSION_STORAGE_KEY);

    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'View as another user…' }));
    const dialog = await screen.findByRole('dialog', { name: 'View as another user' });
    expect(within(dialog).getByText(/Your DataHub Workspace sign-in and permissions do not change/)).toBeTruthy();
    await user.click(await within(dialog).findByRole('button', { name: /Noor Aldeen/ }));

    // Now the app behaves as the Intern…
    expect(await screen.findAllByText('Intern')).not.toHaveLength(0);
    await waitFor(async () => expect(await navLinks()).toEqual(['Dashboard', 'My trainings', 'Certificates']));
    // …but the Workspace session (token, roles, permissions) is byte-for-byte what it was.
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe(before);

    // And back to oneself.
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('Simulated training role')).toBeTruthy();
    await user.click(await screen.findByRole('menuitem', { name: 'View as another user…' }));
    await user.click(await screen.findByRole('button', { name: 'Back to my own user' }));
    await waitFor(async () => expect(await navLinks()).toContain('Departments'));
  });

  it('simulated learners cannot reach administration even by URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/dashboard', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'View as another user…' }));
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: /Yousef Darwish/ }));
    await waitFor(async () => expect(await navLinks()).not.toContain('Users'));
    await router.navigate('/users');
    expect(await denied()).toBeTruthy();
  });
});
