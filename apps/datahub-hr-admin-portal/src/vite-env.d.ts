/// <reference types="vite/client" />

/*
 * Client environment variables are PUBLIC: everything prefixed `VITE_` is embedded in the browser bundle.
 * Never put secrets (API keys, tokens, passwords) here. None are defined yet.
 */
interface ImportMetaEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
