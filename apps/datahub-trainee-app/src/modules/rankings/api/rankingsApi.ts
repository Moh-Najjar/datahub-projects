import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { rankingsMock } from '../mock/rankingsMock';
import type { RankingEntryDto, RankingFilters } from '../types/ranking';

/** The ONLY data entry point of the Rankings module (today: the simulated backend; later: HTTP, same types). */
export const rankingsApi = {
  list: (params: ListParams<RankingFilters>, signal?: AbortSignal): Promise<Paginated<RankingEntryDto>> => mockRequest(() => rankingsMock.list(params), { signal }),
};
