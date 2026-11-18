import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failNextRequest } from '@/core/api/mock/mockConfig';
import type { Role } from '@/core/config/permissions';
import { documentsApi } from '@/modules/documents/api/documentsApi';
import type { DocumentsScope } from '@/modules/documents/types/documents';
import { recordedCharts } from '@/test/echartsStub';
import { renderApp } from '@/test/renderApp';

/* UI on a fixed clock: Monday 16 Nov 2026, 10:30 (local). Only Date is faked; timers stay real (simulated upload). */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

type User = ReturnType<typeof renderApp>['user'];
const HR: DocumentsScope = { userId: 'usr-0002', role: 'hr-admin' };

async function open(path: string, role: Role = 'hr-admin') {
  const utils = renderApp(path, { as: role });
  await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), { timeout: 8000 });
  return utils;
}
async function choose(user: User, label: string | RegExp, option: string | RegExp, scope: HTMLElement = document.body) {
  await user.click(within(scope).getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}
const kpi = (key: string) => document.querySelector(`[data-kpi="${key}"]`)?.textContent;
/** Accessible name "<label> <count>" of an expiry window button (whitespace between the two parts may vary). */
const windowName = (label: string, count: number) => new RegExp('^' + label + '\\s*' + String(count) + '$');
/** No element may offer a file download in the demo (files are simulated). */
function expectNoDownloads() {
  expect(document.querySelectorAll('a[download], a[href^="blob:"], a[href^="data:"]').length).toBe(0);
  expect(screen.queryAllByRole('link', { name: /download/i })).toHaveLength(0);
  expect(screen.queryAllByRole('button', { name: /download/i })).toHaveLength(0);
}

describe('overview', () => {
  it('six KPIs, four charts and attention lists from the same API data', async () => {
    const o = await documentsApi.getDocumentsOverview(HR);
    await open('/documents');
    expect(screen.getByRole('heading', { level: 1, name: 'Documents' })).toBeTruthy();
    for (const key of ['total', 'active', 'expiringSoon', 'expired', 'pendingReview', 'archived'] as const) expect(kpi(key), key).toBe(o.totals[key].toLocaleString('en-US'));
    for (const title of ['Documents by category', 'Document expiry', 'Verification status', 'Documents by department']) expect(screen.getByRole('img', { name: title }), title).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Expired documents requiring attention' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Missing mandatory documents' })).toBeTruthy();
    expectNoDownloads();
  }, 20_000);

  it('Arabic + dark: translated, RTL, mirrored charts, Latin digits', async () => {
    const { user } = await open('/documents');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(screen.getByRole('button', { name: 'Switch to العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'المستندات' })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(screen.getByRole('tab', { name: 'الانتهاء' })).toBeTruthy();
    expect(kpi('total')).toMatch(/^[0-9,]+$/);
    await waitFor(() => expect(recordedCharts.some((c) => (c.option.xAxis as { inverse?: boolean } | undefined)?.inverse === true)).toBe(true));
  }, 20_000);

  it('error state with retry', async () => {
    // The first try and the two automatic retries fail.
    for (let i = 0; i < 3; i++) failNextRequest('SERVER');
    const { user } = await open('/documents');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(kpi('total')).toBeTruthy());
  }, 20_000);
});

