import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createQueryClient } from '@/core/api/queryClient';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { router } from '@/core/routes';
import { AppThemeProvider } from '@/core/theme/AppThemeProvider';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { FeedbackProvider } from '@/modules/shared/FeedbackProvider';

/** Providers: query cache → language → theme (RTL aware) → feedback → Workspace session → router. */
export default function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </FeedbackProvider>
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
