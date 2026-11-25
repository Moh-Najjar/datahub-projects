import { useMutation } from '@tanstack/react-query';
import { contactApi, type ContactInquiry } from '@/core/api/contact';

/** Sends a contact inquiry. Never retried automatically (a retry could send it twice). */
export function useSubmitInquiry() {
  return useMutation({ mutationFn: (inquiry: ContactInquiry) => contactApi.submitInquiry(inquiry), retry: false });
}
