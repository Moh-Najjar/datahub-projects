/**
 * Base URL of the DataHub Analytics API (`VITE_API_URL`, public). In development requests stay on this site's origin
 * (`/api/…`) and Vite proxies them (vite.config.ts); in production they go straight to the API.
 */
export const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
