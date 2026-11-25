import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContactApi, type AdminInquiryParams } from '@/core/api/contact';

/** Layer 3 — received contact inquiries (Blogs Admin, Bearer token). */
export const adminInquiryKeys = {
  all: ['admin-inquiries'] as const,
  list: (params: AdminInquiryParams) => [...adminInquiryKeys.all, 'list', params] as const,
};

export function useAdminInquiries(params: AdminInquiryParams, enabled = true) {
  return useQuery({
    queryKey: adminInquiryKeys.list(params),
    queryFn: ({ signal }) => adminContactApi.getInquiries(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });
}
