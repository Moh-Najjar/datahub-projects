import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useActorKey } from '@/core/hooks/useActorKey';
import { rankingsApi } from '../api/rankingsApi';
import type { RankingFilters } from '../types/ranking';

export function useRankings(params: ListParams<RankingFilters>) {
  const actor = useActorKey();
  return useQuery({ queryKey: ['rankings', actor, 'list', params], queryFn: ({ signal }) => rankingsApi.list(params, signal), placeholderData: keepPreviousData });
}
