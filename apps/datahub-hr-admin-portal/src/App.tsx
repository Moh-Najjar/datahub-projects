import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createQueryClient } from '@/core/api/queryClient';
import { AuthProvider } from '@/core/context/AuthProvider';
import { router } from '@/core/routes';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';

const queryClient = createQueryClient();

/** Application root: server-state cache → session → theme (RTL/LTR, light/dark) → router. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppThemeProvider>
          <RouterProvider router={router} />
        </AppThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
