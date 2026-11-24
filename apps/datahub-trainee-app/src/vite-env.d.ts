/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The DataHub website (Workspace) URL. Public. */
  readonly VITE_WORKSPACE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
