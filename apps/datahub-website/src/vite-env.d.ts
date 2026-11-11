/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional endpoint that receives appointment/contact form submissions as JSON. */
  readonly VITE_FORM_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
