import { http } from '@/core/api/http';
import { queryCollection } from '@/core/api/listing';
import { asRaw, listOf, num, str, type Raw } from '@/core/api/read';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import type { CertificateDto, CertificateFilters } from '../types/certificate';

/*
 * Certificates on the real backend: `GET /api/v1/academy/certificates?search&userId` and `GET …/certificates/{id}`.
 * Issued when an enrollment is completed (see enrollmentsHttp). The app addresses a certificate by its ENROLLMENT
 * (`/certificates/:enrollmentId`), so `get` accepts either id. Fields are read tolerantly (no documented model).
 */

const BASE = '/api/v1/academy/certificates';

function toDto(o: Raw): CertificateDto {
  return {
    enrollmentId: str(o, 'enrollmentId') ?? str(o, 'id') ?? '',
    reference: str(o, 'certificateNumber', 'reference', 'code', 'number') ?? str(o, 'id') ?? '',
    traineeName: str(o, 'traineeName', 'userDisplayName', 'userName', 'displayName') ?? '',
    trainingId: str(o, 'trainingId') ?? '',
    trainingTitle: str(o, 'trainingTitle', 'trainingName', 'title') ?? '',
    departmentName: str(o, 'departmentName', 'department'),
    trainerName: str(o, 'trainerName'),
    durationHours: num(o, 'durationHours', 'estimatedDurationHours'),
    completedAt: str(o, 'completedAtUtc', 'issuedAtUtc', 'completedAt', 'issuedAt') ?? new Date(0).toISOString(),
  };
}

export const certificatesHttpApi = {
  async list(params: ListParams<CertificateFilters>, signal?: AbortSignal): Promise<Paginated<CertificateDto>> {
    const rows = listOf(await http.get(BASE, { query: { search: params.search }, signal })).map(toDto);
    return queryCollection(rows, { ...params, search: undefined }, {
      searchFields: () => [],
      matches: (c, f) => !f.trainingId || c.trainingId === f.trainingId,
      sorters: { completedAt: (a, b) => a.completedAt.localeCompare(b.completedAt), trainee: (a, b) => a.traineeName.localeCompare(b.traineeName), training: (a, b) => a.trainingTitle.localeCompare(b.trainingTitle) },
      defaultSort: (a, b) => b.completedAt.localeCompare(a.completedAt),
    });
  },
  async get(enrollmentId: string, signal?: AbortSignal): Promise<CertificateDto> {
    const match = listOf(await http.get(BASE, { signal })).find((o) => str(o, 'enrollmentId') === enrollmentId || str(o, 'id') === enrollmentId);
    if (match) {
      const id = str(match, 'id');
      // The detail may carry more (trainer, duration); fall back to the list item.
      const detail = id ? await http.get(`${BASE}/${id}`, { signal }).then(asRaw).catch(() => null) : null;
      return toDto({ ...match, ...(detail ?? {}) });
    }
    throw new ApiError('NOT_FOUND', 'certificate.notFound');
  },
};
