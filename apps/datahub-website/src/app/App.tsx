import { RouterProvider } from 'react-router-dom';
import { router } from './router';

/**
 * Application root. Providers that depend on the URL (locale, theme direction) live in
 * `SiteLayout`, the router's root element.
 */
export function App() {
  return <RouterProvider router={router} />;
}
