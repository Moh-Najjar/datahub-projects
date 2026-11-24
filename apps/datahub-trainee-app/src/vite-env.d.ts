/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The DataHub website (Workspace) URL. Public. */
  readonly VITE_WORKSPACE_URL?: string;
  /** DataHub Analytics API origin (public). Development proxies `/api` to it. */
  readonly VITE_API_URL?: string;
  /** `api` (default, the real backend) or `mock` (the simulated backend). */
  readonly VITE_TRAINEE_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
