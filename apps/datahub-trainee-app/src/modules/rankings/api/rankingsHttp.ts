import { http } from '@/core/api/http';
import { paginate } from '@/core/api/listing';
import { listOf, num, str, type Raw } from '@/core/api/read';
import type { ListParams, Paginated } from '@/core/api/types';
import type { Role } from '@/core/domain/training';
import type { RankingEntryDto, RankingFilters } from '../types/ranking';

/*
 * Rankings on the real backend: `GET /api/v1/academy/rankings?search&role&departmentId` (verified 2026-11-24:
 * `{ rank, userId, displayName, role, department, latestTotal, evaluationCount, lastEvaluatedAtUtc }`). The backend
 * ranks and filters; paging is done here. `role` is the backend's display label (e.g. "System Administrator").
 */

function toDto(o: Raw): RankingEntryDto {
  return {
    position: num(o, 'rank', 'position'),
    userId: str(o, 'userId') ?? '',
    userName: str(o, 'displayName', 'userName') ?? '',
    // The backend's role label; the chip shows it as is when it is not one of the app's role ids.
    role: (str(o, 'role') ?? 'Employee') as Role,
    departmentId: str(o, 'departmentId'),
    departmentName: str(o, 'department', 'departmentName'),
    latestTotal: num(o, 'latestTotal'),
    latestMaxTotal: num(o, 'latestMaxTotal', 'maxTotal'),
    latestEvaluatedAt: str(o, 'lastEvaluatedAtUtc', 'latestEvaluatedAt'),
    evaluationCount: num(o, 'evaluationCount') ?? 0,
  };
}

export const rankingsHttpApi = {
  async list(params: ListParams<RankingFilters>, signal?: AbortSignal): Promise<Paginated<RankingEntryDto>> {
    const f = params.filters ?? {};
    const rows = listOf(await http.get('/api/v1/academy/rankings', { query: { search: params.search, role: f.role, departmentId: f.departmentId }, signal })).map(toDto);
    return paginate(rows, params.page, params.pageSize);
  },
};
