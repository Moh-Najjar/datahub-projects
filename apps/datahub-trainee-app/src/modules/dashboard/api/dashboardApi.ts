import { mockRequest } from '@/core/api/mock/mockRequest';
import { dashboardMock } from '../mock/dashboardMock';
import type { ActivityDto, DashboardDto } from '../types/dashboard';

/** The ONLY data entry point of the Dashboard module (today: the simulated backend; later: HTTP, same types). */
export const dashboardApi = {
  get: (signal?: AbortSignal): Promise<DashboardDto> => mockRequest(() => dashboardMock.get(), { signal }),
  recentActivity: (limit: number, signal?: AbortSignal): Promise<ActivityDto[]> => mockRequest(() => dashboardMock.recentActivity(limit), { signal }),
};
