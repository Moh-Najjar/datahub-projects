import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useActorKey } from '@/core/hooks/useActorKey';
import { dashboardApi } from '../api/dashboardApi';
import { NO_DASHBOARD_FILTERS, type DashboardFilters } from '../types/dashboard';

export function useDashboard(filters: DashboardFilters = NO_DASHBOARD_FILTERS) {
  const actor = useActorKey();
  return useQuery({ queryKey: ['dashboard', actor, 'summary', filters], queryFn: ({ signal }) => dashboardApi.get(filters, signal), placeholderData: keepPreviousData });
}

/** The newest activity-timeline entries (managers: their scope; learners: about themselves). */
export function useRecentActivity(limit: number, departmentId: string | null = null, enabled = true) {
  const actor = useActorKey();
  return useQuery({ queryKey: ['dashboard', actor, 'activity', limit, departmentId], queryFn: ({ signal }) => dashboardApi.recentActivity(limit, departmentId, signal), enabled });
}
