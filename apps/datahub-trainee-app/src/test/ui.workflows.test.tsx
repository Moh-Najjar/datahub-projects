import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { failNextRequest, setMockConfig } from '@/core/api/mock/mockConfig';
import { db } from '@/core/api/mock/mockDatabase';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { renderApp } from './renderApp';

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const row = async (text: string | RegExp) => within(await screen.findByRole('table')).findByRole('row', { name: new RegExp(typeof text === 'string' ? text : text.source) });

describe('training management workflow', () => {
  it('creates a training as a draft: validation first, then success, and it is saved', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/trainings', { as: U.adminDataEngineering });
    await heading('Trainings');
    await user.click(await screen.findByRole('button', { name: 'New training' }));
    const dialog = await screen.findByRole('dialog', { name: 'New training' });

    // DepartmentAdmin: the department is their own and cannot be changed.
    const department = within(dialog).getByRole('combobox', { name: /Department/ });
    expect(department.getAttribute('aria-disabled')).toBe('true');

    // Form validation: required fields are reported.
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect((await within(dialog).findAllByText('This field is required.')).length).toBeGreaterThanOrEqual(2);
    expect(db().trainings.filter((t) => t.title === 'Warehouse Performance Tuning')).toHaveLength(0);

    await user.type(within(dialog).getByRole('textbox', { name: /Title/ }), 'Warehouse Performance Tuning');
    await user.type(within(dialog).getByRole('textbox', { name: /Description/ }), 'Partitioning, indexing and query plans.');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    // It opens the new training, which starts as a Draft with the creator as trainer.
    expect(await heading('Warehouse Performance Tuning')).toBeTruthy();
    expect(router.state.location.pathname).toMatch(/^\/trainings\/trn-\d+$/);
    expect(await screen.findByText('Draft')).toBeTruthy();
    expect(screen.getByText(/Trainer: Omar Nasser/)).toBeTruthy();
    expect(db().trainings.find((t) => t.title === 'Warehouse Performance Tuning')).toMatchObject({ status: 'draft', departmentId: 'dep-0001' });
  });

  it('rejects an end date before the start date', async () => {
    const user = userEvent.setup();
    renderApp('/trainings', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'New training' }));
    const dialog = await screen.findByRole('dialog', { name: 'New training' });
    await user.type(within(dialog).getByRole('textbox', { name: /Title/ }), 'X');
    await user.type(within(dialog).getByRole('textbox', { name: /Description/ }), 'Y');
    await user.type(within(dialog).getByLabelText('Start date'), '2026-12-10');
    await user.type(within(dialog).getByLabelText('End date'), '2026-12-01');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText("The end date can't be before the start date.")).toBeTruthy();
  });

  it('edits a training from its page', async () => {
    const user = userEvent.setup();
    renderApp('/trainings/trn-0003', { as: U.adminDataEngineering });
    await heading('Data Quality & Governance');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit training' });
    const title = within(dialog).getByRole('textbox', { name: /Title/ });
    await user.clear(title);
    await user.type(title, 'Data Quality, Revised');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await heading('Data Quality, Revised')).toBeTruthy();
    expect(db().trainings.find((t) => t.id === 'trn-0003')!.title).toBe('Data Quality, Revised');
  });

  it('publishes and unpublishes from the list', async () => {
    const user = userEvent.setup();
    renderApp('/trainings', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'Publish: Data Quality & Governance' }));
    await waitFor(() => expect(db().trainings.find((t) => t.id === 'trn-0003')!.status).toBe('published'));
    expect(await screen.findByRole('button', { name: 'Unpublish: Data Quality & Governance' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Unpublish: Data Quality & Governance' }));
    await waitFor(() => expect(db().trainings.find((t) => t.id === 'trn-0003')!.status).toBe('draft'));
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/trainings', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'Delete: Data Quality & Governance' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete training?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(db().trainings.some((t) => t.id === 'trn-0003')).toBe(true);
    await user.click(await screen.findByRole('button', { name: 'Delete: Data Quality & Governance' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete training?' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(db().trainings.some((t) => t.id === 'trn-0003')).toBe(false));
  });

  it('reorders trainings with the move buttons and saves the order', async () => {
    const user = userEvent.setup();
    renderApp('/trainings', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'Reorder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reorder trainings' });
    const items = await within(dialog).findAllByRole('listitem');
    expect(items.map((li) => within(li).getByText(/SQL|ETL|Data Quality/).textContent)).toEqual(['SQL & Data Modeling Foundations', 'ETL Pipelines with Python', 'Data Quality & Governance']);
    await user.click(within(items[2]!).getByRole('button', { name: 'Move up' }));
    await user.click(within(items[2]!).getByRole('button', { name: 'Move up' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save order' }));
    await waitFor(() => expect(db().trainings.find((t) => t.id === 'trn-0003')!.sortOrder).toBe(0));
    expect(db().trainings.find((t) => t.id === 'trn-0001')!.sortOrder).toBe(1);
  });
});

describe('list states: loading, error, empty', () => {
  it('shows a loading state while the (simulated) request runs', async () => {
    setMockConfig({ delayMs: { min: 150, max: 150 } });
    renderApp('/users', { as: U.superAdmin });
    const table = await screen.findByRole('table');
    expect(table.getAttribute('aria-busy')).toBe('true');
    await waitFor(() => expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('false'));
    expect(await screen.findByText('Alaa Hijazi')).toBeTruthy();
  });

  it('shows a translated error with a retry that recovers', async () => {
    const user = userEvent.setup();
    // The page starts three requests (notifications, departments, trainings): fail all three, then retry.
    failNextRequest('SERVER');
    failNextRequest('SERVER');
    failNextRequest('SERVER');
    renderApp('/trainings', { as: U.superAdmin });
    expect(await screen.findByText("We couldn't load this")).toBeTruthy();
    expect(screen.getByText('The service had a problem. Please try again in a moment.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SQL & Data Modeling Foundations')).toBeTruthy();
  });

  it('shows a "nothing matches" state for a search with no results, and clears it', async () => {
    const user = userEvent.setup();
    renderApp('/trainings', { as: U.superAdmin });
    await screen.findByText('SQL & Data Modeling Foundations');
    await user.type(screen.getByRole('searchbox', { name: 'Search trainings' }), 'zzzzzz');
    expect(await screen.findByText('Nothing matches')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(await screen.findByText('SQL & Data Modeling Foundations')).toBeTruthy();
  });

  it('shows an empty state when there is nothing at all (a learner with no enrollments)', async () => {
    renderApp('/trainings', { as: U.alaa });
    expect(await screen.findByText('No trainings yet')).toBeTruthy();
    expect(screen.getByText(/appear here/)).toBeTruthy();
  });

  it('filters by status and paginates', async () => {
    const user = userEvent.setup();
    renderApp('/trainings', { as: U.superAdmin });
    await screen.findByText('SQL & Data Modeling Foundations');
    expect(screen.getByText(/1–10 of 10/)).toBeTruthy();
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Archived' }));
    expect(await screen.findByText('REST API Design')).toBeTruthy();
    expect(screen.queryByText('SQL & Data Modeling Foundations')).toBeNull();
  });
});

describe('enrollment workflow', () => {
  it('prevents duplicate assignment: people already enrolled in the chosen training are disabled', async () => {
    const user = userEvent.setup();
    renderApp('/enrollments', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'Assign training' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign training' });
    await user.click(within(dialog).getByRole('combobox', { name: /Training/ }));
    await user.click(await screen.findByRole('option', { name: /SQL & Data Modeling Foundations/ }));
    await user.click(within(dialog).getByRole('combobox', { name: /Person/ }));
    const enrolled = await screen.findByRole('option', { name: /Yousef Darwish.*already enrolled/ });
    expect(enrolled.getAttribute('aria-disabled')).toBe('true');
    const free = await screen.findByRole('option', { name: /Alaa Hijazi/ });
    expect(free.getAttribute('aria-disabled')).not.toBe('true');
    // inactive people and administrators are not offered at all
    expect(screen.queryByRole('option', { name: /Khaled Issa/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Rania Khoury/ })).toBeNull();
  });

  it('assigns a training to a person who can then see it', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp('/enrollments', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'Assign training' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign training' });
    await user.click(within(dialog).getByRole('combobox', { name: /Training/ }));
    await user.click(await screen.findByRole('option', { name: /ETL Pipelines with Python/ }));
    await user.click(within(dialog).getByRole('combobox', { name: /Person/ }));
    await user.click(await screen.findByRole('option', { name: /Ziad Tamimi/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(db().enrollments.some((e) => e.userId === U.ziad && e.trainingId === 'trn-0002')).toBe(true));
    unmount();
    renderApp('/trainings', { as: U.ziad });
    expect(await screen.findByText('ETL Pipelines with Python')).toBeTruthy();
  });

  it('updates status and progress together; reaching Completed stamps the completion date', async () => {
    const user = userEvent.setup();
    renderApp('/enrollments', { as: U.adminDataEngineering });
    const ziad = await row(/Ziad Tamimi/);
    await user.click(within(ziad).getByRole('button', { name: 'Update status and progress: Ziad Tamimi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update status and progress' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Completed' }));
    expect(within(dialog).getByText('100%')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db().enrollments.find((e) => e.userId === U.ziad && e.trainingId === 'trn-0001')).toMatchObject({ status: 'completed', progress: 100 }));
    expect(db().enrollments.find((e) => e.userId === U.ziad && e.trainingId === 'trn-0001')!.completedAt).not.toBeNull();
  });

  it('removes an enrollment after confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/enrollments', { as: U.adminDataEngineering });
    const ziad = await row(/Ziad Tamimi/);
    await user.click(within(ziad).getByRole('button', { name: 'Delete: Ziad Tamimi' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Remove enrollment?' })).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(db().enrollments.some((e) => e.userId === U.ziad)).toBe(false));
  });
});

describe('users workflow', () => {
  it('adds a user (no password asked) and shows their role and department', async () => {
    const user = userEvent.setup();
    renderApp('/users', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    expect(within(dialog).queryByLabelText(/password/i)).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: /Full name/ }), 'Reem Saleh');
    await user.type(within(dialog).getByRole('textbox', { name: /E-mail/ }), 'reem.saleh@example.test');
    await user.click(within(dialog).getByRole('combobox', { name: /Role/ }));
    await user.click(await screen.findByRole('option', { name: 'Intern' }));
    await user.click(within(dialog).getByRole('combobox', { name: /Department/ }));
    await user.click(await screen.findByRole('option', { name: 'Cloud' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(db().users.find((u) => u.email === 'reem.saleh@example.test')).toMatchObject({ role: 'Intern', departmentId: 'dep-0007' }));
  });

  it('reports a duplicate e-mail on the field and an invalid e-mail before sending', async () => {
    const user = userEvent.setup();
    renderApp('/users', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    await user.type(within(dialog).getByRole('textbox', { name: /Full name/ }), 'Copy Cat');
    await user.type(within(dialog).getByRole('textbox', { name: /E-mail/ }), 'not-an-email');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('Enter a valid e-mail address.')).toBeTruthy();
    const email = within(dialog).getByRole('textbox', { name: /E-mail/ });
    await user.clear(email);
    await user.type(email, 'layla.haddad@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('A user with this e-mail already exists.')).toBeTruthy();
  });

  it('activates and deactivates a user with the switch', async () => {
    const user = userEvent.setup();
    renderApp('/users', { as: U.superAdmin });
    const khaled = await row(/Khaled Issa/);
    await user.click(within(khaled).getByRole('switch'));
    await waitFor(() => expect(db().users.find((u) => u.id === U.khaled)!.isActive).toBe(true));
  });

  it('a DepartmentAdmin may only choose learner roles and keeps users in their department', async () => {
    const user = userEvent.setup();
    renderApp('/users', { as: U.adminDataEngineering });
    await screen.findByText('Yousef Darwish');
    expect(screen.queryByText('Hadi Mansour')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    await user.click(within(dialog).getByRole('combobox', { name: /Role/ }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Trainee', 'Employee', 'Intern'].sort((a, b) => ['Intern', 'Trainee', 'Employee'].indexOf(a) - ['Intern', 'Trainee', 'Employee'].indexOf(b)));
  });
});

describe('departments workflow', () => {
  it('creates a department and refuses a duplicate name', async () => {
    const user = userEvent.setup();
    renderApp('/departments', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'New department' }));
    const dialog = await screen.findByRole('dialog', { name: 'New department' });
    await user.type(within(dialog).getByRole('textbox', { name: /Department name/ }), 'Security');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(db().departments.some((d) => d.name === 'Security')).toBe(true));
    await user.click(await screen.findByRole('button', { name: 'New department' }));
    const again = await screen.findByRole('dialog', { name: 'New department' });
    await user.type(within(again).getByRole('textbox', { name: /Department name/ }), 'security');
    await user.click(within(again).getByRole('button', { name: 'Create' }));
    expect(await within(again).findByText('A department with this name already exists.')).toBeTruthy();
  });

  it('explains why a department that is in use cannot be deleted', async () => {
    const user = userEvent.setup();
    renderApp('/departments', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'Delete: Data Engineering' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete department?' })).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/still has users or trainings/)).toBeTruthy();
    expect(db().departments.some((d) => d.name === 'Data Engineering')).toBe(true);
  });
});
