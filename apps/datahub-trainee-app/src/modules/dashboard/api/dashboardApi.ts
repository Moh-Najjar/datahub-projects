import { mockRequest } from '@/core/api/mock/mockRequest';
import { dashboardMock } from '../mock/dashboardMock';
import type { ActivityDto, DashboardDto, DashboardFilters } from '../types/dashboard';
import { usesMockData } from '@/core/config/api';
import { dashboardHttpApi } from './dashboardHttp';

/** The ONLY data entry point of the Dashboard module (the real backend over HTTP, or the simulated one — same types). */
const mockDashboardApi = {
  get: (filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardDto> => mockRequest(() => dashboardMock.get(filters), { signal }),
  recentActivity: (limit: number, departmentId: string | null, signal?: AbortSignal): Promise<ActivityDto[]> => mockRequest(() => dashboardMock.recentActivity(limit, departmentId), { signal }),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const dashboardApi: typeof mockDashboardApi = usesMockData ? mockDashboardApi : dashboardHttpApi;
