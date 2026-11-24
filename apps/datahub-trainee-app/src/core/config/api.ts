/**
 * Backend API configuration (public values only — never secrets).
 *
 * - `API_BASE_URL`: the DataHub Analytics API origin (`VITE_API_URL`). In development requests stay on this app's origin
 *   and Vite proxies `/api` to it (the API's CORS list does not include the dev origin); production calls it directly,
 *   so the deployed origin must be in the API's CORS list.
 * - `DATA_SOURCE`: `api` (default — the real backend) or `mock` (the in-browser simulated backend: tests, and local work
 *   while a backend feature is unavailable; set `VITE_TRAINEE_DATA=mock`). Each module's `api/` picks its implementation
 *   from it, so hooks and components never know which one runs.
 */
export const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export type DataSource = 'api' | 'mock';

export const DATA_SOURCE: DataSource = import.meta.env.MODE === 'test' || import.meta.env.VITE_TRAINEE_DATA === 'mock' ? 'mock' : 'api';

export const usesMockData = DATA_SOURCE === 'mock';
