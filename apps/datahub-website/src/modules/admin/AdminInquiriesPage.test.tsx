import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminContactApi } from '@/core/api/contact';
import { configureHttpAuth } from '@/core/helpers/http';
import AdminInquiriesPage from '@/modules/admin/AdminInquiriesPage';

// The real page, hook, API function and HTTP client; only `fetch` and the permission check are replaced.
const permission = vi.hoisted(() => ({ canView: true }));
vi.mock('@/modules/admin/hooks/useBlogPermissions', () => ({ useCanViewInquiries: () => permission.canView }));

const page = {
  items: [
    { id: 'i1', name: 'Sara Ali', email: 'sara@example.test', inquiryType: 'Datahub Security', message: 'We need a security assessment.\nSecond line.', createdAtUtc: '2026-11-25T10:15:00Z' },
    { id: 'i2', name: 'Omar', email: 'omar@example.test', inquiryType: 'Datahub Analytics', message: 'Dashboards for sales.', createdAtUtc: '2026-11-24T08:00:00Z' },
  ],
  totalCount: 2,
  pageNumber: 1,
  pageSize: 20,
  totalPages: 1,
};

function answer(data: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(JSON.stringify(status < 300 ? { success: true, data } : { success: false, error: { code: 'Forbidden', message: 'Forbidden' } }), { status, headers: { 'Content-Type': 'application/json' } })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminInquiriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  permission.canView = true;
  configureHttpAuth({ getAccessToken: () => 'admin-token', onUnauthorized: vi.fn() });
});

describe('admin contact inquiries API', () => {
  it('asks for one page with the Bearer token and reads the paged answer', async () => {
    const fetchMock = answer(page);
    const result = await adminContactApi.getInquiries({ pageNumber: 1, pageSize: 20 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/admin/contact/inquiries?pageNumber=1&pageSize=20');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer admin-token');
    expect(result.totalCount).toBe(2);
    expect(result.items[0]).toEqual({ id: 'i1', name: 'Sara Ali', email: 'sara@example.test', inquiryType: 'Datahub Security', message: 'We need a security assessment.\nSecond line.', receivedAtUtc: '2026-11-25T10:15:00Z', status: null });
  });

  it('also accepts a bare array', async () => {
    answer(page.items);
    const result = await adminContactApi.getInquiries({ pageNumber: 1, pageSize: 20 });
    expect(result).toMatchObject({ totalCount: 2, totalPages: 1, pageNumber: 1 });
  });
});

describe('Contact inquiries page', () => {
  it('lists the inquiries and opens one to read it in full, with a reply link', async () => {
    answer(page);
    const user = userEvent.setup();
    renderPage();
    const table = await screen.findByRole('table', { name: 'Contact inquiries' });
    expect(within(table).getByText('Sara Ali')).toBeTruthy();
    expect(within(table).getByText('Datahub Security')).toBeTruthy();
    expect(within(table).getByText('Nov 25, 2026 · 10:15')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Read: Sara Ali' }));
    const dialog = await screen.findByRole('dialog', { name: 'Inquiry' });
    expect(within(dialog).getByText(/We need a security assessment\./)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Reply by email' }).getAttribute('href')).toBe(`mailto:sara@example.test?subject=${encodeURIComponent('Re: your inquiry about Datahub Security')}`);
  });

  it('explains a missing permission instead of calling the API', async () => {
    permission.canView = false;
    const fetchMock = answer(page);
    renderPage();
    expect(await screen.findByText(/cannot read contact inquiries/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error with "Try again" when the API refuses', async () => {
    answer(null, 403);
    renderPage();
    expect(await screen.findByText(/The inquiries could not be loaded\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
