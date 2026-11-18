/// <reference types="vite/client" />

/*
 * Client environment variables are PUBLIC: everything prefixed `VITE_` is embedded in the browser bundle.
 * Never put secrets (API keys, tokens, passwords) here.
 */
interface ImportMetaEnv {
  /** Base URL of the public website that hosts the DataHub Workspace (central sign-in). Dev default: http://localhost:3000. */
  readonly VITE_WORKSPACE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
