import { QueryClient } from '@tanstack/react-query';
import { isRetryable } from './types';

/**
 * TanStack Query defaults for the whole app:
 * - identical queries are de-duplicated and cached for 30 s (no repeated requests on remount),
 * - client errors (4xx) are not retried; network/server errors are retried twice,
 * - mutations are never retried automatically (they may not be idempotent).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => isRetryable(error) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}
