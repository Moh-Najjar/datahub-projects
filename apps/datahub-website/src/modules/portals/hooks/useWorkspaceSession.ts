import { useSyncExternalStore } from 'react';
import { getSession, subscribeToSession, type WorkspaceSession } from '@/modules/portals/api/workspaceAuth';

/** The Workspace session (re-renders on sign-in, sign-out — also in other tabs — and expiry). */
export function useWorkspaceSession(): WorkspaceSession | null {
  return useSyncExternalStore(subscribeToSession, getSession, getSession);
}
