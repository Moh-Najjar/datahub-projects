import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { certificatesMock } from '../mock/certificatesMock';
import type { CertificateDto, CertificateFilters } from '../types/certificate';
import { usesMockData } from '@/core/config/api';
import { certificatesHttpApi } from './certificatesHttp';

/** The ONLY data entry point of the Certificates module (the real backend over HTTP, or the simulated one — same types). */
const mockCertificatesApi = {
  list: (params: ListParams<CertificateFilters>, signal?: AbortSignal): Promise<Paginated<CertificateDto>> => mockRequest(() => certificatesMock.list(params), { signal }),
  get: (enrollmentId: string, signal?: AbortSignal): Promise<CertificateDto> => mockRequest(() => certificatesMock.get(enrollmentId), { signal }),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const certificatesApi: typeof mockCertificatesApi = usesMockData ? mockCertificatesApi : certificatesHttpApi;
