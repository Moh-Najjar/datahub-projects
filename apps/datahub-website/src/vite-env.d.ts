/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the DataHub HR Admin Portal (public; the Workspace's HR Admin card opens `<url>/sso#token=…`). Dev default: http://localhost:3001. */
  readonly VITE_HR_ADMIN_PORTAL_URL?: string;
  /** Base URL of the DataHub Trainee App (public; the Workspace's Trainee App card opens `<url>/sso#token=…`). Dev default: http://localhost:3002. */
  readonly VITE_TRAINEE_APP_URL?: string;
  /** `true` enables the admin area (blog management prototype) in a production build. Always on in development. */
  readonly VITE_ENABLE_ADMIN?: string;
  /** Origin of the DataHub Analytics backend API (public, e.g. https://…azurewebsites.net). Development proxies `/api` to it. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
