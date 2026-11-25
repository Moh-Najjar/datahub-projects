import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/core/api/auth';

/**
 * Activates an invited account (`POST /api/v1/auth/activate-invitation`, anonymous). Never retried: the token is
 * single-use. The token and password are only sent to the API — never stored or logged.
 */
export function useActivateInvitation() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) => authApi.activateInvitation(token, newPassword),
    retry: false,
  });
}
