/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional endpoint that receives appointment/contact form submissions as JSON. */
  readonly VITE_FORM_ENDPOINT?: string;
  /** Base URL of the DataHub HR Admin Portal (public; the header links to `<url>/login`). Dev default: http://localhost:5174. */
  readonly VITE_HR_ADMIN_PORTAL_URL?: string;
  /** `true` enables the admin area (blog management prototype) in a production build. Always on in development. */
  readonly VITE_ENABLE_ADMIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
