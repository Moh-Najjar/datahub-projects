import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/context/authContext';
import { authApi, type LoginRequest } from '@/modules/auth/api/authApi';

/** Signs in through the auth API and stores the returned session. */
export function useLogin() {
  const { signIn } = useAuth();
  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: signIn,
  });
}

/** Demo accounts for the sign-in page (they never change during a session). */
export function useDemoAccounts() {
  return useQuery({
    queryKey: ['auth', 'demo-accounts'],
    queryFn: ({ signal }) => authApi.listDemoAccounts(signal),
    staleTime: Infinity,
  });
}
