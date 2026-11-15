import { ApiError } from '@/core/api/types';
import { getMockConfig, takeQueuedFailure } from './mockConfig';

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Runs one SIMULATED API call: waits a random latency, applies queued/random failures, then runs the
 * handler. Results are deep-cloned so callers can never mutate the in-memory data by accident.
 * Handlers signal business errors by throwing `ApiError` (e.g. `NOT_FOUND`, `CONFLICT`).
 */
export async function mockRequest<T>(handler: () => T, options: { signal?: AbortSignal } = {}): Promise<T> {
  const { delayMs, failureRate } = getMockConfig();
  const queued = takeQueuedFailure();
  const latency = delayMs.min + Math.random() * Math.max(0, delayMs.max - delayMs.min);
  if (latency > 0) await wait(latency, options.signal);

  if (queued) throw new ApiError(queued, `Simulated ${queued} error`);
  if (failureRate > 0 && Math.random() < failureRate) throw new ApiError('SERVER', 'Simulated server error');

  return structuredClone(handler());
}
