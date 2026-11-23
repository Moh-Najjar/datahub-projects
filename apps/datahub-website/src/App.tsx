import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createQueryClient } from '@/core/helpers/queryClient';
import { router } from '@/core/routes';

/**
 * Application root. Server state (backend API) is held by TanStack Query. Providers that depend on the URL (locale,
 * theme direction) live in `SiteLayout`, the router's root element.
 */
export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
