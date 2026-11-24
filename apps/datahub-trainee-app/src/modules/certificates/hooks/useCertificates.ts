import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useActorKey } from '@/core/hooks/useActorKey';
import { certificatesApi } from '../api/certificatesApi';
import type { CertificateFilters } from '../types/certificate';

export function useCertificates(params: ListParams<CertificateFilters>) {
  const actor = useActorKey();
  return useQuery({ queryKey: ['certificates', actor, 'list', params], queryFn: ({ signal }) => certificatesApi.list(params, signal), placeholderData: keepPreviousData });
}

export function useCertificate(enrollmentId: string | undefined) {
  const actor = useActorKey();
  return useQuery({ queryKey: ['certificates', actor, 'detail', enrollmentId ?? ''], queryFn: ({ signal }) => certificatesApi.get(enrollmentId!, signal), enabled: !!enrollmentId });
}
