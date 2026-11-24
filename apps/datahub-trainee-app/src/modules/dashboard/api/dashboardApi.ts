import { mockRequest } from '@/core/api/mock/mockRequest';
import { dashboardMock } from '../mock/dashboardMock';
import type { ActivityDto, DashboardDto, DashboardFilters } from '../types/dashboard';

/** The ONLY data entry point of the Dashboard module (today: the simulated backend; later: HTTP, same types). */
export const dashboardApi = {
  get: (filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardDto> => mockRequest(() => dashboardMock.get(filters), { signal }),
  recentActivity: (limit: number, departmentId: string | null, signal?: AbortSignal): Promise<ActivityDto[]> => mockRequest(() => dashboardMock.recentActivity(limit, departmentId), { signal }),
};
