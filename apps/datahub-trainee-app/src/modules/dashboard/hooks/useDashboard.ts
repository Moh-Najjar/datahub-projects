import { useQuery } from '@tanstack/react-query';
import { useActorKey } from '@/core/hooks/useActorKey';
import { dashboardApi } from '../api/dashboardApi';

export function useDashboard() {
  const actor = useActorKey();
  return useQuery({ queryKey: ['dashboard', actor, 'summary'], queryFn: ({ signal }) => dashboardApi.get(signal) });
}

/** The newest activity-timeline entries (managers: their scope; learners: about themselves). */
export function useRecentActivity(limit: number) {
  const actor = useActorKey();
  return useQuery({ queryKey: ['dashboard', actor, 'activity', limit], queryFn: ({ signal }) => dashboardApi.recentActivity(limit, signal) });
}
