import { apiPaths } from '@/core/api/paths';
import { http } from '@/core/helpers/http';

/*
 * Layer 2 — Contact inquiries (anonymous). `POST /api/v1/contact/inquiries` `{ name, email, inquiryType, message }`; every
 * field is required. Verified 2026-11-25: `inquiryType` must be one of these three values (case-insensitive, no extra
 * spaces) — the forms show them translated or as the original site spells them and send these values.
 */

export const INQUIRY_TYPES = ['Datahub Analytics', 'Datahub Infrastructure', 'Datahub Security'] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export interface ContactInquiry {
  name: string;
  email: string;
  inquiryType: InquiryType;
  message: string;
}

export const contactApi = {
  submitInquiry: (inquiry: ContactInquiry) => http.post<unknown>(apiPaths.contact.inquiries, inquiry),
};
