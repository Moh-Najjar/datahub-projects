import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/modules/auth/api/authApi';

/** The directory users available for "view as" (mock only). */
export function useSimulationProfiles(enabled: boolean) {
  return useQuery({ queryKey: ['auth', 'simulation-profiles'], queryFn: () => authApi.listSimulationProfiles(), enabled, staleTime: 60_000 });
}
