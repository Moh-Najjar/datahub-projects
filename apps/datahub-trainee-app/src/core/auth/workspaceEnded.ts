/*
 * Records when this tab's session was ended by the Workspace session check (`WorkspaceSessionCheck.tsx`), so the
 * sign-in page can tell a normal central sign-out from a loop.
 */

/** When this tab's session was ended because the Workspace session ended or changed (epoch ms, newest last). */
const WORKSPACE_ENDED_KEY = 'datahub-trainee.workspace-ended';
const LOOP_WINDOW_MS = 30_000;

function readEnded(): number[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(WORKSPACE_ENDED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function recordWorkspaceEnded(now: number = Date.now()): void {
  try {
    sessionStorage.setItem(WORKSPACE_ENDED_KEY, JSON.stringify([...readEnded().filter((t) => now - t < LOOP_WINDOW_MS), now]));
  } catch {
    // ignore
  }
}

/**
 * Loop guard: the session was ended twice within 30 s — e.g. the browser hides the website's storage from the
 * embedded check (cross-site partitioning), so every sign-in would end at once. The sign-in page then stops sending
 * the user to the Workspace automatically and offers a button instead.
 */
export function workspaceCheckLooping(now: number = Date.now()): boolean {
  return readEnded().filter((t) => now - t < LOOP_WINDOW_MS).length >= 2;
}
