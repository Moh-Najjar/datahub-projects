import type { AppointmentValues } from '@/components/layout/AppointmentForm/appointmentSchema';

export type SubmissionResult = 'sent' | 'not-configured';

/**
 * Submits the appointment form.
 *
 * The recreation has no backend of its own. If `VITE_FORM_ENDPOINT` is defined, the
 * form is POSTed there as JSON; otherwise nothing is sent and the UI says so explicitly —
 * it never pretends a submission succeeded.
 */
export async function submitAppointment(values: AppointmentValues, signal?: AbortSignal): Promise<SubmissionResult> {
  const endpoint = import.meta.env.VITE_FORM_ENDPOINT as string | undefined;
  if (!endpoint) return 'not-configured';

  const { website: _honeypot, ...payload } = values;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(`Form endpoint responded ${res.status}`);
  return 'sent';
}
