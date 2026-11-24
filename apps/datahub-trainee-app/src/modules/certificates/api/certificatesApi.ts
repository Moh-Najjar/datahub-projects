import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { certificatesMock } from '../mock/certificatesMock';
import type { CertificateDto, CertificateFilters } from '../types/certificate';

/** The ONLY data entry point of the Certificates module (today: the simulated backend; later: HTTP, same types). */
export const certificatesApi = {
  list: (params: ListParams<CertificateFilters>, signal?: AbortSignal): Promise<Paginated<CertificateDto>> => mockRequest(() => certificatesMock.list(params), { signal }),
  get: (enrollmentId: string, signal?: AbortSignal): Promise<CertificateDto> => mockRequest(() => certificatesMock.get(enrollmentId), { signal }),
};
