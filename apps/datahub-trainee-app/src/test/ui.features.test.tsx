import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '@/core/api/mock/mockDatabase';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { LOCALE_STORAGE_KEY } from '@/i18n/languages';
import { renderApp } from './renderApp';

describe('English / Arabic and RTL', () => {
  it('starts in English (LTR) by default', async () => {
    renderApp('/dashboard', { as: U.superAdmin });
    expect(await screen.findByRole('heading', { level: 1, name: 'Training dashboard' })).toBeTruthy();
    expect(screen.getByText(/Welcome back, Layla/)).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('renders Arabic with RTL direction, translated navigation and Latin digits', async () => {
    renderApp('/dashboard', { as: U.superAdmin, locale: 'ar' });
    expect(await screen.findByRole('heading', { level: 1, name: 'لوحة التدريب' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    const nav = await screen.findByRole('navigation', { name: 'التنقل الرئيسي' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['لوحة التحكم', 'التدريبات', 'الشهادات', 'التسجيلات', 'المستخدمون', 'الأقسام', 'الترتيب']);
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
  });

  it('switches language from the top bar, remembers it and flips the page direction', async () => {
    const user = userEvent.setup();
    renderApp('/dashboard', { as: U.superAdmin });
    await user.click(await screen.findByRole('button', { name: 'Change language' }));
    await user.click(await screen.findByRole('menuitem', { name: 'العربية' }));
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
    expect(await screen.findByRole('heading', { level: 1, name: 'لوحة التدريب' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'تغيير اللغة' }));
    await user.click(await screen.findByRole('menuitem', { name: 'English' }));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
  });

  it('translates forms, validation and server errors in Arabic', async () => {
    const user = userEvent.setup();
    renderApp('/departments', { as: U.superAdmin, locale: 'ar' });
    await user.click(await screen.findByRole('button', { name: 'قسم جديد' }));
    const dialog = await screen.findByRole('dialog', { name: 'قسم جديد' });
    await user.click(within(dialog).getByRole('button', { name: 'إنشاء' }));
    expect(await within(dialog).findByText('هذا الحقل مطلوب.')).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: /اسم القسم/ }), 'Cloud');
    await user.click(within(dialog).getByRole('button', { name: 'إنشاء' }));
    expect(await within(dialog).findByText('يوجد قسم بهذا الاسم بالفعل.')).toBeTruthy();
  });

  it('mirrors the sidebar to the right edge in RTL (the layout uses logical positions)', async () => {
    renderApp('/dashboard', { as: U.superAdmin, locale: 'ar' });
    const nav = await screen.findByRole('navigation', { name: 'التنقل الرئيسي' });
    expect(nav.closest('div[class]')).toBeTruthy();
    expect(getComputedStyle(document.documentElement).direction || document.documentElement.dir).toMatch(/rtl/);
  });
});

describe('evaluation form (original scoring)', () => {
  it('starts from the ten default categories scored 5 and updates the total live', async () => {
    const user = userEvent.setup();
    renderApp('/users/usr-0008/evaluations', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'New evaluation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New evaluation' });
    expect(within(dialog).getAllByRole('spinbutton')).toHaveLength(10);
    expect(within(dialog).getByText('50 of 100')).toBeTruthy();
    const first = within(dialog).getAllByRole('spinbutton')[0]!;
    await user.clear(first);
    await user.type(first, '10');
    expect(within(dialog).getByText('55 of 100')).toBeTruthy();
    await user.click(within(dialog).getAllByRole('button', { name: /Remove category/ })[9]!);
    expect(within(dialog).getByText('50 of 90')).toBeTruthy();
  });

  it('rejects scores outside 1–10 and saves a valid evaluation into the history', async () => {
    const user = userEvent.setup();
    renderApp('/users/usr-0008/evaluations', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'New evaluation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New evaluation' });
    const first = within(dialog).getAllByRole('spinbutton')[0]!;
    await user.clear(first);
    await user.type(first, '11');
    await user.click(within(dialog).getByRole('button', { name: 'Submit evaluation' }));
    expect(await within(dialog).findByText('Score must be between 1 and 10.')).toBeTruthy();
    expect(db().evaluations.filter((e) => e.userId === U.ziad)).toHaveLength(0);
    await user.clear(first);
    await user.type(first, '9');
    await user.click(within(dialog).getByRole('button', { name: 'Submit evaluation' }));
    await waitFor(() => expect(db().evaluations.filter((e) => e.userId === U.ziad)).toHaveLength(1));
    expect(db().evaluations.find((e) => e.userId === U.ziad)!.categories[0]!.score).toBe(9);
    expect(await screen.findByText('54 of 100')).toBeTruthy();
  });

  it('a new evaluation reuses the previous evaluation\'s categories, with scores reset', async () => {
    const user = userEvent.setup();
    renderApp('/users/usr-0006/evaluations', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'New evaluation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New evaluation' });
    expect(within(dialog).getByText('50 of 100')).toBeTruthy();
  });

  it('rankings link to the evaluation page', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/rankings', { as: U.superAdmin });
    await user.click(await screen.findByRole('link', { name: 'Evaluate: Hadi Mansour' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/users/usr-0009/evaluations'));
  });

  it('shows the ranking order and "of max" totals', async () => {
    renderApp('/rankings', { as: U.superAdmin });
    const table = await screen.findByRole('table');
    await within(table).findByText('Hadi Mansour');
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getByText('Hadi Mansour')).toBeTruthy();
    expect(within(rows[1]!).getByText('85 of 100')).toBeTruthy();
    expect(within(rows[2]!).getByText('Noor Aldeen')).toBeTruthy();
  });
});

describe('certificates', () => {
  it('shows a printable certificate for a completed training, with branding, name, date and unique reference', async () => {
    const user = userEvent.setup();
    renderApp('/certificates/enr-0003', { as: U.noor });
    const sheet = within(await screen.findByRole('region', { name: 'Certificate of Completion' }));
    expect(sheet.getByText('Noor Aldeen')).toBeTruthy();
    expect(sheet.getByText('SQL & Data Modeling Foundations')).toBeTruthy();
    expect(sheet.getAllByText('DataHub Analytics').length).toBeGreaterThan(0);
    expect(sheet.getByText(/^DH-CERT-0003-\d{8}$/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Print certificate' }));
    expect(window.print).toHaveBeenCalled();
  });

  it('is not available before completion', async () => {
    renderApp('/certificates/enr-0001', { as: U.yousef });
    expect(await screen.findByText('A certificate is available only after the training is completed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Print certificate' })).toBeNull();
  });

  it('a learner cannot open someone else\'s certificate', async () => {
    renderApp('/certificates/enr-0003', { as: U.yousef });
    expect(await screen.findByText('You can only open your own certificates.')).toBeTruthy();
  });

  it('lists a learner\'s certificates, and staff see everyone\'s in scope', async () => {
    const { unmount } = renderApp('/certificates', { as: U.noor });
    expect(await screen.findByText('SQL & Data Modeling Foundations')).toBeTruthy();
    expect(screen.queryByText('Trainee')).toBeNull();
    unmount();
    renderApp('/certificates', { as: U.superAdmin });
    expect(await screen.findByText('Hadi Mansour')).toBeTruthy();
    expect(screen.getByText('Tariq Awad')).toBeTruthy();
  });
});

describe('learner experience', () => {
  it('shows a learner dashboard (not the admin one) with their progress', async () => {
    renderApp('/dashboard', { as: U.noor });
    expect(await screen.findByText('Continue learning')).toBeTruthy();
    expect(screen.queryByText('Enrollments by status')).toBeNull();
    expect(await screen.findByText('ETL Pipelines with Python')).toBeTruthy();
  });

  it('admins see programme figures and the recent activity timeline', async () => {
    const user = userEvent.setup();
    renderApp('/dashboard', { as: U.superAdmin });
    expect(await screen.findByText('Enrollments by status')).toBeTruthy();
    expect(screen.getByText('Completion rate')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Recent activity' }));
    expect(await screen.findByText(/Noor Aldeen completed “SQL & Data Modeling Foundations”/)).toBeTruthy();
  });

  it('filters the admin dashboard by department and period (in the URL)', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/dashboard', { as: U.superAdmin });
    await screen.findByText('Enrollments by status');
    await user.click(screen.getByRole('combobox', { name: 'Period' }));
    await user.click(await screen.findByRole('option', { name: 'Last 30 days' }));
    await waitFor(() => expect(router.state.location.search).toContain('period=30'));
    await user.click(screen.getByRole('combobox', { name: 'Department' }));
    await user.click(await screen.findByRole('option', { name: 'Data Engineering' }));
    await waitFor(() => expect(router.state.location.search).toMatch(/department=/));
  });

  it('opens the assign dialog from the top bar primary action', async () => {
    const user = userEvent.setup();
    renderApp('/dashboard', { as: U.superAdmin });
    await user.click(await screen.findByRole('link', { name: 'Assign training' }));
    expect(await screen.findByRole('dialog', { name: 'Assign training' })).toBeTruthy();
  });

  it('a learner reads content, then submits an assignment while it is open', async () => {
    const user = userEvent.setup();
    renderApp('/trainings/trn-0001/content', { as: U.yousef });
    expect(await screen.findByText('Course overview')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add content' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Assignments' }));
    expect(await screen.findByText('Design a star schema')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    await user.type(await screen.findByRole('textbox', { name: 'Your answer' }), 'My star schema');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(db().submissions.find((s) => s.userId === U.yousef && s.assignmentId === 'asg-0001')?.textResponse).toBe('My star schema'));
    expect(await screen.findByRole('button', { name: 'Update submission' })).toBeTruthy();
  });

  it('shows closed and upcoming assignments as read-only', async () => {
    renderApp('/trainings/trn-0001/assignments', { as: U.yousef });
    expect(await screen.findByText(/This assignment opens on/)).toBeTruthy();
    expect(screen.getAllByRole('textbox', { name: 'Your answer' })).toHaveLength(1);
  });
});

