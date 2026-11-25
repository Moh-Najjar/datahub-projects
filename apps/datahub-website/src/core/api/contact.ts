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

/** A received inquiry as Blogs Admin shows it. */
export interface AdminInquiry {
  id: string;
  name: string;
  email: string;
  inquiryType: string;
  message: string;
  /** When it arrived (ISO, UTC), when the backend says. */
  receivedAtUtc: string | null;
  /** The backend's handling status (e.g. New), when it has one. */
  status: string | null;
}

export interface AdminInquiryPage {
  items: AdminInquiry[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminInquiryParams {
  pageNumber: number;
  pageSize: number;
}

type Raw = Record<string, unknown>;
const pick = (o: Raw, ...keys: string[]): string | null => {
  for (const key of keys) if (typeof o[key] === 'string' && (o[key] as string).trim()) return o[key] as string;
  return null;
};
const count = (o: Raw, key: string): number | null => (typeof o[key] === 'number' ? (o[key] as number) : null);

function toInquiry(item: unknown, index: number): AdminInquiry {
  const o = (item && typeof item === 'object' ? item : {}) as Raw;
  return {
    id: pick(o, 'id', 'inquiryId') ?? `inquiry-${index}`,
    name: pick(o, 'name', 'fullName') ?? '',
    email: pick(o, 'email') ?? '',
    inquiryType: pick(o, 'inquiryType', 'type') ?? '',
    message: pick(o, 'message') ?? '',
    receivedAtUtc: pick(o, 'createdAtUtc', 'submittedAtUtc', 'receivedAtUtc', 'createdAt', 'submittedAt'),
    status: pick(o, 'status'),
  };
}

/**
 * Swagger documents no response body for the admin list (2026-11-25): read like the blog lists — `{ items, totalCount,
 * pageNumber, pageSize, totalPages }` — and also accept a bare array.
 */
function toInquiryPage(data: unknown, params: AdminInquiryParams): AdminInquiryPage {
  const o = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Raw;
  const list = Array.isArray(data) ? data : Array.isArray(o.items) ? o.items : Array.isArray(o.data) ? o.data : [];
  const items = list.map(toInquiry);
  const totalCount = count(o, 'totalCount') ?? items.length;
  const pageSize = count(o, 'pageSize') ?? params.pageSize;
  return { items, totalCount, pageNumber: count(o, 'pageNumber') ?? params.pageNumber, pageSize, totalPages: count(o, 'totalPages') ?? Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))) };
}

export const adminContactApi = {
  getInquiries: async (params: AdminInquiryParams, signal?: AbortSignal): Promise<AdminInquiryPage> =>
    toInquiryPage(await http.get<unknown>(apiPaths.contact.adminInquiries, { query: { ...params }, signal, auth: true }), params),
};
