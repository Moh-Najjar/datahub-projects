import { useAuth } from '@/core/auth/authContext';

/**
 * The training identity behind the current data. Every query key includes it, so switching to another user (the
 * mock "view as") never shows the previous user's cached data.
 */
export function useActorKey(): string {
  return useAuth().actor?.userId ?? 'anonymous';
}