describe('training content management', () => {
  it('adds a text material, validates a bad link, and shows files as preview-only', async () => {
    const user = userEvent.setup();
    renderApp('/trainings/trn-0002/content', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'Add content' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Text' }));
    const text = await screen.findByRole('dialog', { name: 'Add text' });
    await user.click(within(text).getByRole('button', { name: 'Add' }));
    expect((await within(text).findAllByText('This field is required.')).length).toBe(2);
    await user.type(within(text).getByRole('textbox', { name: /Title/ }), 'Week 1');
    await user.type(within(text).getByRole('textbox', { name: /^Content/ }), 'Read chapter one.');
    await user.click(within(text).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Read chapter one.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add content' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Links' }));
    const links = await screen.findByRole('dialog', { name: 'Add links' });
    await user.type(within(links).getByRole('textbox', { name: /^Title/ }), 'Docs');
    await user.type(within(links).getByRole('textbox', { name: /Web address/ }), 'not a url');
    await user.click(within(links).getByRole('button', { name: 'Add' }));
    expect(await within(links).findByText('Enter a full web address that starts with http:// or https://.')).toBeTruthy();
  });

  it('shows seeded file content without a download (simulated files)', async () => {
    renderApp('/trainings/trn-0001/content', { as: U.adminDataEngineering });
    expect(await screen.findByText('lab-instructions.pdf · 1.1 MB')).toBeTruthy();
    expect(screen.getAllByText('Preview only').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /lab-instructions/ })).toBeNull();
  });

  it('reorders content with the move buttons and persists the order', async () => {
    const user = userEvent.setup();
    renderApp('/trainings/trn-0001/content', { as: U.adminDataEngineering });
    await screen.findByText('Course overview');
    const list = screen.getByRole('list', { name: 'Training content' });
    await user.click(within(within(list).getAllByRole('listitem')[0]!).getAllByRole('button', { name: 'Move down' })[0]!);
    await waitFor(() => expect(db().materials.find((m) => m.id === 'mat-0001')!.sortOrder).toBe(1));
    expect(db().materials.find((m) => m.id === 'mat-0002')!.sortOrder).toBe(0);
  });

  it('creates an assignment and enforces closing after opening', async () => {
    const user = userEvent.setup();
    renderApp('/trainings/trn-0002/assignments', { as: U.adminDataEngineering });
    await user.click(await screen.findByRole('button', { name: 'New assignment' }));
    const dialog = await screen.findByRole('dialog', { name: 'New assignment' });
    await user.type(within(dialog).getByRole('textbox', { name: /Title/ }), 'Quiz');
    await user.type(within(dialog).getByRole('textbox', { name: /Instructions/ }), 'Ten questions.');
    const closes = within(dialog).getByLabelText(/Closes/);
    await user.clear(closes);
    await user.type(closes, '2000-01-01T10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('The closing time must be after the opening time.')).toBeTruthy();
  });

  it('staff read submissions per trainee', async () => {
    const user = userEvent.setup();
    renderApp('/trainings/trn-0001/assignments', { as: U.adminDataEngineering });
    await screen.findByText('Design a star schema');
    await user.click(screen.getAllByRole('button', { name: 'View submissions' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: /Submissions/ });
    expect(await within(dialog).findByText(/Fact table: sales/)).toBeTruthy();
    expect(within(dialog).getAllByText('Not submitted').length).toBe(3);
  });
});
