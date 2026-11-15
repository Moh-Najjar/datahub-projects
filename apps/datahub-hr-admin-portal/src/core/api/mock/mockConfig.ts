import type { ApiErrorCode } from '@/core/api/types';

/*
 * Behaviour of the SIMULATED backend. Nothing here talks to a server: mock API services run in the
 * browser against in-memory data, with an artificial delay so loading states are visible.
 */

export interface MockConfig {
  /** Simulated latency range (ms). */
  delayMs: { min: number; max: number };
  /** Probability (0–1) that a request fails with `SERVER` — 0 by default, raise it to test error states. */
  failureRate: number;
}

const DEFAULTS: MockConfig = { delayMs: { min: 200, max: 600 }, failureRate: 0 };

let config: MockConfig = { ...DEFAULTS, delayMs: { ...DEFAULTS.delayMs } };
const queuedFailures: ApiErrorCode[] = [];

export function getMockConfig(): Readonly<MockConfig> {
  return config;
}

export function setMockConfig(patch: Partial<MockConfig>): void {
  config = { ...config, ...patch, delayMs: { ...config.delayMs, ...patch.delayMs } };
}

export function resetMockConfig(): void {
  config = { ...DEFAULTS, delayMs: { ...DEFAULTS.delayMs } };
  queuedFailures.length = 0;
}

/** Make the next mock request(s) fail with the given error code (one entry per request). */
export function failNextRequest(code: ApiErrorCode = 'SERVER'): void {
  queuedFailures.push(code);
}

/** Internal: the failure to apply to the request starting now, if any. */
export function takeQueuedFailure(): ApiErrorCode | undefined {
  return queuedFailures.shift();
}