describe('directory and details', () => {
  it('filters (status from the overview link, search) and opens the details without any download link', async () => {
    const { user } = await open('/documents/directory?status=pending-review');
    const table = await screen.findByRole('table', { name: 'Documents' });
    await waitFor(() => expect(within(table).getAllByText('Pending review').length).toBeGreaterThan(0));
    expect(within(table).queryByText('Verified')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Work permit');
    await waitFor(() => expect(within(table).getAllByRole('link').every((a) => a.textContent === 'Work permit')).toBe(true));
    await user.click(within(table).getAllByRole('link', { name: 'Work permit' })[0]!);
    expect(await screen.findByRole('heading', { level: 2, name: 'Work permit' })).toBeTruthy();
    expect(screen.getByText(/Storing and downloading real files requires the secure backend/)).toBeTruthy();
    expect(screen.getAllByText(/not stored \(demo\)/).length).toBeGreaterThan(0);
    expectNoDownloads();
  }, 20_000);

  it('verify, reject with a mandatory reason, internal notes (recorded in the history)', async () => {
    const pending = (await documentsApi.getDocuments({ page: 1, pageSize: 50, filters: { status: 'pending-review' } }, HR)).items.filter((d) => d.expiryStatus !== 'expired');
    const { user, unmount } = await open(`/documents/directory/${pending[0]!.id}`);
    await user.click(await screen.findByRole('button', { name: 'Verify' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('The document was verified.')).toBeTruthy();
    expect(document.querySelector('[data-history="verified"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add internal note' }));
    const noteDialog = within(await screen.findByRole('dialog'));
    await user.type(noteDialog.getByRole('textbox', { name: /Note/ }), 'Checked against the original.');
    await user.click(noteDialog.getByRole('button', { name: 'Add internal note' }));
    expect(await screen.findByText('Checked against the original.', { selector: 'p' })).toBeTruthy();
    unmount();

    const second = await open(`/documents/directory/${pending[1]!.id}`);
    await second.user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = within(await screen.findByRole('dialog'));
    await second.user.click(dialog.getByRole('button', { name: 'Reject' }));
    expect(await dialog.findByText('Write at least 5 characters.')).toBeTruthy();
    await second.user.type(dialog.getByRole('textbox', { name: /Reason/ }), 'The photo page is cut off.');
    await second.user.click(dialog.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText(/Rejected: The photo page is cut off\. A replacement is required\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload replacement' })).toBeTruthy();
  }, 30_000);

  it('replacement: upload (simulated), verify, and the previous document becomes superseded', async () => {
    const expired = (await documentsApi.getDocuments({ page: 1, pageSize: 50, filters: { status: 'expired', ownerType: 'employee' } }, HR)).items.find((d) => d.category.code === 'NATIONAL-ID')!;
    const { user } = await open(`/documents/directory/${expired.id}`);
    await user.click(await screen.findByRole('button', { name: 'Upload replacement' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/becomes superseded only when this replacement is verified/)).toBeTruthy();
    fireEvent.change(dialog.getByLabelText(/Issue date/), { target: { value: '2026-11-10' } });
    fireEvent.change(dialog.getByLabelText(/Expiry date/), { target: { value: '2036-11-09' } });
    await user.upload(dialog.getByTestId('document-file-input'), new File(['x'], 'renewed-id.png', { type: 'image/png' }));
    await user.click(dialog.getByRole('button', { name: 'Upload replacement' }));
    expect(await screen.findByText('The replacement was uploaded (simulated) and is pending review.', {}, { timeout: 5000 })).toBeTruthy();
    const doc = await documentsApi.getDocumentById(expired.id, HR);
    expect(doc.replacedBy).not.toBeNull();
    await documentsApi.verifyDocument(doc.replacedBy!.id, HR);
    expect((await documentsApi.getDocumentById(expired.id, HR)).verificationStatus).toBe('superseded');
  }, 30_000);
});

describe('upload validation', () => {
  it('refuses disallowed file types before sending, and cancelling the simulated upload sends nothing', async () => {
    const before = (await documentsApi.getDocuments({ page: 1, pageSize: 1, filters: { includeHistorical: 'true' } }, HR)).total;
    const { user } = await open('/documents/directory');
    await user.click(await screen.findByRole('button', { name: 'Upload document' }));
    const dialogEl = await screen.findByRole('dialog', { name: 'Upload document (simulated)' });
    const dialog = within(dialogEl);
    await user.type(dialog.getByRole('combobox', { name: /Employee/ }), 'Sami');
    await user.click(await screen.findByRole('option', { name: /Sami Odeh/ }));
    await choose(user, /^Category/, 'Training Certificate', dialogEl);
    await user.upload(dialog.getByTestId('document-file-input'), new File(['x'], 'macro.exe', { type: 'application/octet-stream' }));
    expect(dialog.getByText(/This file type is not allowed for the category/)).toBeTruthy();
    expect((dialog.getByRole('button', { name: 'Upload document' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(dialog.getByRole('button', { name: 'Remove macro.exe' }));
    await user.upload(dialog.getByTestId('document-file-input'), new File(['x'], 'course.pdf', { type: 'application/pdf' }));
    await user.click(dialog.getByRole('button', { name: 'Upload document' }));
    expect(await dialog.findByText(/Simulated upload… \d+%/)).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Cancel upload' }));
    await waitFor(() => expect(dialog.queryByText(/Simulated upload…/)).toBeNull());
    await new Promise((r) => setTimeout(r, 800));
    expect((await documentsApi.getDocuments({ page: 1, pageSize: 1, filters: { includeHistorical: 'true' } }, HR)).total).toBe(before);
  }, 30_000);
});

describe('expiry, categories and required documents', () => {
  it('expiry windows show the counts and the matching documents', async () => {
    const s = await documentsApi.getDocumentExpirySummary(HR);
    const { user } = await open('/documents/expiry');
    expect(await screen.findByRole('button', { name: windowName('Expired', s.expired) })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: windowName('7 days', s.within7) }));
    const table = await screen.findByRole('table', { name: 'Expiring documents' });
    await waitFor(() => expect(within(table).queryAllByText(/days left|expires today/).length).toBe(Math.min(s.within7, 10)));
    expect(screen.getByText('No e-mails or push notifications are sent in the demo.')).toBeTruthy();
  }, 20_000);

  it('the HR Administrator creates a category; the HR Manager sees categories read-only', async () => {
    const { user, unmount } = await open('/documents/categories');
    await user.click(await screen.findByRole('button', { name: 'New category' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByRole('textbox', { name: /^Code/ }), 'FIRST-AID');
    await user.type(dialog.getByRole('textbox', { name: /Name \(English\)/ }), 'First aid certificate');
    await user.type(dialog.getByRole('textbox', { name: /Name \(Arabic\)/ }), 'شهادة إسعافات أولية');
    await user.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('“First aid certificate” was created.')).toBeTruthy();
    unmount();
    await open('/documents/categories', 'hr-manager');
    expect(await screen.findByText('Categories are configured by the HR Administrator.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New category' })).toBeNull();
  }, 20_000);

  it('required documents: rules and an employee checklist with completeness', async () => {
    const { user } = await open('/documents/required');
    expect(await screen.findByRole('table', { name: 'Required-document rules' })).toBeTruthy();
    const table = await screen.findByRole('table', { name: 'Employee compliance' });
    const first = (await within(table).findAllByRole('button', { expanded: false }))[0]!;
    await user.click(first);
    const checklist = await screen.findByRole('list', { name: 'Required documents' });
    expect(within(checklist).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-completeness]')).not.toBeNull();
    expect(screen.getByText(/never block payroll or change an employee's status/)).toBeTruthy();
  }, 20_000);
});

describe('self-service, permissions and integrations', () => {
  it('Employee: My documents only; other documents are not found; workspace pages redirect', async () => {
    const { router } = await open('/documents', 'employee');
    expect(screen.getByRole('heading', { level: 1, name: 'My documents' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Documents sections' })).toBeNull();
    expect(await screen.findByRole('table', { name: 'My documents' })).toBeTruthy();
    expect(screen.getByText(/Internal HR notes and restricted documents are never sent/)).toBeTruthy();
    const other = (await documentsApi.getDocuments({ page: 1, pageSize: 5, filters: { ownerType: 'employee', ownerId: 'emp-0001' } }, HR)).items[0]!;
    await router.navigate(`/documents/directory/${other.id}`);
    expect(await screen.findByText('This document does not exist or is not available to you.')).toBeTruthy();
    await router.navigate('/documents/directory');
    await waitFor(() => expect(router.state.location.pathname).toBe('/documents'));
  }, 20_000);

  it('Recruiter: candidate documents in the candidate profile', async () => {
    const candidate = (await documentsApi.getDocuments({ page: 1, pageSize: 1, filters: { ownerType: 'candidate' } }, { userId: 'usr-0006', role: 'recruiter' })).items[0]!;
    const { user } = await open(`/recruitment/candidates/${candidate.owner.id}`, 'recruiter');
    await user.click(await screen.findByRole('tab', { name: 'Documents' }));
    expect(await screen.findByRole('table', { name: 'Candidate documents' })).toBeTruthy();
    expect(screen.getAllByText('CV').length).toBeGreaterThan(0);
  }, 20_000);

  it('Payroll: supporting documents on the compensation page; Leave: link to the registered attachment', async () => {
    const { unmount } = await open('/payroll/compensation/emp-0025', 'payroll-officer');
    expect(await screen.findByRole('heading', { name: 'Payroll supporting documents' }, { timeout: 8000 })).toBeTruthy();
    unmount();
    const leaveDoc = (await documentsApi.getDocuments({ page: 1, pageSize: 1, filters: { group: 'leave' } }, HR)).items[0]!;
    await open(`/leave/requests/${leaveDoc.source.recordId}`);
    const link = await screen.findByRole('link', { name: 'View in Documents' });
    expect(link.getAttribute('href')).toBe(`/documents/directory?search=${encodeURIComponent(leaveDoc.source.reference!)}`);
  }, 20_000);
});
