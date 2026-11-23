/**
 * The admin area (`/admin/`, blog management through the backend API, signed in through the Workspace — see
 * modules/admin). It is always available in development; a production build enables it only with
 * `VITE_ENABLE_ADMIN=true` (see `.env.example`), so visitors of the public site never see it by accident.
 */
export const ADMIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true';
