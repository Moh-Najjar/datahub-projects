import { useMutation } from '@tanstack/react-query';
import { signIn } from '@/modules/portals/api/workspaceAuth';

/**
 * Sign-in as a TanStack Query mutation (pending / error state for the form). The session itself is not server state:
 * it lives in the Workspace session store (`workspaceAuth.ts`), shared by every tab and read with `useWorkspaceSession`.
 */
export function useSignIn() {
  return useMutation({ mutationFn: ({ username, password }: { username: string; password: string }) => signIn(username, password) });
}
