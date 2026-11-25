import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import type { Locale } from '@/i18n/languages';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { AppointmentForm } from '@/modules/contact/components/AppointmentForm';
import { APPOINTMENT_FORM_MESSAGE } from '@/modules/contact/data/contact';

// The real form, hook, API function and HTTP client; only the network (`fetch`) is replaced.
const ENDPOINT = '/api/v1/contact/inquiries';

function renderForm(props: Parameters<typeof AppointmentForm>[0] = {}, locale: Locale = 'en') {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale={locale}>
        <AppThemeProvider>
          <AppointmentForm {...props} />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

function mockFetch(response: () => Response = () => new Response(JSON.stringify({ success: true, data: 'inq-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } })) {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentBody = (fetchMock: ReturnType<typeof mockFetch>) => JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

const contactPage = {
  withMessage: true,
  showHeader: false,
  messagePlaceholder: 'Please describe what you need.',
  overrides: { name: 'Name*', email: 'Email*', inquiry: 'Your inquiry about*', inquiryOptions: ['Datauhb Analytics', 'Datahub Infrastructure', 'Datahub Security'], submit: 'Get a free consultation' },
};

describe('contact / appointment form → POST /api/v1/contact/inquiries', () => {
  it('footer form: sends the inquiry with the backend type and the fixed note (it has no message field)', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Name*' }), 'Sara Ali');
    await user.type(screen.getByRole('textbox', { name: 'Email*' }), 'sara@example.test');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Your inquiry about*' }), 'Datahub Security');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Thank you for your message. It has been sent.')).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    expect(sentBody(fetchMock)).toEqual({ name: 'Sara Ali', email: 'sara@example.test', inquiryType: 'Datahub Security', message: APPOINTMENT_FORM_MESSAGE });
    // The form is cleared after sending.
    expect((screen.getByRole('textbox', { name: 'Name*' }) as HTMLInputElement).value).toBe('');
  });

  it('Contact page: the original’s "Datauhb" label sends the valid type; the message is required', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    renderForm(contactPage);
    await user.type(screen.getByRole('textbox', { name: 'Name*' }), 'Omar');
    await user.type(screen.getByRole('textbox', { name: 'Email*' }), 'omar@example.test');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Your inquiry about*' }), 'Datauhb Analytics');
    await user.click(screen.getByRole('button', { name: 'Get a free consultation' }));
    // No message → not sent, the field says why.
    expect(await screen.findByText('One or more fields have an error. Please check and try again.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Please describe what you need.' }).getAttribute('aria-invalid')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Please describe what you need.' }), '  A data platform assessment.  ');
    await user.click(screen.getByRole('button', { name: 'Get a free consultation' }));
    expect(await screen.findByText('Thank you for your message. It has been sent.')).toBeTruthy();
    expect(sentBody(fetchMock)).toEqual({ name: 'Omar', email: 'omar@example.test', inquiryType: 'Datahub Analytics', message: 'A data platform assessment.' });
  });

  it('Arabic labels send the English inquiry type', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    renderForm({}, 'ar');
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'داتا هب انالتكس للبنية التحتية');
    expect((select as HTMLSelectElement).value).toBe('Datahub Infrastructure');
    await user.type(screen.getAllByRole('textbox')[0]!, 'سارة');
    await user.type(screen.getAllByRole('textbox')[1]!, 'sara@example.test');
    await user.click(screen.getByRole('button'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock).inquiryType).toBe('Datahub Infrastructure');
  });

  it('never claims success when the API refuses or cannot be reached', async () => {
    const user = userEvent.setup();
    mockFetch(() => new Response(JSON.stringify({ success: false, error: { code: 'Validation.General', message: 'One or more validation errors occurred' } }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Name*' }), 'Sara');
    await user.type(screen.getByRole('textbox', { name: 'Email*' }), 'sara@example.test');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Your inquiry about*' }), 'Datahub Analytics');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('There was an error trying to send your message. Please try again later.')).toBeTruthy();
    expect(screen.queryByText(/It has been sent/)).toBeNull();
    // What was typed stays, so the person can try again.
    expect((screen.getByRole('textbox', { name: 'Name*' }) as HTMLInputElement).value).toBe('Sara');
  });
});
