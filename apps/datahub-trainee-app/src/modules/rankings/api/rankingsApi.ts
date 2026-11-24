import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { rankingsMock } from '../mock/rankingsMock';
import type { RankingEntryDto, RankingFilters } from '../types/ranking';
import { usesMockData } from '@/core/config/api';
import { rankingsHttpApi } from './rankingsHttp';

/** The ONLY data entry point of the Rankings module (the real backend over HTTP, or the simulated one — same types). */
const mockRankingsApi = {
  list: (params: ListParams<RankingFilters>, signal?: AbortSignal): Promise<Paginated<RankingEntryDto>> => mockRequest(() => rankingsMock.list(params), { signal }),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const rankingsApi: typeof mockRankingsApi = usesMockData ? mockRankingsApi : rankingsHttpApi;
