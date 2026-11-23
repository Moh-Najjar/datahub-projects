import { QueryClient } from '@tanstack/react-query';
import { HttpError } from './http';

/** Retry only what can recover: no answer, server errors (2×) and rate limiting — 429 (3×). Never other 4xx. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof HttpError)) return failureCount < 2;
  if (error.status === 429) return failureCount < 3;
  return (error.status === 0 || error.status >= 500) && failureCount < 2;
}

/** Data fresh for 5 minutes, no refetch on window focus, mutations never retried. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
