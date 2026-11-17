import { useSyncExternalStore } from 'react';
import { getSession, subscribeToSession, type AdminSession } from '@/modules/admin/api/authService';

/** The signed-in admin (re-renders on sign-in, sign-out and changes from other tabs). */
export function useAdminSession(): AdminSession | null {
  return useSyncExternalStore(subscribeToSession, getSession, getSession);
}
